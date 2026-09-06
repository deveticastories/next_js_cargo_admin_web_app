"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { colors } from "@/utils/colors";
import { chartTick } from "@/utils/sizes";

export interface BookingsBarChartProps {
  data: { month: string; count: number }[];
  height?: number;
}

/** Bar chart of booking counts by month. Used on the dashboard and in Reports. */
export function BookingsBarChart({ data, height = 220 }: BookingsBarChartProps) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid stroke={colors.border} vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fontSize: chartTick.fontSize, fill: colors.textSoft }}
            axisLine={{ stroke: colors.border }}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: chartTick.fontSize, fill: colors.textSoft }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${colors.border}` }} />
          <Bar dataKey="count" fill={colors.accent} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
