// ============================================================
// POST /api/sync/full-run — Full sync không cần browser
// Auth: Authorization: Bearer {CRON_SECRET}
//
// Pattern: self-chaining với waitUntil
//   - Chạy tối đa 240s, lưu cursor vào DB
//   - Nếu chưa xong → tự gọi lại chính nó (fire-and-forget)
//   - Lặp cho đến khi sync hết toàn bộ pages
// ============================================================

import { waitUntil } from "@vercel/functions";
import { prisma } from "@/lib/prisma";
import { getPages } from "@/lib/services/pancake-api";
import {
  ensurePageAndGetToken,
  syncConversationBatch,
} from "@/lib/services/sync";
import type { SyncStats } from "@/lib/services/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface ResumeData {
  donePageIds: string[];
  currentPageId: string | null;
  currentCursor: string | null;
  totals: { conversations: number; messages: number; slaChecked: number; pages: number };
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Tìm full sync job đang chạy (có resumeData)
  const existingRecord = await prisma.syncHistory.findFirst({
    where: { status: "running" },
    orderBy: { startedAt: "desc" },
  });

  const isResume = !!(existingRecord?.resumeData);

  // Lấy danh sách pages
  let pages;
  try {
    const pagesRes = await getPages();
    pages = pagesRes.categorized.activated;
  } catch (err) {
    return Response.json({ error: `Failed to fetch pages: ${String(err)}` }, { status: 500 });
  }

  let syncId: string;
  let resume: ResumeData;
  let jobStartedAt: Date;

  if (isResume && existingRecord) {
    syncId = existingRecord.id;
    resume = existingRecord.resumeData as unknown as ResumeData;
    jobStartedAt = existingRecord.startedAt;
    console.log(`[FullSync] ▶️ Resuming job ${syncId} — done: [${resume.donePageIds.join(", ")}], current: ${resume.currentPageId}, cursor: ${resume.currentCursor}`);
  } else {
    // Đánh stale nếu có record running không có resumeData
    if (existingRecord) {
      await prisma.syncHistory.update({
        where: { id: existingRecord.id },
        data: { status: "failed", completedAt: new Date() },
      });
    }

    const record = await prisma.syncHistory.create({
      data: {
        status: "running",
        startedAt: new Date(),
        resumeData: {
          donePageIds: [],
          currentPageId: null,
          currentCursor: null,
          totals: { conversations: 0, messages: 0, slaChecked: 0, pages: 0 },
        } satisfies ResumeData,
        progressSnapshot: {
          isRunning: true,
          totalPages: pages.length,
          currentPageIndex: 0,
          currentPageName: null,
          conversations: 0,
          messages: 0,
          slaChecked: 0,
        },
      },
      select: { id: true },
    });
    syncId = record.id;
    resume = { donePageIds: [], currentPageId: null, currentCursor: null, totals: { conversations: 0, messages: 0, slaChecked: 0, pages: 0 } };
    jobStartedAt = new Date();
    console.log(`[FullSync] 🚀 Starting new full sync job ${syncId} — ${pages.length} pages`);
  }

  // 🛡️ Trần tổng thời gian cho CẢ CHUỖI self-chain (không phải 1 lần gọi).
  // Nếu 1 page kẹt mãi (lỗi lặp lại, không tiến được), chuỗi có thể tự gọi lại vô
  // hạn qua waitUntil — mỗi vòng ~200s CPU, rất tốn Fluid Active CPU. Chặn cứng ở đây.
  const MAX_TOTAL_RUNTIME_MS = 30 * 60 * 1000; // 30 phút kể từ lần đầu job này chạy
  if (Date.now() - jobStartedAt.getTime() > MAX_TOTAL_RUNTIME_MS) {
    console.error(`[FullSync] 🛑 Job ${syncId} vượt trần 30 phút — dừng hẳn, không chain tiếp.`);
    await prisma.syncHistory.update({
      where: { id: syncId },
      data: {
        status: "failed",
        completedAt: new Date(),
        resumeData: undefined,
        progressSnapshot: { isRunning: false },
        errors: ["Full sync vượt trần 30 phút tổng thời gian — dừng để tránh lặp vô hạn"],
      },
    });
    return Response.json({ success: false, status: "aborted_max_runtime" });
  }

  const runStats: SyncStats = {
    pages: { upserted: 0, skipped: 0 },
    conversations: { upserted: 0, skipped: 0 },
    messages: { upserted: 0, skipped: 0 },
    slaChecked: 0,
    errors: [],
  };

  const startTime = Date.now();
  // 200s (không phải 240s): chừa biên ~100s dưới maxDuration 300s. Một batch lỡ bắt
  // đầu sát ngưỡng vẫn còn đủ chỗ cho getConversations + 1 hội thoại nặng trước 300s.
  const TIME_LIMIT_MS = 200_000;
  let timedOut = false;

  // Lọc pages chưa xong
  const pendingPages = pages.filter((p) => !resume.donePageIds.includes(p.id));
  let pageIndex = pages.length - pendingPages.length; // để hiện progress đúng

  for (const page of pendingPages) {
    if (Date.now() - startTime >= TIME_LIMIT_MS) {
      timedOut = true;
      // Lưu vị trí hiện tại (bắt đầu page này từ đầu lần sau)
      await saveState(syncId, resume, null, page.id, null, pages.length, pageIndex, page.name, runStats);
      break;
    }

    pageIndex++;
    console.log(`[FullSync] 📄 Page ${pageIndex}/${pages.length}: ${page.name}`);

    await prisma.syncHistory.update({
      where: { id: syncId },
      data: {
        progressSnapshot: {
          isRunning: true,
          totalPages: pages.length,
          currentPageIndex: pageIndex,
          currentPageName: page.name,
          conversations: resume.totals.conversations + runStats.conversations.upserted,
          messages: resume.totals.messages + runStats.messages.upserted,
          slaChecked: resume.totals.slaChecked + runStats.slaChecked,
        },
      },
    });

    try {
      const pageAccessToken = await ensurePageAndGetToken(page, runStats);

      // Nếu đây là page đang dở dang, dùng cursor đã lưu
      let cursor = (page.id === resume.currentPageId) ? (resume.currentCursor ?? undefined) : undefined;

      do {
        if (Date.now() - startTime >= TIME_LIMIT_MS) {
          timedOut = true;
          await saveState(syncId, resume, runStats, page.id, cursor ?? null, pages.length, pageIndex, page.name, runStats);
          break;
        }

        const { nextCursor } = await syncConversationBatch(page.id, pageAccessToken, runStats, cursor, undefined, 1, false, startTime + TIME_LIMIT_MS);
        cursor = nextCursor ?? undefined;
        if (cursor) await new Promise((r) => setTimeout(r, 800));
      } while (cursor && !timedOut);

    } catch (err) {
      runStats.errors.push(`Page ${page.id} (${page.name}): ${String(err)}`);
    }

    if (timedOut) break;

    // Page hoàn tất
    resume.donePageIds.push(page.id);
    resume.currentPageId = null;
    resume.currentCursor = null;

    await new Promise((r) => setTimeout(r, 1000));
  }

  if (timedOut) {
    // 🛡️ Kiểm tra lại trạng thái TRƯỚC khi tự gọi lại: nếu record đã bị hủy
    // (vd nút Reset / DELETE /api/sync) thì DỪNG HẲN — không chain tiếp. Nếu không
    // check, việc "Reset" chỉ đổi status trong DB mà chain vẫn tự gọi lại và (do
    // không còn tìm thấy record 'running') sẽ hiểu nhầm thành khởi động job MỚI.
    const current = await prisma.syncHistory.findUnique({
      where: { id: syncId },
      select: { status: true },
    });
    if (current?.status !== "running") {
      console.log(`[FullSync] ⛔ Job ${syncId} đã bị hủy (status=${current?.status}) — dừng, không chain tiếp.`);
      return Response.json({ success: true, status: "stopped_cancelled" });
    }

    const baseUrl = (process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "");
    console.log(`[FullSync] ⏱️ Timed out — chaining next run via ${baseUrl}/api/sync/full-run`);

    waitUntil(
      fetch(`${baseUrl}/api/sync/full-run`, {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
      }).catch((err) => console.error("[FullSync] Chain failed:", err))
    );

    return Response.json({ success: true, status: "continuing", stats: runStats.errors });
  }

  // Xong toàn bộ
  const finalTotals = {
    conversations: resume.totals.conversations + runStats.conversations.upserted,
    messages: resume.totals.messages + runStats.messages.upserted,
    slaChecked: resume.totals.slaChecked + runStats.slaChecked,
    pages: resume.totals.pages + runStats.pages.upserted,
  };

  await prisma.syncHistory.update({
    where: { id: syncId },
    data: {
      status: runStats.errors.length > 0 ? "failed" : "success",
      completedAt: new Date(),
      resumeData: undefined,
      progressSnapshot: { isRunning: false },
      pagesCount: finalTotals.pages,
      conversationsCount: finalTotals.conversations,
      messagesCount: finalTotals.messages,
      slaChecked: finalTotals.slaChecked,
      errors: runStats.errors.length > 0 ? runStats.errors : undefined,
    },
  });

  console.log("[FullSync] ✅ Completed!", finalTotals);
  return Response.json({ success: true, status: "completed", totals: finalTotals });
}

async function saveState(
  syncId: string,
  resume: ResumeData,
  runStats: SyncStats | null,
  currentPageId: string,
  currentCursor: string | null,
  totalPages: number,
  pageIndex: number,
  pageName: string,
  currentRunStats: SyncStats
) {
  const updatedTotals = {
    conversations: resume.totals.conversations + currentRunStats.conversations.upserted,
    messages: resume.totals.messages + currentRunStats.messages.upserted,
    slaChecked: resume.totals.slaChecked + currentRunStats.slaChecked,
    pages: resume.totals.pages + currentRunStats.pages.upserted,
  };

  await prisma.syncHistory.update({
    where: { id: syncId },
    data: {
      resumeData: {
        donePageIds: resume.donePageIds,
        currentPageId,
        currentCursor,
        totals: updatedTotals,
      } satisfies ResumeData,
      progressSnapshot: {
        isRunning: true,
        totalPages,
        currentPageIndex: pageIndex,
        currentPageName: pageName,
        conversations: updatedTotals.conversations,
        messages: updatedTotals.messages,
        slaChecked: updatedTotals.slaChecked,
      },
    },
  });
}
