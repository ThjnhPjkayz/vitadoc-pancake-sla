"use client";

import { MessageSquare, AlertTriangle, CheckCircle, Clock, Moon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";

interface StatsCardsProps {
  totalConversations: number;
  pendingBreachedCount: number;
  inHoursViolations: number;
  afterHoursViolations: number;
  slaSuccessRate: number;
}

export default function StatsCards({
  totalConversations,
  pendingBreachedCount,
  inHoursViolations,
  afterHoursViolations,
  slaSuccessRate,
}: StatsCardsProps) {
  const { t } = useI18n();
  const successPercent = (slaSuccessRate * 100).toFixed(1);

  const cards = [
    {
      label: t.stats.totalConversations,
      value: totalConversations.toLocaleString("en-US"),
      icon: MessageSquare,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: t.stats.slaSuccessRate,
      value: `${successPercent}%`,
      icon: CheckCircle,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      label: t.stats.workingHoursViolations,
      sub: t.stats.workingHoursSub,
      value: inHoursViolations.toLocaleString("en-US"),
      icon: AlertTriangle,
      color: "text-red-600",
      bg: "bg-red-50",
    },
    {
      label: t.stats.afterHoursViolations,
      sub: t.stats.afterHoursSub,
      value: afterHoursViolations.toLocaleString("en-US"),
      icon: Moon,
      color: "text-indigo-600",
      bg: "bg-indigo-50",
    },
    {
      label: t.stats.pendingSLA,
      sub: t.stats.pendingSLASub,
      value: pendingBreachedCount.toLocaleString("en-US"),
      icon: Clock,
      color: "text-rose-600",
      bg: "bg-rose-50",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {cards.map((card) => (
        <Card key={card.label} className="hover:shadow-md transition-shadow">
          <CardContent className="flex flex-col gap-2 pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{card.label}</p>
                {card.sub && (
                  <p className="text-[11px] text-muted-foreground/60 mt-0.5">{card.sub}</p>
                )}
              </div>
              <div className={`p-2 rounded-lg ${card.bg} shrink-0`}>
                <card.icon className={`w-4 h-4 ${card.color}`} />
              </div>
            </div>
            <span className="text-2xl font-bold tracking-tight">{card.value}</span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
