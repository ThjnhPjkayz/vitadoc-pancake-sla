"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";
import type { ViolationsTrendDay } from "@/lib/services/dashboard";

export type ChartPeriod = "yesterday" | "7d" | "30d";

const COLOR_ON_TIME = "#10b981"; // --chart-2 (emerald-500)
const COLOR_LATE    = "#ef4444"; // --chart-3 (red-500)

interface ViolationsTrendChartProps {
  data: ViolationsTrendDay[];
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
  const total = payload.reduce((s, p) => s + (p.value || 0), 0);
  return (
    <div className="rounded-lg border bg-white px-3 py-2.5 shadow-lg text-xs min-w-[130px]">
      <p className="font-semibold text-zinc-700 mb-2">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center justify-between gap-4 mb-1">
          <div className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: entry.color }}
            />
            <span className="text-muted-foreground">{entry.name}</span>
          </div>
          <span className="font-semibold tabular-nums">{entry.value}</span>
        </div>
      ))}
      {payload.length > 1 && (
        <div className="flex items-center justify-between gap-4 mt-1.5 pt-1.5 border-t border-zinc-100">
          <span className="text-zinc-400">Total</span>
          <span className="font-bold tabular-nums">{total}</span>
        </div>
      )}
    </div>
  );
}

export default function ViolationsTrendChart({
  data,
  loading,
  period = "30d",
}: ViolationsTrendChartProps) {
  const { t } = useI18n();

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium text-muted-foreground">
          {t.dashboard.violationsTitle}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-48 rounded-lg bg-zinc-100 animate-pulse" />
        ) : (
          <ResponsiveContainer width="100%" height={192}>
            <BarChart data={data} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
                interval={period === "30d" ? 4 : 0}
                tickFormatter={(v) => period === "yesterday" ? (Number(v.replace("h","")) % 3 === 0 ? v : "") : v}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
                width={28}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f9fafb" }} />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
              />
              <Bar
                dataKey="onTime"
                name={t.dashboard.chartOnTime}
                stackId="a"
                fill={COLOR_ON_TIME}
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="late"
                name={t.dashboard.chartLate}
                stackId="a"
                fill={COLOR_LATE}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
