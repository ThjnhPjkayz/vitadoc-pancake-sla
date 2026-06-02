"use client";

import { MessageSquare, AlertTriangle, Clock, CheckCircle } from "lucide-react";

interface StatsCardsProps {
  totalConversations: number;
  totalMessages: number;
  lateReplyCount: number;
  avgResponseTimeMinutes: number;
  slaSuccessRate: number;
}

export default function StatsCards({
  totalConversations,
  totalMessages,
  lateReplyCount,
  avgResponseTimeMinutes,
  slaSuccessRate,
}: StatsCardsProps) {
  const successPercent = (slaSuccessRate * 100).toFixed(1);

  const cards = [
    {
      label: "Total Conversations",
      value: totalConversations.toLocaleString(),
      icon: MessageSquare,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Total Messages",
      value: totalMessages.toLocaleString(),
      icon: MessageSquare,
      color: "text-indigo-600",
      bg: "bg-indigo-50",
    },
    {
      label: "SLA Violations",
      value: lateReplyCount.toLocaleString(),
      icon: AlertTriangle,
      color: "text-red-600",
      bg: "bg-red-50",
    },
    {
      label: "Avg Response Time",
      value: `${avgResponseTimeMinutes}m`,
      icon: Clock,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      label: "SLA Success Rate",
      value: `${successPercent}%`,
      icon: CheckCircle,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-xl border border-zinc-200 bg-white p-4 flex flex-col gap-2 shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-500">{card.label}</span>
            <div className={`p-2 rounded-lg ${card.bg}`}>
              <card.icon className={`w-4 h-4 ${card.color}`} />
            </div>
          </div>
          <span className="text-2xl font-bold text-zinc-900">{card.value}</span>
        </div>
      ))}
    </div>
  );
}
