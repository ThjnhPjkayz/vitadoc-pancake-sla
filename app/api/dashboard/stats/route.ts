// GET /api/dashboard/stats — Dashboard overview statistics

import { getDashboardStats } from "@/lib/services/dashboard";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pageId = searchParams.get("pageId") ?? undefined;

  try {
    const stats = await getDashboardStats(pageId);
    return Response.json({ success: true, stats });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
