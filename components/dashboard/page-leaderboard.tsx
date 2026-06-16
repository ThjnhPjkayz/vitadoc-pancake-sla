"use client";

import type { PageSummary } from "@/lib/services/dashboard";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { useI18n } from "@/lib/i18n";

const PLATFORM_LABELS: Record<string, string> = {
  tiktok: "TikTok",
  facebook: "Facebook",
  personal_zalo: "Zalo",
  tiktok_business_messaging: "TT Biz",
};

const PLATFORM_COLORS: Record<string, string> = {
  tiktok: "bg-black text-white border-black",
  facebook: "bg-blue-600 text-white border-blue-600",
  personal_zalo: "bg-sky-500 text-white border-sky-500",
  tiktok_business_messaging: "bg-zinc-700 text-white border-zinc-700",
};

interface PageLeaderboardProps {
  pages: PageSummary[];
  loading?: boolean;
  onPageClick?: (pageId: string) => void;
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1)
    return (
      <span className="inline-flex w-6 h-6 rounded-full bg-amber-100 text-amber-600 items-center justify-center text-xs font-bold ring-1 ring-amber-300/60">
        1
      </span>
    );
  if (rank === 2)
    return (
      <span className="inline-flex w-6 h-6 rounded-full bg-zinc-100 text-zinc-500 items-center justify-center text-xs font-bold ring-1 ring-zinc-300/60">
        2
      </span>
    );
  if (rank === 3)
    return (
      <span className="inline-flex w-6 h-6 rounded-full bg-orange-50 text-orange-500 items-center justify-center text-xs font-bold ring-1 ring-orange-200/60">
        3
      </span>
    );
  return (
    <span className="text-sm text-muted-foreground font-medium w-6 text-center inline-block">
      {rank}
    </span>
  );
}

export default function PageLeaderboard({
  pages,
  loading,
  onPageClick,
}: PageLeaderboardProps) {
  const { t } = useI18n();

  if (loading) {
    return (
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b">
          <div className="h-5 w-40 bg-muted rounded animate-pulse" />
        </div>
        <div className="divide-y">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3">
              {Array.from({ length: 7 }).map((_, j) => (
                <div key={j} className="h-4 bg-muted rounded animate-pulse flex-1" />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (pages.length === 0) {
    return (
      <div className="rounded-xl border bg-card shadow-sm px-5 py-8 text-center text-muted-foreground text-base">
        {t.pages.noPageData}
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b flex items-center gap-3">
        <h2 className="text-base font-semibold">{t.pages.leaderboardTitle}</h2>
        <span className="text-xs text-muted-foreground">{t.pages.sortedByNote}</span>
      </div>

      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="w-8 text-xs font-semibold uppercase tracking-wider">{t.pages.col.rank}</TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wider">{t.pages.col.page}</TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wider text-right">{t.pages.col.total}</TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wider text-right">{t.pages.col.lateInbox}</TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wider text-right">{t.pages.col.lateComment}</TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wider text-right text-emerald-700">{t.pages.col.onTimeInbox}</TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wider text-right text-emerald-700">{t.pages.col.onTimeComment}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pages.map((page, idx) => (
            <TableRow
              key={page.pageId}
              className={onPageClick ? "cursor-pointer" : ""}
              onClick={() => onPageClick?.(page.pageId)}
            >
              <TableCell>
                <RankBadge rank={idx + 1} />
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Badge
                    className={`text-[10px] px-1.5 py-0 h-4 ${
                      PLATFORM_COLORS[page.platform] ?? "bg-muted text-muted-foreground"
                    } hover:opacity-100`}
                  >
                    {PLATFORM_LABELS[page.platform] ?? page.platform}
                  </Badge>
                  <span className="text-base font-medium truncate max-w-[200px]">
                    {page.pageName}
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-base text-right tabular-nums">
                {page.total.toLocaleString("en-US")}
              </TableCell>
              <TableCell className="text-right">
                <span className={`text-base font-semibold tabular-nums ${page.lateInboxCount > 0 ? "text-red-600" : "text-muted-foreground"}`}>
                  {page.lateInboxCount.toLocaleString("en-US")}
                </span>
              </TableCell>
              <TableCell className="text-right">
                <span className={`text-base font-semibold tabular-nums ${page.lateCommentCount > 0 ? "text-red-600" : "text-muted-foreground"}`}>
                  {page.lateCommentCount.toLocaleString("en-US")}
                </span>
              </TableCell>
              <TableCell className="text-right">
                <span className={`text-base tabular-nums ${page.onTimeInboxCount > 0 ? "text-emerald-600 font-medium" : "text-muted-foreground"}`}>
                  {page.onTimeInboxCount.toLocaleString("en-US")}
                </span>
              </TableCell>
              <TableCell className="text-right">
                <span className={`text-base tabular-nums ${page.onTimeCommentCount > 0 ? "text-emerald-600 font-medium" : "text-muted-foreground"}`}>
                  {page.onTimeCommentCount.toLocaleString("en-US")}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
