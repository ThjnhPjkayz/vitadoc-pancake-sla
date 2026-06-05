// POST /api/sync/page — Syncs one page. Called once per page by the client loop.

import { prisma } from "@/lib/prisma";
import { syncSinglePage } from "@/lib/services/sync";
import type { SyncStats } from "@/lib/services/sync";
import type { PancakePage } from "@/lib/types/pancake";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const body = await request.json() as {
    syncId: string;
    pageIndex: number;
    totalPages: number;
    page: PancakePage;
    since: string | null;
  };

  const { syncId, pageIndex, totalPages, page, since } = body;

  // Check for cancellation before doing any work
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

  // Update progress so UI polling (page refresh case) can see current page
  await prisma.syncHistory.update({
    where: { id: syncId },
    data: {
      progressSnapshot: {
        isRunning: true,
        currentPageIndex: pageIndex,
        currentPageName: page.name,
        totalPages,
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
    await syncSinglePage(page, stats, sinceDate);
  } catch (err) {
    stats.errors.push(`Page ${page.id} (${page.name}): ${String(err)}`);
  }

  return Response.json({ success: true, stats });
}
