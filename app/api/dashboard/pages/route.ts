// GET /api/dashboard/pages — Page SLA leaderboard

import { getPageSummaries } from "@/lib/services/dashboard";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

function getVnDayBoundary(daysAgo: number): Date {
  const VN_OFFSET_MS = 7 * 3_600_000;
  const vnNow = Date.now() + VN_OFFSET_MS;
  const vnMidnightToday = vnNow - (vnNow % 86_400_000);
  return new Date(vnMidnightToday - daysAgo * 86_400_000 - VN_OFFSET_MS);
}

export async function GET(req: NextRequest) {
  try {
    const period = req.nextUrl.searchParams.get("period") ?? "yesterday";
    let dateFrom: Date | undefined;
    let dateTo: Date | undefined;

    const from = req.nextUrl.searchParams.get("from");
    const to   = req.nextUrl.searchParams.get("to");

    if (period === "custom" && from && to) {
      dateFrom = new Date(from);
      dateTo   = new Date(new Date(to).getTime() + 86_400_000);
    } else if (period === "yesterday") {
      dateFrom = getVnDayBoundary(1);
      dateTo   = getVnDayBoundary(0);
    } else if (period === "7d") {
      dateFrom = getVnDayBoundary(7);
      dateTo   = getVnDayBoundary(0);
    } else if (period === "30d") {
      dateFrom = getVnDayBoundary(30);
      dateTo   = getVnDayBoundary(0);
    }

    const pages = await getPageSummaries(dateFrom, dateTo);
    return Response.json({ success: true, pages });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
