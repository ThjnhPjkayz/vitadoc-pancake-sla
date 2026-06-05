// GET /api/dashboard/conversations — Filtered, paginated conversation list

import {
  getConversations,
  getFilterOptions,
} from "@/lib/services/dashboard";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  try {
    if (searchParams.get("options") === "true") {
      const options = await getFilterOptions();
      return Response.json({ success: true, options });
    }

    const slaStatusRaw = searchParams.get("slaStatus");
    const validStatuses = ["on-time", "late", "no-reply", "needs-attention", "outbound"];
    const slaStatus = validStatuses.includes(slaStatusRaw ?? "")
      ? (slaStatusRaw as "on-time" | "late" | "no-reply" | "needs-attention" | "outbound")
      : undefined;

    const hoursRaw = searchParams.get("hoursFilter");
    const hoursFilter = hoursRaw === "in-hours" || hoursRaw === "after-hours"
      ? hoursRaw
      : undefined;

    const typeRaw = searchParams.get("conversationType");
    const conversationType =
      typeRaw === "INBOX" || typeRaw === "COMMENT" ? typeRaw : undefined;

    const result = await getConversations({
      search: searchParams.get("search") ?? undefined,
      pageId: searchParams.get("pageId") ?? undefined,
      platform: searchParams.get("platform") ?? undefined,
      conversationType,
      slaStatus,
      hoursFilter,
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
