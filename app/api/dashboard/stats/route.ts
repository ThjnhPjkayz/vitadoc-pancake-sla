// GET /api/dashboard/stats — Dashboard overview statistics

import { getDashboardStats, getPeriodComparison, getStatsForDateRange } from "@/lib/services/dashboard";
import type { PeriodKey } from "@/lib/services/dashboard";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pageId = searchParams.get("pageId") ?? undefined;
  const period = searchParams.get("period") ?? "yesterday";
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  try {
    if (period === "custom" && from && to) {
      const dateFrom = new Date(from);
      const dateTo = new Date(new Date(to).getTime() + 86_400_000);
      const [stats, current] = await Promise.all([
        getDashboardStats(pageId),
        getStatsForDateRange(dateFrom, dateTo, pageId),
      ]);
      return Response.json({ success: true, stats, comparison: { current, prev: null } });
    }

    const [stats, comparison] = await Promise.all([
      getDashboardStats(pageId),
      getPeriodComparison(period as PeriodKey, pageId),
    ]);
    return Response.json({ success: true, stats, comparison });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
