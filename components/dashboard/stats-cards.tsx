"use client";

import { Timer, AlertTriangle, CheckCircle, Clock, Moon } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface StatsCardsProps {
  avgResponseTimeMinutes: number;
  pendingBreachedCount: number;
  inHoursViolations: number;
  afterHoursViolations: number;
  slaSuccessRate: number;
}

export default function StatsCards({
  avgResponseTimeMinutes,
  pendingBreachedCount,
  inHoursViolations,
  afterHoursViolations,
  slaSuccessRate,
}: StatsCardsProps) {
  const { t } = useI18n();
  const successPercent = (slaSuccessRate * 100).toFixed(1);

  const cards = [
    {
      label: t.stats.avgResponseTime,
      sub: t.stats.avgResponseTimeSub,
      value: avgResponseTimeMinutes > 0 ? `${avgResponseTimeMinutes}m` : "—",
      icon: Timer,
      iconColor: "text-blue-600",
      iconBg: "bg-blue-50",
      accent: "#2563eb",
    },
    {
      label: t.stats.slaSuccessRate,
      value: `${successPercent}%`,
      icon: CheckCircle,
      iconColor: "text-emerald-600",
      iconBg: "bg-emerald-50",
      accent: "#059669",
    },
    {
      label: t.stats.workingHoursViolations,
      sub: t.stats.workingHoursSub,
      value: inHoursViolations.toLocaleString("en-US"),
      icon: AlertTriangle,
      iconColor: "text-red-600",
      iconBg: "bg-red-50",
      accent: "#dc2626",
    },
    {
      label: t.stats.afterHoursViolations,
      sub: t.stats.afterHoursSub,
      value: afterHoursViolations.toLocaleString("en-US"),
      icon: Moon,
      iconColor: "text-indigo-600",
      iconBg: "bg-indigo-50",
      accent: "#4f46e5",
    },
    {
      label: t.stats.pendingSLA,
      sub: t.stats.pendingSLASub,
      value: pendingBreachedCount.toLocaleString("en-US"),
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
          {card.sub && (
            <p className="text-[11px] text-muted-foreground/60 mt-2 leading-tight">
              {card.sub}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
