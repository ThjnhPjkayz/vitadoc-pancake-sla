// ============================================================
// Sync Service
// Orchestrates data flow: Pancake API → PostgreSQL via Prisma
// ============================================================

import { prisma } from "@/lib/prisma";
import {
  getPages,
  generatePageAccessToken,
  getAllConversations,
  getMessages,
} from "@/lib/services/pancake-api";
import { calculateSLAForConversation } from "@/lib/services/sla";
import type {
  PancakePage,
  PancakeConversation,
  PancakeMessage,
} from "@/lib/types/pancake";

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

export interface SyncStats {
  pages: { upserted: number; skipped: number };
  conversations: { upserted: number; skipped: number };
  messages: { upserted: number; skipped: number };
  slaChecked: number;
  errors: string[];
}

// ----------------------------------------------------------------
// Main Sync
// ----------------------------------------------------------------

export async function syncAllPages(since?: Date): Promise<SyncStats> {
  const stats: SyncStats = {
    pages: { upserted: 0, skipped: 0 },
    conversations: { upserted: 0, skipped: 0 },
    messages: { upserted: 0, skipped: 0 },
    slaChecked: 0,
    errors: [],
  };

  // --- Tạo bản ghi SyncHistory ---
  let syncRecord: { id: string } | null = null;
  try {
    syncRecord = await prisma.syncHistory.create({
      data: {
        status: "running",
        startedAt: new Date(),
      },
      select: { id: true },
    });
  } catch (err) {
    console.warn("[Sync] Could not create SyncHistory record:", err);
  }

  if (since) {
    console.log(`[Sync] 🚀 Starting incremental sync (since ${since.toISOString()})...`);
  } else {
    console.log("[Sync] 🚀 Starting full sync...");
  }

  // --- STEP 1: Fetch pages from Pancake ---
  let pages: PancakePage[] = [];
  try {
    const pagesRes = await getPages();
    pages = pagesRes.categorized.activated;
    console.log(`[Sync] ✅ Got ${pages.length} activated pages`);
  } catch (err) {
    stats.errors.push(`Failed to fetch pages: ${String(err)}`);
    return stats;
  }

  // --- STEP 2: Loop từng page ---
  for (const page of pages) {
    try {
      await syncSinglePage(page, stats, since);
    } catch (err) {
      stats.errors.push(
        `Page ${page.id} (${page.name}): ${String(err)}`
      );
    }

    // Rate limit safety: chờ 500ms giữa các page
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log("[Sync] ✅ Done!", stats);

  // --- Cập nhật SyncHistory ---
  if (syncRecord) {
    try {
      const isSuccess = stats.errors.length === 0;
      await prisma.syncHistory.update({
        where: { id: syncRecord.id },
        data: {
          status: isSuccess ? "success" : "failed",
          completedAt: new Date(),
          pagesCount: stats.pages.upserted,
          conversationsCount: stats.conversations.upserted,
          messagesCount: stats.messages.upserted,
          slaChecked: stats.slaChecked,
          errors: stats.errors.length > 0 ? stats.errors : undefined,
        },
      });
    } catch (err) {
      console.warn("[Sync] Could not update SyncHistory record:", err);
    }
  }

  return stats;
}

// ----------------------------------------------------------------
// Sync Single Page
// ----------------------------------------------------------------

async function syncSinglePage(
  page: PancakePage,
  stats: SyncStats,
  since?: Date
): Promise<void> {
  // --- Save page to DB ---
  await prisma.page.upsert({
    where: { id: page.id },
    update: {
      name: page.name,
      username: page.username,
      platform: page.platform,
      avatarUrl: page.avatar_url,
      isActivated: page.is_activated,
      shopId: page.shop_id,
      timezone: page.timezone,
      connected: page.connected,
      rawData: page as unknown as Record<string, unknown>,
    },
    create: {
      id: page.id,
      name: page.name,
      username: page.username,
      platform: page.platform,
      avatarUrl: page.avatar_url,
      isActivated: page.is_activated,
      shopId: page.shop_id,
      timezone: page.timezone,
      connected: page.connected,
      rawData: page as unknown as Record<string, unknown>,
    },
  });
  stats.pages.upserted++;

  // --- Generate page access token ---
  let pageAccessToken: string | null = null;
  try {
    const tokenRes = await generatePageAccessToken(page.id);
    pageAccessToken = tokenRes.page_access_token;

    // Update token vào DB
    await prisma.page.update({
      where: { id: page.id },
      data: { pageAccessToken },
    });
  } catch {
    // Token có thể đã có sẵn trong settings
    const existingToken =
      (page.settings as Record<string, unknown>)
        ?.page_access_token as string | undefined;

    if (existingToken) {
      pageAccessToken = existingToken;
    } else {
      throw new Error(`No page_access_token available for ${page.id}`);
    }
  }

  if (!pageAccessToken) {
    throw new Error(`Cannot get page_access_token for ${page.id}`);
  }

  // --- STEP 3: Fetch all conversations (with pagination) ---
  let conversations: PancakeConversation[] = [];
  try {
    conversations = await getAllConversations(page.id, pageAccessToken, since);
    console.log(
      `[Sync]   📨 Page "${page.name}": ${conversations.length} conversations`
    );
  } catch (err) {
    stats.errors.push(
      `Conversations ${page.id}: ${String(err)}`
    );
    return;
  }

  // --- STEP 4 & 5: Loop conversations → messages (concurrent, chỉ sync mới nếu incremental) ---
  const toSync = conversations.filter((conv) => {
    if (since && conv.updated_at && new Date(conv.updated_at) < since) {
      stats.conversations.skipped++;
      return false;
    }
    return true;
  });

  // Xử lý CONCURRENCY conv song song thay vì tuần tự
  const CONCURRENCY = 5;
  for (let i = 0; i < toSync.length; i += CONCURRENCY) {
    const batch = toSync.slice(i, i + CONCURRENCY);
    await Promise.allSettled(
      batch.map((conv) =>
        syncSingleConversation(page.id, pageAccessToken, conv, stats).catch(
          (err) => stats.errors.push(`Conv ${conv.id}: ${String(err)}`)
        )
      )
    );
  }
}

// ----------------------------------------------------------------
// Sync Single Conversation
// ----------------------------------------------------------------

async function syncSingleConversation(
  pageId: string,
  pageAccessToken: string,
  conv: PancakeConversation,
  stats: SyncStats
): Promise<void> {
  // --- Save conversation to DB ---
  await prisma.conversation.upsert({
    where: { id: conv.id },
    update: {
      type: conv.type,
      snippet: conv.snippet,
      messageCount: conv.message_count,
      seen: conv.seen,
      hasPhone: conv.has_phone,
      postId: conv.post_id,
      customerId: conv.customer_id,
      customerName: conv.from?.name,
      customerUsername: conv.from?.username,
      lastSentById: conv.last_sent_by?.id,
      lastSentByName: conv.last_sent_by?.name,
      assigneeIds: conv.assignee_ids as unknown as Record<string, unknown>[],
      insertedAt: new Date(conv.inserted_at),
      updatedAtConv: new Date(conv.updated_at),
      rawData: conv as unknown as Record<string, unknown>,
    },
    create: {
      id: conv.id,
      pageId,
      type: conv.type,
      snippet: conv.snippet,
      messageCount: conv.message_count,
      seen: conv.seen,
      hasPhone: conv.has_phone,
      postId: conv.post_id,
      customerId: conv.customer_id,
      customerName: conv.from?.name,
      customerUsername: conv.from?.username,
      lastSentById: conv.last_sent_by?.id,
      lastSentByName: conv.last_sent_by?.name,
      assigneeIds: conv.assignee_ids as unknown as Record<string, unknown>[],
      insertedAt: new Date(conv.inserted_at),
      updatedAtConv: new Date(conv.updated_at),
      rawData: conv as unknown as Record<string, unknown>,
    },
  });
  stats.conversations.upserted++;

  // --- Fetch messages (skip nếu message_count không đổi so với DB) ---
  const existingMsgCount = await prisma.message.count({
    where: { conversationId: conv.id },
  });
  const needsFetch = existingMsgCount !== conv.message_count;

  let messages: PancakeMessage[] = [];
  if (needsFetch) {
    try {
      const msgRes = await getMessages(pageId, conv.id, pageAccessToken);
      messages = msgRes.messages;
    } catch (err) {
      stats.errors.push(`Messages ${conv.id}: ${String(err)}`);
      return;
    }
  }

  // --- Save messages ---
  for (const msg of messages) {
    // Xác định ai gửi
    const isFromCustomer = msg.from.id !== pageId;
    const isFromAdmin = !isFromCustomer;

    await prisma.message.upsert({
      where: { id: msg.id },
      update: {
        message: msg.message,
        type: msg.type,
        fromId: msg.from.id,
        fromName: msg.from.name,
        fromUsername: msg.from.username,
        isFromCustomer,
        isFromAdmin,
        seen: msg.seen,
        hasPhone: msg.has_phone,
        attachments: msg.attachments as unknown as Record<string, unknown>[],
        insertedAt: new Date(msg.inserted_at),
        rawData: msg as unknown as Record<string, unknown>,
      },
      create: {
        id: msg.id,
        conversationId: conv.id,
        pageId,
        message: msg.message,
        type: msg.type,
        fromId: msg.from.id,
        fromName: msg.from.name,
        fromUsername: msg.from.username,
        isFromCustomer,
        isFromAdmin,
        seen: msg.seen,
        hasPhone: msg.has_phone,
        attachments: msg.attachments as unknown as Record<string, unknown>[],
        insertedAt: new Date(msg.inserted_at),
        rawData: msg as unknown as Record<string, unknown>,
      },
    });
    stats.messages.upserted++;
  }

  // --- STEP 7: Tính SLA ---
  await calculateSLAForConversation(conv.id, pageId);
  stats.slaChecked++;
}
