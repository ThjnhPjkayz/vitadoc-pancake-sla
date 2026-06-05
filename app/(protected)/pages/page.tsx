"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import PageLeaderboard from "@/components/dashboard/page-leaderboard";
import type { PageSummary } from "@/lib/services/dashboard";

export type PeriodFilter = "7d" | "30d" | "month" | "all";

export default function PagesPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [pages, setPages] = useState<PageSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodFilter>("30d");

  const fetchPages = useCallback(async (p: PeriodFilter) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard/pages?period=${p}`);
      const json = await res.json();
      if (json.success) setPages(json.pages);
    } catch (err) {
      console.error("Failed to fetch pages:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPages(period);
  }, [period]);

  const handlePeriodChange = useCallback((p: PeriodFilter) => {
    setPeriod(p);
  }, []);

  const handlePageClick = useCallback((pageId: string) => {
    router.push(`/conversations/inbox?pageId=${pageId}&slaStatus=needs-attention`);
  }, [router]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">{t.pages.title}</h1>
          <p className="text-base text-muted-foreground">{t.pages.description}</p>
        </div>
        <Button variant="outline" onClick={() => fetchPages(period)}>
          <RefreshCw className="w-4 h-4" />
          {t.common.refresh}
        </Button>
      </div>

      <PageLeaderboard
        pages={pages}
        loading={loading}
        period={period}
        onPeriodChange={handlePeriodChange}
        onPageClick={handlePageClick}
      />
    </div>
  );
}
