// GET /api/dashboard/response-time-trend — Avg response time per day

import { getResponseTimeTrend } from "@/lib/services/dashboard";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pageId = searchParams.get("pageId") ?? undefined;
  const days = Math.min(30, Math.max(7, Number(searchParams.get("days") ?? 30)));

  try {
    const trend = await getResponseTimeTrend(days, pageId);
    return Response.json({ success: true, trend });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
