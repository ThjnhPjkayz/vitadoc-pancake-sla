"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Download, Sun, Moon, MessageSquare, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import FiltersBar from "@/components/dashboard/filters-bar";
import ConversationsTable from "@/components/dashboard/conversations-table";

// ----------------------------------------------------------------
// Stat Cards
// ----------------------------------------------------------------

interface TypeStats {
  lateWorkingHours: number;
  totalWorkingHours: number;
  lateAfterHours: number;
  totalAfterHours: number;
  pending: number;
  total: number;
}

function StatCards({ stats, loading }: { stats: TypeStats | null; loading: boolean }) {
  const { t } = useI18n();

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-zinc-100 animate-pulse" />
        ))}
      </div>
    );
  }

  const total = stats?.total ?? 0;
  const pending = stats?.pending ?? 0;

  const cards = [
    {
      label: t.conversations.statTotal,
      value: total.toLocaleString("en-US"),
      icon: MessageSquare,
      iconColor: "text-blue-600",
      iconBg: "bg-blue-50",
      accent: "#2563eb",
      isRatio: false,
    },
    {
      label: t.conversations.statPending,
      value: pending.toLocaleString("en-US"),
      icon: Clock,
      iconColor: "text-amber-600",
      iconBg: "bg-amber-50",
      accent: "#d97706",
      isRatio: false,
    },
    {
      label: t.conversations.lateWorkingHours,
      value: `${(stats?.lateWorkingHours ?? 0).toLocaleString("en-US")} / ${(stats?.totalWorkingHours ?? 0).toLocaleString("en-US")}`,
      icon: Sun,
      iconColor: "text-orange-600",
      iconBg: "bg-orange-50",
      accent: "#ea580c",
      isRatio: true,
    },
    {
      label: t.conversations.lateAfterHours,
      value: `${(stats?.lateAfterHours ?? 0).toLocaleString("en-US")} / ${(stats?.totalAfterHours ?? 0).toLocaleString("en-US")}`,
      icon: Moon,
      iconColor: "text-indigo-600",
      iconBg: "bg-indigo-50",
      accent: "#4f46e5",
      isRatio: true,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map(({ label, value, icon: Icon, iconColor, iconBg, accent, isRatio }) => (
        <div
          key={label}
          className="relative bg-card rounded-xl ring-1 ring-foreground/10 px-5 py-4 hover:shadow-md transition-all overflow-hidden"
        >
          <span
            className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
            style={{ background: accent }}
          />
          <div className="flex items-start justify-between gap-2 mb-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground leading-tight">
              {label}
            </p>
            <div className={`shrink-0 p-1.5 rounded-md ${iconBg}`}>
              <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
            </div>
          </div>
          <p className={`font-bold tracking-tight tabular-nums leading-none ${isRatio ? "text-xl" : "text-3xl"}`}>
            {value}
          </p>
        </div>
      ))}
    </div>
  );
}

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

interface FilterState {
  search: string;
  pageId: string;
  platform: string;
  slaStatus: string;
  hoursFilter: string;
}

interface FilterOption {
  id: string;
  name: string;
  platform: string;
}

interface ConversationRow {
  id: string;
  customerName: string | null;
  customerUsername: string | null;
  pageName: string;
  platform: string;
  pageId: string;
  lastMessage: string | null;
  responseTimeMinutes: number | null;
  isLateReply: boolean;
  hasReply: boolean;
  isOutbound: boolean;
  tags: string[];
  customerMessageAt: string | null;
  adminReplyAt: string | null;
  conversationType: string;
  outsideBusinessHours: boolean;
}

export interface ConversationTabProps {
  conversationType: "INBOX" | "COMMENT";
  initialPageId?: string;
  initialSlaStatus?: string;
  dateFrom?: string;
  dateTo?: string;
}

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

