// GET /api/dashboard/pages — Page SLA leaderboard

import { getPageSummaries } from "@/lib/services/dashboard";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const pages = await getPageSummaries();
    return Response.json({ success: true, pages });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
