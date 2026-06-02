// ============================================================
// POST /api/sync — Trigger sync from Pancake
// GET  /api/sync?history=true — Lấy lịch sử sync
// ============================================================

import { syncAllPages } from "@/lib/services/sync";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    // Lấy thời gian sync gần nhất để chỉ sync dữ liệu mới
    const lastSync = await prisma.syncHistory.findFirst({
      where: { status: "success" },
      orderBy: { startedAt: "desc" },
      select: { startedAt: true },
    });

    // Dùng startedAt trừ 2 phút buffer để không bỏ sót conv được update trong lúc sync đang chạy
    const since = lastSync?.startedAt
      ? new Date(lastSync.startedAt.getTime() - 2 * 60 * 1000)
      : undefined;
    const stats = await syncAllPages(since);
    return Response.json({ success: true, stats, since: since?.toISOString() ?? null }, { status: 200 });
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

      // Lấy sync gần nhất thành công
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

  // Trạng thái sync gần nhất
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
    },
  });

  return Response.json({
    success: true,
    lastSync: lastSync ?? null,
  });
}
