"use client";

import { Timer, AlertTriangle, CheckCircle, Clock, Moon, TrendingUp, TrendingDown } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { PeriodComparison } from "@/lib/services/dashboard";

interface StatsCardsProps {
  avgResponseTimeMinutes: number;
  pendingBreachedCount: number;
  inHoursViolations: number;
  afterHoursViolations: number;
  slaSuccessRate: number;
  comparison?: PeriodComparison;
}

function calcDelta(current: number, prev: number): number | null {
  if (prev === 0) return null;
  return Math.round(((current - prev) / prev) * 100);
}

function DeltaBadge({
  current,
  prev,
  higherIsBetter,
}: {
  current: number;
  prev: number;
  higherIsBetter: boolean;
}) {
  const delta = calcDelta(current, prev);
  if (delta === null || delta === 0) return null;

  const isPositive = delta > 0;
  const isGood = higherIsBetter ? isPositive : !isPositive;

  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums ${
        isGood ? "text-emerald-600" : "text-red-500"
      }`}
    >
      {isPositive ? (
        <TrendingUp className="w-3 h-3" />
      ) : (
        <TrendingDown className="w-3 h-3" />
      )}
      {isPositive ? "+" : ""}{delta}%
    </span>
  );
}

export default function StatsCards({
  avgResponseTimeMinutes,
  pendingBreachedCount,
  inHoursViolations,
  afterHoursViolations,
  slaSuccessRate,
  comparison,
}: StatsCardsProps) {
  const { t } = useI18n();
  const successPercent = (slaSuccessRate * 100).toFixed(1);

  const y = comparison?.current;
  const p = comparison?.prev;

  const cards = [
    {
      label: t.stats.avgResponseTime,
      sub: y ? y.label : t.stats.avgResponseTimeSub,
      value: y ? (y.avgResponseTimeMinutes > 0 ? `${y.avgResponseTimeMinutes}m` : "—") : (avgResponseTimeMinutes > 0 ? `${avgResponseTimeMinutes}m` : "—"),
      delta: y && p ? <DeltaBadge current={y.avgResponseTimeMinutes} prev={p.avgResponseTimeMinutes} higherIsBetter={false} /> : null,
      icon: Timer,
      iconColor: "text-blue-600",
      iconBg: "bg-blue-50",
      accent: "#2563eb",
    },
    {
      label: t.stats.slaSuccessRate,
      sub: y ? y.label : undefined,
      value: y ? `${(y.slaSuccessRate * 100).toFixed(1)}%` : `${successPercent}%`,
      delta: y && p ? <DeltaBadge current={y.slaSuccessRate * 100} prev={p.slaSuccessRate * 100} higherIsBetter={true} /> : null,
      icon: CheckCircle,
      iconColor: "text-emerald-600",
      iconBg: "bg-emerald-50",
      accent: "#059669",
    },
    {
      label: t.stats.workingHoursViolations,
      sub: y ? y.label : t.stats.workingHoursSub,
      value: y ? y.inHoursViolations.toLocaleString("en-US") : inHoursViolations.toLocaleString("en-US"),
      delta: y && p ? <DeltaBadge current={y.inHoursViolations} prev={p.inHoursViolations} higherIsBetter={false} /> : null,
      icon: AlertTriangle,
      iconColor: "text-red-600",
      iconBg: "bg-red-50",
      accent: "#dc2626",
    },
    {
      label: t.stats.afterHoursViolations,
      sub: y ? y.label : t.stats.afterHoursSub,
      value: y ? y.afterHoursViolations.toLocaleString("en-US") : afterHoursViolations.toLocaleString("en-US"),
      delta: y && p ? <DeltaBadge current={y.afterHoursViolations} prev={p.afterHoursViolations} higherIsBetter={false} /> : null,
      icon: Moon,
      iconColor: "text-indigo-600",
      iconBg: "bg-indigo-50",
      accent: "#4f46e5",
    },
    {
      label: t.stats.pendingSLA,
      sub: t.stats.pendingSLASub,
      value: pendingBreachedCount.toLocaleString("en-US"),
      delta: null,
      icon: Clock,
      iconColor: "text-rose-600",
      iconBg: "bg-rose-50",
      accent: "#e11d48",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="relative bg-card rounded-xl ring-1 ring-foreground/10 px-5 py-4 hover:shadow-md transition-all overflow-hidden"
        >
          <span
            className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
            style={{ background: card.accent }}
          />
          <div className="flex items-start justify-between gap-2 mb-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground leading-tight">
              {card.label}
            </p>
            <div className={`shrink-0 p-1.5 rounded-md ${card.iconBg}`}>
              <card.icon className={`w-3.5 h-3.5 ${card.iconColor}`} />
            </div>
          </div>
          <p className="text-3xl font-bold tracking-tight tabular-nums leading-none">
            {card.value}
          </p>
          <div className="flex items-center justify-between mt-2">
            {card.sub && (
              <p className="text-[11px] text-muted-foreground/60 leading-tight">
                {card.sub}
              </p>
            )}
            {card.delta}
          </div>
        </div>
      ))}
    </div>
  );
}
