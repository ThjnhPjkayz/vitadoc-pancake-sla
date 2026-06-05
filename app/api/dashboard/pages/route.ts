// GET /api/dashboard/pages — Page SLA leaderboard

import { getPageSummaries } from "@/lib/services/dashboard";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const period = req.nextUrl.searchParams.get("period") ?? "all";
    const now = new Date();
    let dateFrom: Date | undefined;
    if (period === "7d") dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    else if (period === "30d") dateFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    else if (period === "month") dateFrom = new Date(now.getFullYear(), now.getMonth(), 1);

    const pages = await getPageSummaries(dateFrom);
    return Response.json({ success: true, pages });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
