"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";
import type { ResponseTimeTrendDay } from "@/lib/services/dashboard";
import type { ChartPeriod } from "./violations-trend-chart";

interface ResponseTimeTrendChartProps {
  data: ResponseTimeTrendDay[];
  loading?: boolean;
  period?: ChartPeriod;
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-white px-3 py-2.5 shadow-lg text-xs min-w-[130px]">
      <p className="font-semibold text-zinc-700 mb-2">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center justify-between gap-4 mb-1 last:mb-0">
          <div className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: entry.color }}
            />
            <span className="text-muted-foreground">{entry.name}</span>
          </div>
          <span className="font-semibold tabular-nums">{entry.value}m</span>
        </div>
      ))}
    </div>
  );
}

export default function ResponseTimeTrendChart({
  data,
  loading,
  period = 30,
}: ResponseTimeTrendChartProps) {
  const { t } = useI18n();

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium text-muted-foreground">
          {t.dashboard.responseTimeTitle}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-48 rounded-lg bg-zinc-100 animate-pulse" />
        ) : (
          <ResponsiveContainer width="100%" height={192}>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="gradInbox" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradComment" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
                interval={period === 30 ? 4 : period === 14 ? 1 : 0}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
                width={28}
                unit="m"
              />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: "#e5e7eb", strokeWidth: 1 }} />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
              />
              <Area
                type="monotone"
                dataKey="inbox"
                name={t.dashboard.chartInbox}
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#gradInbox)"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
                connectNulls={false}
              />
              <Area
                type="monotone"
                dataKey="comment"
                name={t.dashboard.chartComment}
                stroke="#f97316"
                strokeWidth={2}
                fill="url(#gradComment)"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
                connectNulls={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
