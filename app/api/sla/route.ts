// ============================================================
// GET /api/sla — Báo cáo SLA tổng quan
// GET /api/sla?pageId=xxx — SLA cho 1 page
// POST /api/sla/recalculate-outbound — Fix data cũ: pending → outbound
// ============================================================

import { prisma } from "@/lib/prisma";
import { getSLASummary } from "@/lib/services/sla";

export const dynamic = "force-dynamic";

// Fix existing "pending" records that are actually outbound (CS sent first, no customer reply)
export async function POST() {
  try {
    const result = await prisma.$executeRaw`
      UPDATE "SLAViolation" sv
      SET "slaStatus" = 'outbound'
      WHERE sv."slaStatus" = 'pending'
        AND sv."customerMessageId" = ''
        AND EXISTS (
          SELECT 1 FROM "Message" m
          WHERE m."conversationId" = sv."conversationId"
            AND m."isFromAdmin" = true
        )
    `;
    return Response.json({ success: true, updated: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pageId = searchParams.get("pageId");

  try {
    // SLA cho 1 page cụ thể
    if (pageId) {
      const violations = await prisma.sLAViolation.findMany({
        where: { pageId },
        include: {
          conversation: {
            select: { customerName: true, customerUsername: true, type: true },
          },
        },
        orderBy: { customerMessageAt: "desc" },
        take: 100,
      });

      const pageInfo = await prisma.page.findUnique({
        where: { id: pageId },
        select: { name: true, platform: true },
      });

      return Response.json({
        success: true,
        page: pageInfo,
        total: violations.length,
        lateCount: violations.filter((v) => v.isLateReply).length,
        violations,
      });
    }

    // SLA tổng quan
    const summary = await getSLASummary();
    return Response.json({ success: true, ...summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
