"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CalendarRange, ChevronDown, LayoutDashboard } from "lucide-react";
import { useData } from "@/components/DataProvider";
import { LoadState } from "@/components/LoadState";
import { IncomeVsGivenChart } from "@/components/Charts";
import { RecipientAvatar } from "@/components/RecipientAvatar";
import { TransactionList } from "@/components/TransactionList";
import { Card, CardTitle, EmptyState, PageHeader } from "@/components/ui/primitives";
import { MONTH_NAMES, MONTH_SHORT, RECIPIENTS, RECIPIENT_META } from "@/lib/constants";
import { availableYears, computeYearlySummary, filterTransactions } from "@/lib/calculations";
import { formatINR, monthLabel } from "@/lib/format";
import { cn } from "@/lib/api-client";
import type { MonthlySummary } from "@/lib/types";

export default function HistoryPage() {
  return (
    <>
      <PageHeader title="History" subtitle="Year-wise and month-wise records" />
      <LoadState>
        <HistoryContent />
      </LoadState>
    </>
  );
}

function HistoryContent() {
  const { incomes, transactions, period } = useData();
  const years = useMemo(() => availableYears(incomes, transactions, period.year), [incomes, transactions, period.year]);
  const [year, setYear] = useState(period.year);
  const [open, setOpen] = useState<number | null>(null);

  const summary = useMemo(() => computeYearlySummary(incomes, transactions, year), [incomes, transactions, year]);
  const activeMonths = summary.months.filter((m) => m.hasIncome || m.transactionCount > 0).reverse();
  const chart = summary.months.map((m) => ({ label: MONTH_SHORT[m.month - 1].charAt(0), income: m.income, given: m.totalGiven }));

  return (
    <div className="space-y-4">
      {/* Year picker */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Select year">
        {years.map((y) => (
          <button
            key={y}
            onClick={() => {
              setYear(y);
              setOpen(null);
            }}
            aria-pressed={year === y}
            className={cn(
              "min-h-10 shrink-0 rounded-full px-4 text-sm font-semibold ring-1 transition-colors",
              year === y ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50",
            )}
          >
            {y}
          </button>
        ))}
      </div>

      {/* Year totals */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Mini label="Total yearly income" value={formatINR(summary.totalIncome)} hint={`${summary.monthsWithIncome} month${summary.monthsWithIncome === 1 ? "" : "s"} recorded`} />
        <Mini label="Total given to family" value={formatINR(summary.totalGiven)} hint={`${summary.transactionCount} payments`} />
        <Mini
          label="Yearly remaining"
          value={formatINR(summary.remaining)}
          hint={summary.remaining < 0 ? "Over budget" : "Income − payments"}
          danger={summary.remaining < 0}
        />
        <Mini
          label="Average given / month"
          value={formatINR(activeMonths.length ? Math.round(summary.totalGiven / activeMonths.length) : 0)}
          hint={`over ${activeMonths.length} active month${activeMonths.length === 1 ? "" : "s"}`}
        />
      </div>

      {summary.remaining < 0 && (
        <div role="alert" className="flex gap-3 rounded-2xl bg-rose-50 p-4 text-sm text-rose-800 ring-1 ring-rose-200">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
          <p>
            In {year} you gave <strong className="num">{formatINR(Math.abs(summary.remaining))}</strong> more than your recorded income.
          </p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Person-wise totals · {year}</CardTitle>
          <ul className="space-y-3">
            {RECIPIENTS.map((r) => {
              const pct = summary.totalGiven ? Math.round((summary.totals[r] / summary.totalGiven) * 100) : 0;
              return (
                <li key={r} className="flex items-center gap-3">
                  <RecipientAvatar recipient={r} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-medium text-slate-700">{r}</span>
                      <span className="num text-sm font-semibold text-slate-900">{formatINR(summary.totals[r])}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: RECIPIENT_META[r].color }} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
        <Card>
          <CardTitle>Income vs payments · {year}</CardTitle>
          <IncomeVsGivenChart data={chart} height={220} />
        </Card>
      </div>

      <Card>
        <CardTitle>Monthly breakdown</CardTitle>
        {activeMonths.length === 0 ? (
          <EmptyState icon={CalendarRange} title={`No records in ${year}`} description="Income and payments you add will appear here, month by month." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {activeMonths.map((m) => (
              <MonthRow key={m.month} m={m} open={open === m.month} onToggle={() => setOpen(open === m.month ? null : m.month)} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function MonthRow({ m, open, onToggle }: { m: MonthlySummary; open: boolean; onToggle: () => void }) {
  const { transactions, setPeriod } = useData();
  const router = useRouter();
  const txs = useMemo(
    () => (open ? filterTransactions(transactions, { year: m.year, month: m.month, sort: "date_desc" }) : []),
    [open, transactions, m.year, m.month],
  );

  return (
    <li>
      <button onClick={onToggle} className="flex w-full items-center gap-3 py-3 text-left" aria-expanded={open}>
        <div className="flex size-11 shrink-0 flex-col items-center justify-center rounded-xl bg-slate-50 ring-1 ring-slate-100">
          <span className="text-[11px] font-semibold uppercase text-slate-500">{MONTH_SHORT[m.month - 1]}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-900">{MONTH_NAMES[m.month - 1]}</p>
          <p className="num truncate text-xs text-slate-500">
            In {m.hasIncome ? formatINR(m.income) : "—"} · Given {formatINR(m.totalGiven)}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className={cn("num text-sm font-semibold", m.isOverspent ? "text-rose-600" : "text-emerald-700")}>{formatINR(m.remaining)}</p>
          <p className="text-[11px] text-slate-400">remaining</p>
        </div>
        <ChevronDown className={cn("size-4 shrink-0 text-slate-400 transition-transform", open && "rotate-180")} aria-hidden />
      </button>

      {open && (
        <div className="animate-fade-in mb-3 rounded-xl bg-slate-50 p-3">
          <div className="grid grid-cols-3 gap-2">
            {RECIPIENTS.map((r) => (
              <div key={r} className="min-w-0 rounded-lg bg-white px-2 py-1.5 ring-1 ring-slate-100">
                <p className="flex items-center gap-1 text-[11px] text-slate-500">
                  <span className="size-1.5 rounded-full" style={{ backgroundColor: RECIPIENT_META[r].color }} />
                  {r}
                </p>
                <p className="num truncate text-sm font-semibold text-slate-800">{formatINR(m.totals[r])}</p>
              </div>
            ))}
          </div>
          <div className="mt-2 rounded-lg bg-white px-3 ring-1 ring-slate-100">
            {txs.length ? (
              <TransactionList transactions={txs} compact />
            ) : (
              <p className="py-4 text-center text-sm text-slate-500">No payments in {monthLabel(m.year, m.month)}</p>
            )}
          </div>
          <button
            onClick={() => {
              setPeriod({ year: m.year, month: m.month });
              router.push("/");
            }}
            className="mt-2 inline-flex min-h-10 items-center gap-1.5 rounded-xl px-2 text-sm font-medium text-brand-600 hover:bg-brand-50"
          >
            <LayoutDashboard className="size-4" aria-hidden /> Open in dashboard
          </button>
        </div>
      )}
    </li>
  );
}

function Mini({ label, value, hint, danger }: { label: string; value: string; hint: string; danger?: boolean }) {
  return (
    <Card className={cn("min-w-0 p-3.5 sm:p-4", danger && "ring-rose-200")}>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={cn("num mt-1 truncate text-lg font-semibold tracking-tight", danger ? "text-rose-600" : "text-slate-900")} title={value}>
        {value}
      </p>
      <p className={cn("mt-0.5 truncate text-xs", danger ? "font-medium text-rose-600" : "text-slate-400")}>{hint}</p>
    </Card>
  );
}
