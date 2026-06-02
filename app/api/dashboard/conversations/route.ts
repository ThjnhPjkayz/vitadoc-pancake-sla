// GET /api/dashboard/conversations — Filtered, paginated conversation list

import {
  getConversations,
  getFilterOptions,
} from "@/lib/services/dashboard";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  try {
    // Nếu có ?options=true → trả về filter options
    if (searchParams.get("options") === "true") {
      const options = await getFilterOptions();
      return Response.json({ success: true, options });
    }

    // Ngược lại → trả về conversations
    const result = await getConversations({
      search: searchParams.get("search") ?? undefined,
      pageId: searchParams.get("pageId") ?? undefined,
      platform: searchParams.get("platform") ?? undefined,
      slaStatus:
        (searchParams.get("slaStatus") as
          | "on-time"
          | "late"
          | "no-reply") ?? undefined,
      dateFrom: searchParams.get("dateFrom") ?? undefined,
      dateTo: searchParams.get("dateTo") ?? undefined,
      page: Number(searchParams.get("page")) || 1,
      pageSize: Number(searchParams.get("pageSize")) || 20,
      sortBy:
        (searchParams.get("sortBy") as
          | "customerMessageAt"
          | "responseTimeMinutes"
          | "customerName") ?? "customerMessageAt",
      sortOrder:
        (searchParams.get("sortOrder") as "asc" | "desc") ?? "desc",
    });

    return Response.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
