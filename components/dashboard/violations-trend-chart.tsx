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

interface ViolationsTrendChartProps {
  data: ViolationsTrendDay[];
  loading?: boolean;
}

export default function ViolationsTrendChart({
  data,
  loading,
}: ViolationsTrendChartProps) {
  const { t } = useI18n();
  const inboxLabel = t.conversations.inboxTab;
  const commentLabel = t.conversations.commentsTab;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {t.dashboard.violationsTitle}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-48 rounded-lg bg-zinc-100 animate-pulse" />
        ) : (
          <ResponsiveContainer width="100%" height={192}>
            <BarChart data={data} barCategoryGap="30%" barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 12, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
                width={28}
              />
              <Tooltip
                cursor={{ fill: "#f9fafb" }}
                contentStyle={{
                  fontSize: 12,
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                }}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
              />
              <Bar dataKey="inbox" name={inboxLabel} fill="#ef4444" radius={[4, 4, 0, 0]} />
              <Bar dataKey="comment" name={commentLabel} fill="#f97316" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
