"use client";

import { useCallback, useEffect, useState } from "react";
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
import ViolationsTrendChart from "@/components/dashboard/violations-trend-chart";

import type { DashboardStats, ViolationsTrendDay } from "@/lib/services/dashboard";

export default function DashboardPage() {
  const { t } = useI18n();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const [trendData, setTrendData] = useState<ViolationsTrendDay[]>([]);
  const [trendLoading, setTrendLoading] = useState(true);

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

  const fetchTrend = useCallback(async () => {
    setTrendLoading(true);
    try {
      const res = await fetch("/api/dashboard/violations-trend");
      const json = await res.json();
      if (json.success) setTrendData(json.trend);
    } catch (err) {
      console.error("Failed to fetch trend:", err);
    } finally {
      setTrendLoading(false);
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
          conversations: json.progress.conversations,
          messages: json.progress.messages,
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
    try {
      const url = force ? "/api/sync?force=true" : "/api/sync";
      const res = await fetch(url, { method: "POST" });
      const json = await res.json();
      if (!json.success) {
        setSyncResult({ type: "error", message: json.error ?? t.dashboard.syncFailed });
        return;
      }
      setSyncing(true);
    } catch {
      setSyncResult({ type: "error", message: t.dashboard.cannotConnect });
    }
  }, [syncing, t]);

  const handleStopSync = useCallback(async () => {
    await fetch("/api/sync", { method: "DELETE" });
  }, []);

  useEffect(() => {
    if (!syncing) return;
    const interval = setInterval(async () => {
      const status = await checkSyncStatus();
      if (status === "success") {
        setSyncing(false);
        setSyncResult({ type: "success", message: t.dashboard.syncSuccess });
        fetchStats();
        fetchTrend();
        clearInterval(interval);
      } else if (status === "failed") {
        setSyncing(false);
        setSyncResult({ type: "error", message: t.dashboard.syncFailed });
        clearInterval(interval);
      } else if (status === "cancelled") {
        setSyncing(false);
        setSyncResult({ type: "error", message: t.dashboard.syncStopped });
        clearInterval(interval);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [syncing, checkSyncStatus, fetchStats, fetchTrend, t]);

  useEffect(() => {
    if (!syncResult) return;
    const timer = setTimeout(() => setSyncResult(null), 6000);
    return () => clearTimeout(timer);
  }, [syncResult]);

  useEffect(() => {
    fetchStats();
    fetchTrend();
    checkSyncStatus();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-zinc-900">{t.dashboard.title}</h1>
          <p className="text-sm text-muted-foreground">{t.dashboard.description}</p>
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
          <Button variant="outline" onClick={() => { fetchStats(); fetchTrend(); }}>
            <RefreshCw className="w-4 h-4" />
            {t.common.refresh}
          </Button>
        </div>
      </div>

      {/* Sync Banner */}
      {(syncing || syncResult) && (
        <div
          className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium border ${
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
                    {syncProgress.conversations.toLocaleString()} conversations
                    {" · "}
                    {syncProgress.messages.toLocaleString()} messages
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
          totalConversations={stats.totalConversations}
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

      {/* Trend Chart */}
      <ViolationsTrendChart data={trendData} loading={trendLoading} />
    </div>
  );
}
