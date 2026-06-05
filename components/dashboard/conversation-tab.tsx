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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-zinc-100 animate-pulse" />
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
      color: "text-blue-600",
      bg: "bg-blue-50",
      border: "border-blue-100",
    },
    {
      label: t.conversations.statPending,
      value: pending.toLocaleString("en-US"),
      icon: Clock,
      color: "text-amber-600",
      bg: "bg-amber-50",
      border: "border-amber-100",
    },
    {
      label: t.conversations.lateWorkingHours,
      value: `${(stats?.lateWorkingHours ?? 0).toLocaleString("en-US")} / ${(stats?.totalWorkingHours ?? 0).toLocaleString("en-US")}`,
      icon: Sun,
      color: "text-orange-600",
      bg: "bg-orange-50",
      border: "border-orange-100",
    },
    {
      label: t.conversations.lateAfterHours,
      value: `${(stats?.lateAfterHours ?? 0).toLocaleString("en-US")} / ${(stats?.totalAfterHours ?? 0).toLocaleString("en-US")}`,
      icon: Moon,
      color: "text-indigo-600",
      bg: "bg-indigo-50",
      border: "border-indigo-100",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map(({ label, value, icon: Icon, color, bg, border }) => (
        <div key={label} className={`rounded-xl border ${border} ${bg} px-4 py-3 flex items-center gap-3`}>
          <div className={`p-2 rounded-lg bg-white/60 shrink-0 ${color}`}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-zinc-500 font-medium truncate">{label}</p>
            <p className={`text-xl font-bold ${color}`}>{value}</p>
          </div>
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
  dateFrom: string;
  dateTo: string;
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
  customerMessageAt: string | null;
  adminReplyAt: string | null;
  conversationType: string;
  outsideBusinessHours: boolean;
}

export interface ConversationTabProps {
  conversationType: "INBOX" | "COMMENT";
  initialPageId?: string;
  initialSlaStatus?: string;
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
  const headers = ["Customer", "Username", "Page", "Platform", "SLA Status", "Response Time (min)", "Last Message", "Customer Msg Time", "CS Reply Time"];
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
    dateFrom: "",
    dateTo: "",
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
      if (f.dateFrom) params.set("dateFrom", f.dateFrom);
      if (f.dateTo) params.set("dateTo", f.dateTo);
      const res = await fetch(`/api/dashboard/conversation-stats?${params}`);
      const json = await res.json();
      if (json.success) setTypeStats(json.stats);
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    } finally {
      setStatsLoading(false);
    }
  }, [conversationType]);

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
  }, [filters.pageId, filters.platform, filters.dateFrom, filters.dateTo]);

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
      if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
      if (filters.dateTo) params.set("dateTo", filters.dateTo);
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
  }, [conversationType, filters, tablePage, tablePageSize, tableSortBy, tableSortOrder]);

  useEffect(() => {
    setTablePage(1);
    fetchTable();
  }, [filters]);

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
      if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
      if (filters.dateTo) params.set("dateTo", filters.dateTo);
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
  }, [exporting, conversationType, filters, tableSortBy, tableSortOrder]);

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
