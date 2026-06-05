// GET /api/dashboard/conversation-stats?type=INBOX|COMMENT&pageId=...&platform=...&dateFrom=...&dateTo=...

import { getConversationTypeStats } from "@/lib/services/dashboard";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const typeRaw = searchParams.get("type");
  const pageId = searchParams.get("pageId") ?? undefined;
  const platform = searchParams.get("platform") ?? undefined;
  const dateFrom = searchParams.get("dateFrom") ?? undefined;
  const dateTo = searchParams.get("dateTo") ?? undefined;

  if (typeRaw !== "INBOX" && typeRaw !== "COMMENT") {
    return Response.json({ success: false, error: "type must be INBOX or COMMENT" }, { status: 400 });
  }

  try {
    const stats = await getConversationTypeStats(typeRaw, pageId, platform, dateFrom, dateTo);
    return Response.json({ success: true, stats });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
