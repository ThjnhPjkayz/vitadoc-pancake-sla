"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Download, Sun, Moon } from "lucide-react";
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
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-zinc-100 animate-pulse" />
        ))}
      </div>
    );
  }

  const cards = [
    {
      label: t.conversations.lateWorkingHours,
      late: stats?.lateWorkingHours ?? 0,
      total: stats?.totalWorkingHours ?? 0,
      icon: Sun,
      color: "text-amber-600",
      bg: "bg-amber-50",
      border: "border-amber-100",
    },
    {
      label: t.conversations.lateAfterHours,
      late: stats?.lateAfterHours ?? 0,
      total: stats?.totalAfterHours ?? 0,
      icon: Moon,
      color: "text-indigo-600",
      bg: "bg-indigo-50",
      border: "border-indigo-100",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4">
      {cards.map(({ label, late, total, icon: Icon, color, bg, border }) => (
        <div key={label} className={`rounded-xl border ${border} ${bg} px-5 py-4 flex items-center gap-4`}>
          <div className={`p-2 rounded-lg bg-white/60 ${color}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-zinc-500 font-medium">{label}</p>
            <div className="flex items-baseline gap-1.5">
              <p className={`text-2xl font-bold ${color}`}>{late.toLocaleString("en-US")}</p>
              <p className="text-sm text-zinc-400">/ {total.toLocaleString("en-US")}</p>
            </div>
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

function exportToCSV(rows: ConversationRow[], filename: string) {
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
        row.isOutbound ? "Outbound" : !row.hasReply ? "No Reply" : row.isLateReply ? "Late" : "On Time",
        row.responseTimeMinutes ?? "",
        `"${(row.lastMessage ?? "").replace(/"/g, '""')}"`,
        row.customerMessageAt ? new Date(row.customerMessageAt).toLocaleString("vi-VN") : "",
        row.adminReplyAt ? new Date(row.adminReplyAt).toLocaleString("vi-VN") : "",
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
  const { t } = useI18n();

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

  useEffect(() => {
    fetch("/api/dashboard/conversations?options=true")
      .then((r) => r.json())
      .then((json) => { if (json.success) setFilterOptions(json.options); })
      .catch(console.error);

    setStatsLoading(true);
    fetch(`/api/dashboard/conversation-stats?type=${conversationType}`)
      .then((r) => r.json())
      .then((json) => { if (json.success) setTypeStats(json.stats); })
      .catch(console.error)
      .finally(() => setStatsLoading(false));
  }, [conversationType]);

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
      exportToCSV(json.data as ConversationRow[], `sla-${conversationType.toLowerCase()}-${date}.csv`);
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
