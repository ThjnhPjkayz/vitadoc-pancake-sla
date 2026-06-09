"use client";

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";

export type GlobalPeriodKey = "yesterday" | "7d" | "30d" | "custom";

const VN_OFFSET_MS = 7 * 3_600_000;

function vnDayBoundary(daysAgo: number): Date {
  const vnNow = Date.now() + VN_OFFSET_MS;
  const vnMidnight = vnNow - (vnNow % 86_400_000);
  return new Date(vnMidnight - daysAgo * 86_400_000 - VN_OFFSET_MS);
}

export interface GlobalPeriod {
  period: GlobalPeriodKey;
  dateFrom: Date;
  dateTo: Date;
  /** YYYY-MM-DD — only set for custom period */
  fromParam: string;
  toParam: string;
}

export function useGlobalPeriod(): GlobalPeriod {
  const searchParams = useSearchParams();

  return useMemo(() => {
    const p = (searchParams.get("period") ?? "yesterday") as GlobalPeriodKey;

    if (p === "custom") {
      const from = searchParams.get("from") ?? "";
      const to = searchParams.get("to") ?? "";
      const dateFrom = from ? new Date(from) : vnDayBoundary(1);
      // dateTo: start of the day AFTER the selected end date (exclusive upper bound)
      const dateTo = to ? new Date(new Date(to).getTime() + 86_400_000) : vnDayBoundary(0);
      return { period: "custom", dateFrom, dateTo, fromParam: from, toParam: to };
    }

    const daysMap: Record<string, number> = { yesterday: 1, "7d": 7, "30d": 30 };
    const days = daysMap[p] ?? 1;
    return {
      period: p as GlobalPeriodKey,
      dateFrom: vnDayBoundary(days),
      dateTo: vnDayBoundary(0),
      fromParam: "",
      toParam: "",
    };
  }, [searchParams]);
}
