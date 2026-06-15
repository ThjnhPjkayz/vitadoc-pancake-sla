// POST /api/sync/page — Syncs one conversation batch for a page.
// Called repeatedly by the client with cursor until nextCursor === null.

import { prisma } from "@/lib/prisma";
import { ensurePageAndGetToken, syncConversationBatch } from "@/lib/services/sync";
import type { SyncStats } from "@/lib/services/sync";
import type { PancakePage } from "@/lib/types/pancake";

export const dynamic = "force-dynamic";
// 300s như full-run/cron (tài khoản hỗ trợ). Budget xử lý vẫn 30s nên request
// thường trả ~30s; nâng trần này để batch chậm/DB lag không bị cắt ở 60s.
export const maxDuration = 300;

export async function POST(request: Request) {
  const body = await request.json() as {
    syncId: string;
    pageIndex: number;
    totalPages: number;
    page: PancakePage;
    since: string | null;
    conversations: number;
    messages: number;
    slaChecked: number;
    cursor?: string | null;
    force?: boolean;
  };

  const { syncId, pageIndex, totalPages, page, since, conversations = 0, messages = 0, slaChecked = 0, cursor, force = false } = body;

  const record = await prisma.syncHistory.findUnique({
    where: { id: syncId },
    select: { status: true },
  });
  if (!record) {
    return Response.json({ success: false, error: "Sync record not found" }, { status: 404 });
  }
  if (record.status === "cancelled") {
    return Response.json({ success: false, cancelled: true });
  }

  await prisma.syncHistory.update({
    where: { id: syncId },
    data: {
      progressSnapshot: {
        isRunning: true,
        currentPageIndex: pageIndex,
        currentPageName: page.name,
        totalPages,
        conversations,
        messages,
        slaChecked,
      },
    },
  });

  const stats: SyncStats = {
    pages: { upserted: 0, skipped: 0 },
    conversations: { upserted: 0, skipped: 0 },
    messages: { upserted: 0, skipped: 0 },
    slaChecked: 0,
    errors: [],
  };

  try {
    const sinceDate = since ? new Date(since) : undefined;

    // First call (no cursor): upsert page + get token
    // Subsequent calls: read stored token from DB
    let pageAccessToken: string;
    if (!cursor) {
      pageAccessToken = await ensurePageAndGetToken(page, stats);
    } else {
      const dbPage = await prisma.page.findUnique({
        where: { id: page.id },
        select: { pageAccessToken: true },
      });
      if (!dbPage?.pageAccessToken) {
        throw new Error(`No stored token for page ${page.id}`);
      }
      pageAccessToken = dbPage.pageAccessToken;
    }

    // Budget 30s/request để giữ tiến độ mượt + biên an toàn rất lớn dưới maxDuration 300s.
    // Phần dư của page tiếp tục ở request sau (resume bằng cursor).
    const deadline = Date.now() + 30_000;
    const { nextCursor } = await syncConversationBatch(
      page.id,
      pageAccessToken,
      stats,
      cursor ?? undefined,
      sinceDate,
      2,
      force,
      deadline
    );

    return Response.json({ success: true, stats, nextCursor });
  } catch (err) {
    stats.errors.push(`Page ${page.id} (${page.name}): ${String(err)}`);
    return Response.json({ success: true, stats, nextCursor: null });
  }
}
