"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { useGlobalPeriod } from "@/hooks/use-global-period";
import PageLeaderboard from "@/components/dashboard/page-leaderboard";
import type { PageSummary } from "@/lib/services/dashboard";

function PagesContent() {
  const router = useRouter();
  const { t } = useI18n();
  const globalPeriod = useGlobalPeriod();

  const [pages, setPages] = useState<PageSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPages = useCallback(async () => {
    setLoading(true);
    try {
      const { period, fromParam, toParam } = globalPeriod;
      const q = period === "custom" && fromParam && toParam
        ? `period=custom&from=${fromParam}&to=${toParam}`
        : `period=${period}`;
      const res = await fetch(`/api/dashboard/pages?${q}`);
      const json = await res.json();
      if (json.success) setPages(json.pages);
    } catch (err) {
      console.error("Failed to fetch pages:", err);
    } finally {
      setLoading(false);
    }
  }, [globalPeriod]);

  useEffect(() => {
    fetchPages();
  }, [globalPeriod.period, globalPeriod.fromParam, globalPeriod.toParam]);

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
        <Button variant="outline" onClick={fetchPages}>
          <RefreshCw className="w-4 h-4" />
          {t.common.refresh}
        </Button>
      </div>

      <PageLeaderboard
        pages={pages}
        loading={loading}
        onPageClick={handlePageClick}
      />
    </div>
  );
}

export default function PagesPage() {
  return (
    <Suspense>
      <PagesContent />
    </Suspense>
  );
}
