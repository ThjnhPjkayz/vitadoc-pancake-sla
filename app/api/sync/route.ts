// ============================================================
// POST   /api/sync — Trigger manual sync từ Pancake
// DELETE /api/sync — Cancel sync đang chạy
// GET    /api/sync?history=true — Lấy lịch sử sync
// ============================================================

import { waitUntil } from "@vercel/functions";
import { syncAllPages } from "@/lib/services/sync";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "development") {
    return Response.json({ success: false, error: "Sync bị tắt trên môi trường local" }, { status: 403 });
  }
  // Kiểm tra có sync nào đang chạy không (bỏ qua nếu stale > 30 phút)
  const STALE_THRESHOLD_MS = 30 * 60 * 1000;
  const running = await prisma.syncHistory.findFirst({
    where: { status: "running" },
    select: { id: true, startedAt: true },
  });

  if (running) {
    const isStale = Date.now() - running.startedAt.getTime() > STALE_THRESHOLD_MS;
    if (isStale) {
      await prisma.syncHistory.update({
        where: { id: running.id },
        data: { status: "failed", completedAt: new Date() },
      });
    } else {
      return Response.json({ success: false, error: "Sync đang chạy" }, { status: 409 });
    }
  }

  const force = new URL(request.url).searchParams.get("force") === "true";

  // Giữ function sống đến khi sync xong (Vercel waitUntil)
  waitUntil(syncAllPages(force).catch((err) =>
    console.error("[Sync] Background sync failed:", err)
  ));

  return Response.json({ success: true, started: true });
}

export async function DELETE() {
  try {
    const running = await prisma.syncHistory.findFirst({
      where: { status: "running" },
      select: { id: true },
    });

    if (!running) {
      return Response.json({ success: false, error: "Không có sync nào đang chạy" }, { status: 404 });
    }

    await prisma.syncHistory.update({
      where: { id: running.id },
      data: { status: "cancelled" },
    });

    return Response.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  // Lấy lịch sử sync
  if (searchParams.get("history") === "true") {
    try {
      const history = await prisma.syncHistory.findMany({
        orderBy: { startedAt: "desc" },
        take: 20,
        select: {
          id: true,
          startedAt: true,
          completedAt: true,
          status: true,
          pagesCount: true,
          conversationsCount: true,
          messagesCount: true,
          slaChecked: true,
          errors: true,
        },
      });

      const lastSuccess = await prisma.syncHistory.findFirst({
        where: { status: "success" },
        orderBy: { completedAt: "desc" },
        select: { completedAt: true },
      });

      return Response.json({
        success: true,
        history,
        lastSyncAt: lastSuccess?.completedAt ?? null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return Response.json({ success: false, error: message }, { status: 500 });
    }
  }

  // Trạng thái sync gần nhất + progress từ DB
  const lastSync = await prisma.syncHistory.findFirst({
    orderBy: { startedAt: "desc" },
    select: {
      id: true,
      startedAt: true,
      completedAt: true,
      status: true,
      pagesCount: true,
      conversationsCount: true,
      messagesCount: true,
      progressSnapshot: true,
    },
  });

  const progress = lastSync?.status === "running" && lastSync.progressSnapshot
    ? lastSync.progressSnapshot
    : { isRunning: false };

  return Response.json({
    success: true,
    lastSync: lastSync ?? null,
    progress,
  });
}
