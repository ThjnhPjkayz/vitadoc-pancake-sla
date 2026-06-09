// GET /api/dashboard/violations-trend — SLA violations trend

import { getViolationsTrend, getViolationsTrendHourly, getViolationsTrendForRange } from "@/lib/services/dashboard";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pageId = searchParams.get("pageId") ?? undefined;
  const period = searchParams.get("period") ?? "yesterday";
  const from   = searchParams.get("from");
  const to     = searchParams.get("to");

  try {
    let trend;
    if (period === "custom" && from && to) {
      const dateFrom = new Date(from);
      const dateTo = new Date(new Date(to).getTime() + 86_400_000);
      trend = await getViolationsTrendForRange(dateFrom, dateTo, pageId);
    } else if (period === "yesterday") {
      trend = await getViolationsTrendHourly(pageId);
    } else if (period === "7d") {
      trend = await getViolationsTrend(7, pageId);
    } else {
      trend = await getViolationsTrend(30, pageId);
    }
    return Response.json({ success: true, trend });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
