"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

import StatsCards from "@/components/dashboard/stats-cards";
import ViolationsTrendChart, { type ChartPeriod } from "@/components/dashboard/violations-trend-chart";
import ResponseTimeTrendChart from "@/components/dashboard/response-time-trend-chart";

import type { DashboardStats, ViolationsTrendDay, ResponseTimeTrendDay } from "@/lib/services/dashboard";

export default function DashboardPage() {
  const { t } = useI18n();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const [trendData, setTrendData] = useState<ViolationsTrendDay[]>([]);
  const [trendLoading, setTrendLoading] = useState(true);
  const [responseTimeTrendData, setResponseTimeTrendData] = useState<ResponseTimeTrendDay[]>([]);
  const [responseTimeTrendLoading, setResponseTimeTrendLoading] = useState(true);
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>(30);

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
  } | null>(null);
  const syncCancelledRef = useRef(false);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await fetch("/api/dashboard/stats");
      const json = await res.json();
      if (json.success) setStats(json.stats);
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const fetchTrend = useCallback(async (days: ChartPeriod) => {
    setTrendLoading(true);
    setResponseTimeTrendLoading(true);
    try {
      const [violationsRes, responseTimeRes] = await Promise.all([
        fetch(`/api/dashboard/violations-trend?days=${days}`),
        fetch(`/api/dashboard/response-time-trend?days=${days}`),
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
  }, []);

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
        setSyncResult({ type: "error", message: initJson.error ?? t.dashboard.syncFailed });
        return;
      }

      syncId = initJson.syncId as string;
      const pages = initJson.pages as { id: string; name: string; [key: string]: unknown }[];
      const since = initJson.since as string | null;

      setSyncing(true);
      setSyncProgress({ currentPageName: null, currentPageIndex: 0, totalPages: pages.length, conversations: 0, messages: 0 });

      // Step 2: Sync one page at a time
      let cancelled = false;
      for (let i = 0; i < pages.length; i++) {
        if (syncCancelledRef.current) { cancelled = true; break; }

        const page = pages[i];
        setSyncProgress({ currentPageName: page.name, currentPageIndex: i + 1, totalPages: pages.length, conversations: totals.conversations, messages: totals.messages });

        const pageRes = await fetch("/api/sync/page", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ syncId, pageIndex: i + 1, totalPages: pages.length, page, since, conversations: totals.conversations, messages: totals.messages }),
        });
        const pageJson = await pageRes.json();

        if (pageJson.cancelled) { cancelled = true; break; }
        if (pageJson.success && pageJson.stats) {
          totals.pages += pageJson.stats.pages.upserted;
          totals.conversations += pageJson.stats.conversations.upserted;
          totals.messages += pageJson.stats.messages.upserted;
          totals.slaChecked += pageJson.stats.slaChecked;
          totals.errors.push(...(pageJson.stats.errors ?? []));
          setSyncProgress({ currentPageName: page.name, currentPageIndex: i + 1, totalPages: pages.length, conversations: totals.conversations, messages: totals.messages });
        }
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
        fetchTrend(chartPeriod);
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
  }, [syncing, t, fetchStats, fetchTrend, chartPeriod]);

  const handleStopSync = useCallback(async () => {
    syncCancelledRef.current = true;
    await fetch("/api/sync", { method: "DELETE" });
  }, []);

  useEffect(() => {
    if (!syncResult) return;
    const timer = setTimeout(() => setSyncResult(null), 6000);
    return () => clearTimeout(timer);
  }, [syncResult]);

  useEffect(() => {
    fetchStats();
    fetchTrend(chartPeriod);
    checkSyncStatus().then((status) => {
      if (status === "running") setSyncing(true);
    });
  }, []);

  useEffect(() => {
    fetchTrend(chartPeriod);
  }, [chartPeriod]);

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
          <Button onClick={() => handleSync(false)} disabled={syncing} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudDownload className="w-4 h-4" />}
            {syncing ? t.dashboard.syncing : t.dashboard.sync}
          </Button>
          {syncing ? (
            <Button variant="outline" onClick={handleStopSync} className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700">
              <XCircle className="w-4 h-4" />
              {t.common.stop}
            </Button>
          ) : (
            <Button variant="outline" onClick={() => handleSync(true)}>
              <CloudDownload className="w-4 h-4" />
              {t.dashboard.fullSync}
            </Button>
          )}
          <Button variant="outline" onClick={() => { fetchStats(); fetchTrend(chartPeriod); }}>
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
                    {" · "}
                    {syncProgress.conversations.toLocaleString()} {t.conversations.conversations}
                    {" · "}
                    {syncProgress.messages.toLocaleString()} {t.conversations.messages}
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
          period={chartPeriod}
          onPeriodChange={setChartPeriod}
        />
        <ResponseTimeTrendChart
          data={responseTimeTrendData}
          loading={responseTimeTrendLoading}
          period={chartPeriod}
        />
      </div>
    </div>
  );
}
