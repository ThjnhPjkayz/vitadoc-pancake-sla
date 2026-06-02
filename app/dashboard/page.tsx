"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, CloudDownload, Loader2, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

import StatsCards from "@/components/dashboard/stats-cards";
import FiltersBar from "@/components/dashboard/filters-bar";
import ConversationsTable from "@/components/dashboard/conversations-table";

import type { DashboardStats } from "@/lib/services/dashboard";

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

interface FilterState {
  search: string;
  pageId: string;
  platform: string;
  slaStatus: string;
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
  customerMessageAt: string | null;
  conversationType: string;
}

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// ----------------------------------------------------------------
// Page
// ----------------------------------------------------------------

export default function DashboardPage() {
  // Stats
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Filters
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    pageId: "",
    platform: "",
    slaStatus: "",
    dateFrom: "",
    dateTo: "",
  });
  const [filterOptions, setFilterOptions] = useState<{
    pages: FilterOption[];
    platforms: string[];
  }>({ pages: [], platforms: [] });

  // Table
  const [tableData, setTableData] = useState<ConversationRow[]>([]);
  const [tableTotal, setTableTotal] = useState(0);
  const [tablePage, setTablePage] = useState(1);
  const [tablePageSize, setTablePageSize] = useState(20);
  const [tableTotalPages, setTableTotalPages] = useState(0);
  const [tableSortBy, setTableSortBy] = useState("customerMessageAt");
  const [tableSortOrder, setTableSortOrder] = useState("desc");
  const [tableLoading, setTableLoading] = useState(true);

  // Sync
  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // ----------------------------------------------------------------
  // Fetch stats
  // ----------------------------------------------------------------
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.pageId) params.set("pageId", filters.pageId);

      const res = await fetch(`/api/dashboard/stats?${params}`);
      const json = await res.json();
      if (json.success) setStats(json.stats);
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    } finally {
      setStatsLoading(false);
    }
  }, [filters.pageId]);

  // ----------------------------------------------------------------
  // Fetch table data
  // ----------------------------------------------------------------
  const fetchTable = useCallback(async () => {
    setTableLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.search) params.set("search", filters.search);
      if (filters.pageId) params.set("pageId", filters.pageId);
      if (filters.platform) params.set("platform", filters.platform);
      if (filters.slaStatus) params.set("slaStatus", filters.slaStatus);
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
  }, [
    filters,
    tablePage,
    tablePageSize,
    tableSortBy,
    tableSortOrder,
  ]);

  // ----------------------------------------------------------------
  // Fetch filter options
  // ----------------------------------------------------------------
  const fetchOptions = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/conversations?options=true");
      const json = await res.json();
      if (json.success) setFilterOptions(json.options);
    } catch (err) {
      console.error("Failed to fetch options:", err);
    }
  }, []);

  // ----------------------------------------------------------------
  // Sync
  // ----------------------------------------------------------------
  const fetchLastSync = useCallback(async () => {
    try {
      const res = await fetch("/api/sync");
      const json = await res.json();
      if (json.success && json.lastSync?.completedAt) {
        setLastSyncAt(json.lastSync.completedAt);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleSync = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const json = await res.json();
      if (json.success) {
        const { conversations, messages, errors } = json.stats;
        const hasErrors = errors?.length > 0;
        setSyncResult({
          type: hasErrors ? "error" : "success",
          message: hasErrors
            ? `Sync hoàn tất nhưng có lỗi: ${errors[0]}`
            : `Sync thành công — ${conversations.upserted} conversations, ${messages.upserted} messages`,
        });
      } else {
        setSyncResult({ type: "error", message: json.error ?? "Sync thất bại" });
      }
    } catch {
      setSyncResult({ type: "error", message: "Không thể kết nối server" });
    } finally {
      setSyncing(false);
      fetchStats();
      fetchTable();
            fetchLastSync();
    }
  }, [syncing, fetchStats, fetchTable, fetchLastSync]);

  // Tự ẩn thông báo sau 6 giây
  useEffect(() => {
    if (!syncResult) return;
    const t = setTimeout(() => setSyncResult(null), 6000);
    return () => clearTimeout(t);
  }, [syncResult]);

  // ----------------------------------------------------------------
  // Effects
  // ----------------------------------------------------------------
  useEffect(() => {
    fetchStats();
        fetchOptions();
    fetchTable();
    fetchLastSync();
  }, []);

  useEffect(() => {
    setTablePage(1); // Reset page on filter change
    fetchStats();
    fetchTable();
      }, [filters]);

  useEffect(() => {
    fetchTable();
  }, [tablePage, tablePageSize, tableSortBy, tableSortOrder]);

  // Auto-refresh: polling nhẹ mỗi 60s để cập nhật view từ DB
  useEffect(() => {
    const interval = setInterval(() => {
      fetchStats();
      fetchTable();
            fetchLastSync();
    }, 60_000);
    return () => clearInterval(interval);
  }, [fetchStats, fetchTable, fetchLastSync]);

  // ----------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">
            SLA Dashboard
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Monitor message response times across all Pancake pages
            {lastSyncAt && (
              <span className="ml-2 text-zinc-400">
                · Last sync: {formatRelativeTime(lastSyncAt)}
              </span>
            )}
            {syncing && (
              <span className="ml-2 text-blue-600 animate-pulse">
                · Syncing...
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {syncing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CloudDownload className="w-4 h-4" />
            )}
            {syncing ? "Syncing..." : "Sync"}
          </button>
          <button
            onClick={() => {
              fetchStats();
              fetchTable();
                          }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Sync result notification */}
      {syncResult && (
        <div
          className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium border ${
            syncResult.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          {syncResult.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          ) : (
            <XCircle className="w-4 h-4 flex-shrink-0" />
          )}
          {syncResult.message}
        </div>
      )}

      {/* Stats Cards */}
      {stats && !statsLoading ? (
        <StatsCards
          totalConversations={stats.totalConversations}
          totalMessages={stats.totalMessages}
          lateReplyCount={stats.lateReplyCount}
          avgResponseTimeMinutes={stats.avgResponseTimeMinutes}
          slaSuccessRate={stats.slaSuccessRate}
        />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-24 rounded-xl bg-zinc-100 animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Warning: pages at 60-conversation API limit */}
      {stats && stats.pagesAtLimit > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>
            <strong>{stats.pagesAtLimit}</strong> page{stats.pagesAtLimit > 1 ? "s" : ""} have exactly 60 conversations — the Pancake API limit. Older conversations may be missing. Data improves with each sync.
          </span>
        </div>
      )}

{/* Conversations Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900">
            Conversations
          </h2>
          <span className="text-sm text-zinc-500">
            {tableTotal.toLocaleString()} total
          </span>
        </div>

        <FiltersBar
          filters={filters}
          onFilterChange={setFilters}
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
          onPageSizeChange={(s) => {
            setTablePageSize(s);
            setTablePage(1);
          }}
          onSortChange={(by, order) => {
            setTableSortBy(by);
            setTableSortOrder(order);
          }}
          loading={tableLoading}
        />
      </div>
    </div>
  );
}
