"use client";

import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PieChart as PieIcon } from "lucide-react";
import { RECIPIENTS, RECIPIENT_META } from "@/lib/constants";
import { formatINR, formatINRCompact } from "@/lib/format";
import type { RecipientTotals } from "@/lib/types";
import { EmptyState } from "./ui/primitives";

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  boxShadow: "0 4px 16px rgba(15,23,42,0.08)",
  fontSize: 12,
  padding: "8px 10px",
};

/** Donut of how the month's family payments split between Mummy, Papa and Brother. */
export function PersonChart({ totals }: { totals: RecipientTotals }) {
  const data = RECIPIENTS.map((r) => ({ name: r, value: totals[r], color: RECIPIENT_META[r].color })).filter((d) => d.value > 0);
  const total = data.reduce((a, d) => a + d.value, 0);

  if (total === 0) {
    return <EmptyState icon={PieIcon} title="No payments yet" description="The split between family members appears here." />;
  }

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative h-48 w-48 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="64%"
              outerRadius="100%"
              paddingAngle={data.length > 1 ? 2 : 0}
              stroke="#ffffff"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
            <Tooltip formatter={(v) => formatINR(Number(v))} contentStyle={tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs text-slate-500">Total</span>
          <span className="num text-base font-semibold text-slate-900">{formatINRCompact(total)}</span>
        </div>
      </div>
      <ul className="w-full space-y-2">
        {RECIPIENTS.map((r) => {
          const v = totals[r];
          const pct = total ? Math.round((v / total) * 100) : 0;
          return (
            <li key={r} className="flex items-center gap-3 text-sm">
              <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: RECIPIENT_META[r].color }} />
              <span className="flex-1 text-slate-600">{r}</span>
              <span className="num font-medium text-slate-900">{formatINR(v)}</span>
              <span className="num w-10 text-right text-xs text-slate-500">{pct}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export interface IncomeVsGivenPoint {
  label: string;
  income: number;
  given: number;
}

const INCOME_COLOR = "#94a3b8";
const GIVEN_COLOR = "#4f46e5";

/** Grouped bars: income vs. family payments per month (same ₹ axis). */
export function IncomeVsGivenChart({ data, height = 240 }: { data: IncomeVsGivenPoint[]; height?: number }) {
  return (
    <div style={{ height }} className="w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: -8, bottom: 0 }} barGap={2} barCategoryGap="22%">
          <CartesianGrid vertical={false} stroke="#eef0f4" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#64748b" }} interval={0} />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={52}
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            tickFormatter={(v) => formatINRCompact(Number(v))}
          />
          <Tooltip
            cursor={{ fill: "rgba(99,102,241,0.06)" }}
            formatter={(v, name) => [formatINR(Number(v)), name === "income" ? "Income" : "Given to family"]}
            contentStyle={tooltipStyle}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 12, color: "#475569" }}
            formatter={(value) => (value === "income" ? "Income" : "Given to family")}
          />
          <Bar dataKey="income" fill={INCOME_COLOR} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
          <Bar dataKey="given" fill={GIVEN_COLOR} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
