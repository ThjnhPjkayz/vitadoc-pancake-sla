// ============================================================
// GET /api/sla — Báo cáo SLA tổng quan
// GET /api/sla?pageId=xxx — SLA cho 1 page
// ============================================================

import { prisma } from "@/lib/prisma";
import { getSLASummary } from "@/lib/services/sla";

export const dynamic = "force-dynamic";

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
