// GET /api/dashboard/violations-trend — SLA violations trend (last 7 days)

import { getViolationsTrend } from "@/lib/services/dashboard";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pageId = searchParams.get("pageId") ?? undefined;

  try {
    const trend = await getViolationsTrend(pageId);
    return Response.json({ success: true, trend });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
