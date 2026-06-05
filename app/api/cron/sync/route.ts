// ============================================================
// GET /api/cron/sync — Vercel Cron Job endpoint (23:59 VN daily)
// Protected by CRON_SECRET header set in vercel.json
// ============================================================

import { syncAllPages } from "@/lib/services/sync";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 phút timeout

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Bỏ qua nếu có sync đang chạy (không stale)
  const STALE_THRESHOLD_MS = 30 * 60 * 1000;
  const running = await prisma.syncHistory.findFirst({
    where: { status: "running" },
    orderBy: { startedAt: "desc" },
  });
  if (running) {
    const age = Date.now() - new Date(running.startedAt).getTime();
    if (age < STALE_THRESHOLD_MS) {
      return Response.json({ success: false, reason: "Sync already running" });
    }
    await prisma.syncHistory.update({
      where: { id: running.id },
      data: { status: "cancelled", completedAt: new Date() },
    });
  }

  try {
    const stats = await syncAllPages();
    return Response.json({ success: true, stats });
  } catch (err) {
    console.error("[Cron/Sync] Failed:", err);
    return Response.json({ success: false, error: String(err) }, { status: 500 });
  }
}
