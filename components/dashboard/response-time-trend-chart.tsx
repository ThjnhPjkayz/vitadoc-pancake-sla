"use client";

import {
  LineChart,
  Line,
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
            <LineChart data={data}>
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
              <Tooltip
                cursor={{ stroke: "#e5e7eb" }}
                contentStyle={{
                  fontSize: 12,
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                }}
                formatter={(value) => [`${value}m`, undefined]}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
              />
              <Line
                type="monotone"
                dataKey="inbox"
                name={t.dashboard.chartInbox}
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                connectNulls={false}
              />
              <Line
                type="monotone"
                dataKey="comment"
                name={t.dashboard.chartComment}
                stroke="#f97316"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
