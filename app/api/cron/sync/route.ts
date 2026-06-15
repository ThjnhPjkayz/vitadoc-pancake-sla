// ============================================================
// GET /api/cron/sync — Vercel Cron Job endpoint (23:59 VN daily)
// Protected by CRON_SECRET header set in vercel.json
//
// Khởi động chuỗi full-run self-chaining (/api/sync/full-run) thay vì
// chạy syncAllPages monolithic — để sync không bị cắt ở giới hạn 300s
// khi data lớn. full-run chạy 240s/slice, lưu cursor, tự gọi lại đến khi xong.
// ============================================================

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // đủ để chờ slice đầu của full-run (240s) trả về

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Bỏ qua nếu có sync đang chạy (chưa stale) — tránh chạy chồng
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
    // Stale → đánh dấu hủy để full-run bắt đầu job mới
    await prisma.syncHistory.update({
      where: { id: running.id },
      data: { status: "cancelled", completedAt: new Date() },
    });
  }

  // Gọi slice đầu của full-run. full-run sẽ tự self-chain (waitUntil) cho các
  // slice tiếp theo, nên ở đây chỉ cần chờ slice đầu trả về là xong.
  const baseUrl = (process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "");
  try {
    const res = await fetch(`${baseUrl}/api/sync/full-run`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    });
    const data = await res.json().catch(() => ({}));
    return Response.json({ success: true, status: "started", fullRun: data });
  } catch (err) {
    console.error("[Cron/Sync] Failed to start full-run:", err);
    return Response.json({ success: false, error: String(err) }, { status: 500 });
  }
}
