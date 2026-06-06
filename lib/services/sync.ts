// ============================================================
// Sync Service
// Orchestrates data flow: Pancake API → PostgreSQL via Prisma
// Full sync — chạy 1 lần/ngày lúc 23:59
// ============================================================

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/app/generated/prisma";
import {
  getPages,
  generatePageAccessToken,
  getConversations,
  getAllConversations,
  getMessages,
  CONVERSATIONS_PAGE_SIZE,
} from "@/lib/services/pancake-api";
import { calculateSLAForConversation } from "@/lib/services/sla";
import {
  startProgress,
  updatePageProgress,
  updateCounts,
  endProgress,
  flushToDB,
} from "@/lib/services/sync-progress";
import type {
  PancakePage,
  PancakeConversation,
  PancakeMessage,
} from "@/lib/types/pancake";

// Pancake trả inserted_at/updated_at dạng "2024-01-15T10:30:00" không có timezone
// → phải gắn "+07:00" để parse đúng UTC+7
function parsePancakeDate(str: string): Date {
  return new Date(str + "+07:00");
}

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

export async function syncAllPages(force = false): Promise<SyncStats> {
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

  console.log("[Sync] 🚀 Starting full sync...");
  startProgress(0);

  // --- Lấy thời gian sync thành công gần nhất để incremental sync ---
  let since: Date | undefined;
  if (!force) {
    const lastSuccess = await prisma.syncHistory.findFirst({
      where: { status: "success" },
      orderBy: { completedAt: "desc" },
      select: { completedAt: true },
    });
    if (lastSuccess?.completedAt) {
      // Trừ 5 phút buffer để tránh miss conversations ở edge case timezone/timing
      since = new Date(lastSuccess.completedAt.getTime() - 5 * 60 * 1000);
    }
  }

  if (force) {
    console.log("[Sync] Force full sync — bỏ qua incremental");
  } else if (since) {
    console.log(`[Sync] Incremental sync từ ${since.toISOString()}`);
  } else {
    console.log("[Sync] Full sync (không có lịch sử thành công trước đó)");
  }

  // --- STEP 1: Fetch pages from Pancake ---
  let pages: PancakePage[] = [];
  try {
    const pagesRes = await getPages();
    pages = pagesRes.categorized.activated;
    console.log(`[Sync] ✅ Got ${pages.length} activated pages`);
    startProgress(pages.length);
  } catch (err) {
    stats.errors.push(`Failed to fetch pages: ${String(err)}`);
    endProgress();
    return stats;
  }

  // --- STEP 2: Loop từng page ---
  let cancelled = false;
  for (const page of pages) {
    // Kiểm tra cancel trước mỗi page
    if (syncRecord) {
      const current = await prisma.syncHistory.findUnique({
        where: { id: syncRecord.id },
        select: { status: true },
      });
      if (current?.status === "cancelled") {
        console.log("[Sync] ⛔ Cancelled by user");
        cancelled = true;
        break;
      }
    }

    updatePageProgress(pages.indexOf(page) + 1, page.id, page.name);
    if (syncRecord) await flushToDB(syncRecord.id);

    try {
      await syncSinglePage(page, stats, since);
    } catch (err) {
      stats.errors.push(`Page ${page.id} (${page.name}): ${String(err)}`);
      updateCounts({ errors: 1 });
    }

    // Rate limit safety: chờ 500ms giữa các page
    await new Promise((r) => setTimeout(r, 500));
  }

  endProgress();
  console.log(cancelled ? "[Sync] ⛔ Stopped." : "[Sync] ✅ Done!", stats);

  // --- Cập nhật SyncHistory ---
  if (syncRecord) {
    try {
      const finalStatus = cancelled ? "cancelled" : stats.errors.length === 0 ? "success" : "failed";
      await prisma.syncHistory.update({
        where: { id: syncRecord.id },
        data: {
          status: finalStatus,
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
// Ensure Page Setup — upsert page + get token (idempotent)
// ----------------------------------------------------------------

export async function ensurePageAndGetToken(
  page: PancakePage,
  stats: SyncStats
): Promise<string> {
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
      rawData: page as unknown as Prisma.InputJsonValue,
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
      rawData: page as unknown as Prisma.InputJsonValue,
    },
  });
  stats.pages.upserted++;

  try {
    const tokenRes = await generatePageAccessToken(page.id);
    const token = tokenRes.page_access_token;
    await prisma.page.update({ where: { id: page.id }, data: { pageAccessToken: token } });
    return token;
  } catch {
    const dbPage = await prisma.page.findUnique({
      where: { id: page.id },
      select: { pageAccessToken: true },
    });
    if (dbPage?.pageAccessToken) return dbPage.pageAccessToken;

    const existingToken = (page.settings as Record<string, unknown>)
      ?.page_access_token as string | undefined;
    if (existingToken) return existingToken;

    throw new Error(`No page_access_token available for ${page.id}`);
  }
}

// ----------------------------------------------------------------
// Sync One Conversation Batch — one cursor page (≤60 conversations)
// Returns nextCursor = null when there are no more pages
// ----------------------------------------------------------------

export async function syncConversationBatch(
  pageId: string,
  pageAccessToken: string,
  stats: SyncStats,
  cursor?: string,
  since?: Date
): Promise<{ nextCursor: string | null }> {
  const res = await getConversations(pageId, pageAccessToken, cursor);
  const conversations: PancakeConversation[] = res.conversations ?? [];

  if (conversations.length === 0) return { nextCursor: null };

  // Incremental: stop if entire batch is older than since
  if (since) {
    const hasNew = conversations.some(
      (c) => !c.updated_at || new Date(c.updated_at + "+07:00") >= since
    );
    if (!hasNew) return { nextCursor: null };
  }

  console.log(
    `[Sync]   📨 Page ${pageId}: ${conversations.length} conversations (cursor=${cursor ?? "start"})${since ? " incremental" : ""}`
  );

  const CONCURRENCY = 2;
  for (let i = 0; i < conversations.length; i += CONCURRENCY) {
    const batch = conversations.slice(i, i + CONCURRENCY);
    await Promise.allSettled(
      batch.map((conv) =>
        syncSingleConversation(pageId, pageAccessToken!, conv, stats).catch(
          (err) => stats.errors.push(`Conv ${conv.id}: ${String(err)}`)
        )
      )
    );
  }

  const nextCursor =
    conversations.length < CONVERSATIONS_PAGE_SIZE
      ? null
      : conversations[conversations.length - 1].id;

  return { nextCursor };
}

// ----------------------------------------------------------------
// Sync Single Page — used by cron job (loops all cursor pages)
// ----------------------------------------------------------------

export async function syncSinglePage(
  page: PancakePage,
  stats: SyncStats,
  since?: Date
): Promise<void> {
  const pageAccessToken = await ensurePageAndGetToken(page, stats);

  let cursor: string | undefined;
  do {
    const { nextCursor } = await syncConversationBatch(page.id, pageAccessToken, stats, cursor, since);
    cursor = nextCursor ?? undefined;
    if (cursor) await new Promise((r) => setTimeout(r, 300));
  } while (cursor);
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
      assigneeIds: conv.assignee_ids as unknown as Prisma.InputJsonValue[],
      insertedAt: parsePancakeDate(conv.inserted_at),
      updatedAtConv: parsePancakeDate(conv.updated_at),
      rawData: conv as unknown as Prisma.InputJsonValue,
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
      assigneeIds: conv.assignee_ids as unknown as Prisma.InputJsonValue[],
      insertedAt: parsePancakeDate(conv.inserted_at),
      updatedAtConv: parsePancakeDate(conv.updated_at),
      rawData: conv as unknown as Prisma.InputJsonValue,
    },
  });
  stats.conversations.upserted++;
  updateCounts({ conversations: 1 });

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

  // --- Save messages (batch insert, skip duplicates) ---
  if (messages.length > 0) {
    const msgData = messages.map((msg) => {
      const isFromCustomer = msg.from.id !== pageId;
      return {
        id: msg.id,
        conversationId: conv.id,
        pageId,
        message: msg.message,
        type: msg.type,
        fromId: msg.from.id,
        fromName: msg.from.name,
        fromUsername: msg.from.username,
        isFromCustomer,
        isFromAdmin: !isFromCustomer,
        seen: msg.seen,
        hasPhone: msg.has_phone,
        attachments: msg.attachments as unknown as Prisma.InputJsonValue[],
        insertedAt: parsePancakeDate(msg.inserted_at),
        rawData: msg as unknown as Prisma.InputJsonValue,
      };
    });

    const result = await prisma.message.createMany({
      data: msgData,
      skipDuplicates: true,
    });
    stats.messages.upserted += result.count;
    updateCounts({ messages: result.count });
  }

  // --- Tính SLA — chỉ khi có message mới ---
  if (needsFetch) {
    await calculateSLAForConversation(conv.id, pageId);
    stats.slaChecked++;
    updateCounts({ slaChecked: 1 });
  }
}
