// ============================================================
// POST /api/sla/recalculate-all — Tính lại SLA cho TOÀN BỘ conversation
// trong DB (dùng messages đã lưu, KHÔNG gọi Pancake API).
//
// Dùng để áp logic SLA mới ("đo lượt mới nhất") cho dữ liệu lịch sử mà
// không cần force sync lại. Tags KHÔNG được điền ở đây — tags chỉ có qua sync.
//
// Xử lý theo batch + deadline để tránh timeout. Lặp lại với ?cursor=<nextCursor>
// cho tới khi { done: true }.
// ============================================================

import { prisma } from "@/lib/prisma";
import { calculateSLAForConversation } from "@/lib/services/sla";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get("cursor") ?? undefined;
    const batchSize = Math.min(Number(searchParams.get("limit") ?? 1000) || 1000, 5000);
    // Chừa buffer để response kịp trả về trước maxDuration
    const deadline = Date.now() + 250_000;

    const convs = await prisma.conversation.findMany({
      where: cursor ? { id: { gt: cursor } } : {},
      orderBy: { id: "asc" },
      take: batchSize,
      select: { id: true, pageId: true },
    });

    let processed = 0;
    let lastId: string | undefined;
    const errors: string[] = [];

    for (const c of convs) {
      if (Date.now() > deadline) break;
      try {
        await calculateSLAForConversation(c.id, c.pageId);
        processed++;
      } catch (err) {
        errors.push(`${c.id}: ${String(err)}`);
      }
      lastId = c.id; // advance cursor kể cả khi lỗi để không kẹt
    }

    // done khi: đã lấy hết batch (ít hơn batchSize) VÀ xử lý hết những gì lấy được
    const exhausted = convs.length < batchSize;
    const finishedBatch = processed + errors.length === convs.length;
    const done = exhausted && finishedBatch;
    const nextCursor = done ? null : lastId ?? cursor ?? null;

    return Response.json({
      success: true,
      processed,
      errorCount: errors.length,
      errors: errors.slice(0, 20),
      nextCursor,
      done,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