function exportToCSV(
  rows: ConversationRow[],
  filename: string,
  statusLabels: { outbound: string; noReply: string; late: string; onTime: string },
  dateLocale: string
) {
  const PLATFORM_LABELS: Record<string, string> = {
    tiktok: "TikTok",
    facebook: "Facebook",
    personal_zalo: "Zalo",
    tiktok_business_messaging: "TT Biz",
  };
  const headers = ["Customer", "Username", "Page", "Platform", "SLA Status", "Response Time (min)", "Tags", "Last Message", "Customer Msg Time", "CS Reply Time"];
  const csvRows = [
    headers.join(","),
    ...rows.map((row) =>
      [
        `"${(row.customerName ?? "").replace(/"/g, '""')}"`,
        `"${(row.customerUsername ?? "").replace(/"/g, '""')}"`,
        `"${row.pageName.replace(/"/g, '""')}"`,
        PLATFORM_LABELS[row.platform] ?? row.platform,
        row.isOutbound ? statusLabels.outbound : !row.hasReply ? statusLabels.noReply : row.isLateReply ? statusLabels.late : statusLabels.onTime,
        row.responseTimeMinutes ?? "",
        `"${(row.tags ?? []).join("; ").replace(/"/g, '""')}"`,
        `"${(row.lastMessage ?? "").replace(/"/g, '""')}"`,
        row.customerMessageAt ? new Date(row.customerMessageAt).toLocaleString(dateLocale) : "",
        row.adminReplyAt ? new Date(row.adminReplyAt).toLocaleString(dateLocale) : "",
      ].join(",")
    ),
  ];
  const blob = new Blob(["﻿" + csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// ----------------------------------------------------------------
// Component
// ----------------------------------------------------------------

export default function ConversationTab({
  conversationType,
  initialPageId = "",
  initialSlaStatus = "",
  dateFrom = "",
  dateTo = "",
}: ConversationTabProps) {
  const { t, locale } = useI18n();

  const [typeStats, setTypeStats] = useState<TypeStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const [filterOptions, setFilterOptions] = useState<{ pages: FilterOption[]; platforms: string[] }>({
    pages: [],
    platforms: [],
  });
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    pageId: initialPageId,
    platform: "",
    slaStatus: initialSlaStatus,
    hoursFilter: "",
  });
  const [tableData, setTableData] = useState<ConversationRow[]>([]);
  const [tableTotal, setTableTotal] = useState(0);
  const [tablePage, setTablePage] = useState(1);
  const [tablePageSize, setTablePageSize] = useState(20);
  const [tableTotalPages, setTableTotalPages] = useState(0);
  const [tableSortBy, setTableSortBy] = useState("customerMessageAt");
  const [tableSortOrder, setTableSortOrder] = useState("desc");
  const [tableLoading, setTableLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const fetchStats = useCallback(async (f: FilterState) => {
    setStatsLoading(true);
    try {
      const params = new URLSearchParams({ type: conversationType });
      if (f.pageId) params.set("pageId", f.pageId);
      if (f.platform) params.set("platform", f.platform);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      const res = await fetch(`/api/dashboard/conversation-stats?${params}`);
      const json = await res.json();
      if (json.success) setTypeStats(json.stats);
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    } finally {
      setStatsLoading(false);
    }
  }, [conversationType, dateFrom, dateTo]);

  const isFirstRender = useRef(true);

  useEffect(() => {
    fetch("/api/dashboard/conversations?options=true")
      .then((r) => r.json())
      .then((json) => { if (json.success) setFilterOptions(json.options); })
      .catch(console.error);
    fetchStats(filters);
  }, [conversationType]);

  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    fetchStats(filters);
  }, [filters.pageId, filters.platform, dateFrom, dateTo]);

  const fetchTable = useCallback(async () => {
    setTableLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("conversationType", conversationType);
      if (filters.search) params.set("search", filters.search);
      if (filters.pageId) params.set("pageId", filters.pageId);
      if (filters.platform) params.set("platform", filters.platform);
      if (filters.slaStatus) params.set("slaStatus", filters.slaStatus);
      if (filters.hoursFilter) params.set("hoursFilter", filters.hoursFilter);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      params.set("page", String(tablePage));
      params.set("pageSize", String(tablePageSize));
      params.set("sortBy", tableSortBy);
      params.set("sortOrder", tableSortOrder);

      const res = await fetch(`/api/dashboard/conversations?${params}`);
      const json = await res.json();
      if (json.success) {
        setTableData(json.data);
        setTableTotal(json.total);
        setTableTotalPages(json.totalPages);
      }
    } catch (err) {
      console.error("Failed to fetch table:", err);
    } finally {
      setTableLoading(false);
    }
  }, [conversationType, filters, dateFrom, dateTo, tablePage, tablePageSize, tableSortBy, tableSortOrder]);

  useEffect(() => {
    setTablePage(1);
    fetchTable();
  }, [filters, dateFrom, dateTo]);

  useEffect(() => {
    fetchTable();
  }, [tablePage, tablePageSize, tableSortBy, tableSortOrder]);

  const handleExport = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const params = new URLSearchParams();
      params.set("conversationType", conversationType);
      if (filters.search) params.set("search", filters.search);
      if (filters.pageId) params.set("pageId", filters.pageId);
      if (filters.platform) params.set("platform", filters.platform);
      if (filters.slaStatus) params.set("slaStatus", filters.slaStatus);
      if (filters.hoursFilter) params.set("hoursFilter", filters.hoursFilter);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      params.set("page", "1");
      params.set("pageSize", "9999");
      params.set("sortBy", tableSortBy);
      params.set("sortOrder", tableSortOrder);

      const res = await fetch(`/api/dashboard/conversations?${params}`);
      const json = await res.json();
      if (!json.success) return;

      const date = new Date().toISOString().slice(0, 10);
      const statusLabels = {
        outbound: t.table.status.outbound,
        noReply: t.table.status.noReply,
        late: t.table.status.late,
        onTime: t.table.status.onTime,
      };
      const dateLocale = locale === "vi" ? "vi-VN" : "en-US";
      exportToCSV(json.data as ConversationRow[], `sla-${conversationType.toLowerCase()}-${date}.csv`, statusLabels, dateLocale);
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExporting(false);
    }
  }, [exporting, conversationType, filters, dateFrom, dateTo, tableSortBy, tableSortOrder]);

  return (
    <div className="space-y-4">
      <StatCards stats={typeStats} loading={statsLoading} />

      <div className="flex items-center justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={exporting || tableTotal === 0}
        >
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {t.conversations.exportCSV}
        </Button>
      </div>

      <FiltersBar
        filters={filters}
        onFilterChange={(f) => { setFilters(f); setTablePage(1); }}
        pages={filterOptions.pages}
        platforms={filterOptions.platforms}
      />

      <ConversationsTable
        data={tableData}
        total={tableTotal}
        page={tablePage}
        pageSize={tablePageSize}
        totalPages={tableTotalPages}
        onPageChange={setTablePage}
        onPageSizeChange={(s) => { setTablePageSize(s); setTablePage(1); }}
        onSortChange={(by, order) => { setTableSortBy(by); setTableSortOrder(order); }}
        loading={tableLoading}
      />
    </div>
  );
}
