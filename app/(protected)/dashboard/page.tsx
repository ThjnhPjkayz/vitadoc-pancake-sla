"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import {
  RefreshCw,
  CloudDownload,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { useGlobalPeriod } from "@/hooks/use-global-period";

import StatsCards from "@/components/dashboard/stats-cards";
import ViolationsTrendChart, { type ChartPeriod } from "@/components/dashboard/violations-trend-chart";
import ResponseTimeTrendChart from "@/components/dashboard/response-time-trend-chart";

import type { DashboardStats, PeriodComparison, ViolationsTrendDay, ResponseTimeTrendDay } from "@/lib/services/dashboard";

function DashboardContent() {
  const { t } = useI18n();
  const globalPeriod = useGlobalPeriod();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [comparison, setComparison] = useState<PeriodComparison | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const [trendData, setTrendData] = useState<ViolationsTrendDay[]>([]);
  const [trendLoading, setTrendLoading] = useState(true);
  const [responseTimeTrendData, setResponseTimeTrendData] = useState<ResponseTimeTrendDay[]>([]);
  const [responseTimeTrendLoading, setResponseTimeTrendLoading] = useState(true);

  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [syncProgress, setSyncProgress] = useState<{
    currentPageName: string | null;
    currentPageIndex: number;
    totalPages: number;
    conversations: number;
    messages: number;
    slaChecked: number;
  } | null>(null);
  const syncCancelledRef = useRef(false);
  // true khi sync được detect từ DB (cron/tab khác), không phải do client này khởi tạo
  const isExternalSyncRef = useRef(false);

  const buildPeriodQuery = useCallback(() => {
    const { period, fromParam, toParam } = globalPeriod;
    if (period === "custom" && fromParam && toParam) {
      return `period=custom&from=${fromParam}&to=${toParam}`;
    }
    return `period=${period}`;
  }, [globalPeriod]);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await fetch(`/api/dashboard/stats?${buildPeriodQuery()}`);
      const json = await res.json();
      if (json.success) {
        setStats(json.stats);
        if (json.comparison) setComparison(json.comparison);
      }
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    } finally {
      setStatsLoading(false);
    }
  }, [buildPeriodQuery]);

  const fetchTrend = useCallback(async () => {
    setTrendLoading(true);
    setResponseTimeTrendLoading(true);
    try {
      const q = buildPeriodQuery();
      const [violationsRes, responseTimeRes] = await Promise.all([
        fetch(`/api/dashboard/violations-trend?${q}`),
        fetch(`/api/dashboard/response-time-trend?${q}`),
      ]);
      const [violationsJson, responseTimeJson] = await Promise.all([
        violationsRes.json(),
        responseTimeRes.json(),
      ]);
      if (violationsJson.success) setTrendData(violationsJson.trend);
      if (responseTimeJson.success) setResponseTimeTrendData(responseTimeJson.trend);
    } catch (err) {
      console.error("Failed to fetch trend:", err);
    } finally {
      setTrendLoading(false);
      setResponseTimeTrendLoading(false);
    }
  }, [buildPeriodQuery]);

  const checkSyncStatus = useCallback(async (): Promise<"running" | "success" | "failed" | "cancelled" | null> => {
    try {
      const res = await fetch("/api/sync");
      const json = await res.json();
      if (!json.success) return null;
      if (json.lastSync?.completedAt) setLastSyncAt(json.lastSync.completedAt);
      if (json.progress?.isRunning) {
        setSyncProgress({
          currentPageName: json.progress.currentPageName,
          currentPageIndex: json.progress.currentPageIndex,
          totalPages: json.progress.totalPages,
          conversations: json.progress.conversations ?? 0,
          messages: json.progress.messages ?? 0,
          slaChecked: json.progress.slaChecked ?? 0,
        });
      } else {
        setSyncProgress(null);
      }
      return json.lastSync?.status ?? null;
    } catch {
      return null;
    }
  }, []);

  const handleSync = useCallback(async (force = false) => {
    if (syncing) return;
    setSyncing(true);
    setSyncResult(null);
    setSyncProgress(null);
    syncCancelledRef.current = false;

    let syncId: string | null = null;
    const totals = { pages: 0, conversations: 0, messages: 0, slaChecked: 0, errors: [] as string[] };

    try {
      // Step 1: Init sync — get syncId + pages list
      const url = force ? "/api/sync?force=true" : "/api/sync";
      const initRes = await fetch(url, { method: "POST" });
      const initJson = await initRes.json();
      if (!initJson.success) {
        setSyncing(false);
        setSyncResult({ type: "error", message: initJson.error ?? t.dashboard.syncFailed });
        return;
      }

      syncId = initJson.syncId as string;
      const pages = initJson.pages as { id: string; name: string; [key: string]: unknown }[];
      const since = initJson.since as string | null;

      setSyncProgress({ currentPageName: null, currentPageIndex: 0, totalPages: pages.length, conversations: 0, messages: 0, slaChecked: 0 });

      // Step 2: Sync one page at a time, cursor-paginating conversations
      let cancelled = false;
      for (let i = 0; i < pages.length; i++) {
        if (syncCancelledRef.current) { cancelled = true; break; }

        const page = pages[i];
        setSyncProgress({ currentPageName: page.name, currentPageIndex: i + 1, totalPages: pages.length, conversations: totals.conversations, messages: totals.messages, slaChecked: totals.slaChecked });

        // Loop cursor pages for this page until no more conversations
        let cursor: string | null = null;
        do {
          if (syncCancelledRef.current) { cancelled = true; break; }

          const pageRes: Response = await fetch("/api/sync/page", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ syncId, pageIndex: i + 1, totalPages: pages.length, page, since, conversations: totals.conversations, messages: totals.messages, slaChecked: totals.slaChecked, cursor, force }),
          });
          const pageJson: { success: boolean; cancelled?: boolean; stats?: { pages: { upserted: number }; conversations: { upserted: number }; messages: { upserted: number }; slaChecked: number; errors: string[] }; nextCursor?: string | null } = await pageRes.json();

          if (pageJson.cancelled) { cancelled = true; break; }
          if (pageJson.success && pageJson.stats) {
            totals.pages += pageJson.stats.pages.upserted ?? 0;
            totals.conversations += pageJson.stats.conversations.upserted ?? 0;
            totals.messages += pageJson.stats.messages.upserted ?? 0;
            totals.slaChecked += pageJson.stats.slaChecked ?? 0;
            totals.errors.push(...(pageJson.stats.errors ?? []));
            setSyncProgress({ currentPageName: page.name, currentPageIndex: i + 1, totalPages: pages.length, conversations: totals.conversations, messages: totals.messages, slaChecked: totals.slaChecked });
          }

          cursor = pageJson.nextCursor ?? null;
        } while (cursor && !syncCancelledRef.current);

        if (cancelled) break;
      }

      // Step 3: Finalize
      await fetch("/api/sync/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ syncId, pagesCount: totals.pages, conversationsCount: totals.conversations, messagesCount: totals.messages, slaChecked: totals.slaChecked, errors: totals.errors, cancelled }),
      });

      setSyncing(false);
      setSyncProgress(null);
      if (cancelled) {
        setSyncResult({ type: "error", message: t.dashboard.syncStopped });
      } else {
        setSyncResult({ type: "success", message: t.dashboard.syncSuccess });
        fetchStats();
        fetchTrend();
      }
    } catch (err) {
      setSyncing(false);
      setSyncProgress(null);
      if (syncId) {
        fetch("/api/sync/finalize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ syncId, errors: [String(err)], cancelled: false }),
        }).catch(() => {});
      }
      setSyncResult({ type: "error", message: t.dashboard.cannotConnect });
    }
  }, [syncing, t, fetchStats, fetchTrend]);

  const handleStopSync = useCallback(async () => {
    syncCancelledRef.current = true;
    await fetch("/api/sync", { method: "DELETE" });
  }, []);

  const handleResetSync = useCallback(async () => {
    await fetch("/api/sync", { method: "DELETE" });
    isExternalSyncRef.current = false;
    setSyncing(false);
    setSyncProgress(null);
    setSyncResult(null);
  }, []);

  useEffect(() => {
    if (!syncResult) return;
    const timer = setTimeout(() => setSyncResult(null), 6000);
    return () => clearTimeout(timer);
  }, [syncResult]);

  useEffect(() => {
    fetchStats();
    fetchTrend();
    checkSyncStatus().then((status) => {
      if (status === "running") {
        isExternalSyncRef.current = true;
        setSyncing(true);
      }
    });
  }, []);

  // Polling khi sync đang chạy từ nguồn ngoài (cron/tab khác)
  useEffect(() => {
    if (!syncing || !isExternalSyncRef.current) return;
    const interval = setInterval(async () => {
      const status = await checkSyncStatus();
      if (status !== "running") {
        isExternalSyncRef.current = false;
        setSyncing(false);
        setSyncProgress(null);
        if (status === "success") {
          fetchStats();
          fetchTrend();
        }
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [syncing, checkSyncStatus, fetchStats, fetchTrend]);

  // Refetch khi global period thay đổi
  useEffect(() => {
    fetchStats();
    fetchTrend();
  }, [globalPeriod.period, globalPeriod.fromParam, globalPeriod.toParam]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-zinc-900">{t.dashboard.title}</h1>
          <p className="text-base text-muted-foreground">{t.dashboard.description}</p>
          {lastSyncAt ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-zinc-400">
              <Clock className="w-3.5 h-3.5" />
              {t.dashboard.lastSync}{" "}
              {(() => {
                const d = new Date(lastSyncAt);
                const pad = (n: number) => String(n).padStart(2, "0");
                return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
              })()}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs text-zinc-400">
              <Clock className="w-3.5 h-3.5" />
              {t.dashboard.noSyncYet}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={() => handleSync(false)} disabled={syncing}>
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudDownload className="w-4 h-4" />}
            {syncing ? t.dashboard.syncing : t.dashboard.sync}
          </Button>
          {process.env.NODE_ENV !== "development" && (
            <Button variant="outline" onClick={() => handleSync(true)} disabled={syncing}>
              <CloudDownload className="w-4 h-4" />
              {t.dashboard.fullSync}
            </Button>
          )}
          {syncing && (
            isExternalSyncRef.current ? (
              <Button variant="outline" onClick={handleResetSync} className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700">
                <XCircle className="w-4 h-4" />
                Reset
              </Button>
            ) : (
              <Button variant="outline" onClick={handleStopSync} className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700">
                <XCircle className="w-4 h-4" />
                {t.common.stop}
              </Button>
            )
          )}
          <Button variant="outline" onClick={() => { fetchStats(); fetchTrend(); }}>
            <RefreshCw className="w-4 h-4" />
            {t.common.refresh}
          </Button>
        </div>
      </div>

      {/* Sync Banner */}
      {(syncing || syncResult) && (
        <div
          className={`flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium border ${
            syncing
              ? "bg-blue-50 border-blue-200 text-blue-800"
              : syncResult?.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          {syncing ? (
            <>
              <Loader2 className="w-4 h-4 flex-shrink-0 animate-spin" />
              <div className="flex flex-col gap-0.5">
                <span>{t.dashboard.syncingMessage}</span>
                {syncProgress && (
                  <span className="text-xs font-normal opacity-80">
                    {syncProgress.currentPageName
                      ? `📄 ${syncProgress.currentPageIndex}/${syncProgress.totalPages} — ${syncProgress.currentPageName}`
                      : `📄 ${syncProgress.currentPageIndex}/${syncProgress.totalPages} pages`}
                    {syncProgress.conversations > 0 && (
                      <> · {syncProgress.conversations.toLocaleString()} {t.conversations.conversations}</>
                    )}
                    {syncProgress.messages > 0 && (
                      <> · {syncProgress.messages.toLocaleString()} {t.conversations.messages} mới</>
                    )}
                    {syncProgress.slaChecked > 0 && (
                      <> · {syncProgress.slaChecked.toLocaleString()} SLA</>
                    )}
                  </span>
                )}
              </div>
            </>
          ) : syncResult?.type === "success" ? (
            <>
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{syncResult.message}</span>
            </>
          ) : (
            <>
              <XCircle className="w-4 h-4 flex-shrink-0" />
              <span>{syncResult?.message}</span>
            </>
          )}
        </div>
      )}

      {/* Stats Cards */}
      {stats && !statsLoading ? (
        <StatsCards
          avgResponseTimeMinutes={stats.avgResponseTimeMinutes}
          pendingBreachedCount={stats.pendingBreachedCount}
          inHoursViolations={stats.inHoursViolations}
          afterHoursViolations={stats.afterHoursViolations}
          slaSuccessRate={stats.slaSuccessRate}
          comparison={comparison ?? undefined}
        />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-zinc-100 animate-pulse" />
          ))}
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ViolationsTrendChart
          data={trendData}
          loading={trendLoading}
          period={globalPeriod.period as ChartPeriod}
        />
        <ResponseTimeTrendChart
          data={responseTimeTrendData}
          loading={responseTimeTrendLoading}
          period={globalPeriod.period as ChartPeriod}
        />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense>
      <DashboardContent />
    </Suspense>
  );
}
