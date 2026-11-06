"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, HandCoins, Plus, Receipt, RefreshCw, TrendingDown, Wallet, PiggyBank } from "lucide-react";
import { useData } from "@/components/DataProvider";
import { LoadState } from "@/components/LoadState";
import { MonthSwitcher, pickerYears } from "@/components/MonthSwitcher";
import { IncomeVsGivenChart, PersonChart } from "@/components/Charts";
import { RecipientAvatar } from "@/components/RecipientAvatar";
import { TransactionList } from "@/components/TransactionList";
import { Card, CardTitle, EmptyState, PageHeader } from "@/components/ui/primitives";
import { RECIPIENTS, RECIPIENT_META, MONTH_SHORT } from "@/lib/constants";
import {
  availableYears,
  computeAllTimeSummary,
  computeMonthlySummary,
  filterTransactions,
  trailingMonths,
} from "@/lib/calculations";
import { currentYearMonth, formatINR, monthLabel } from "@/lib/format";
import { cn } from "@/lib/api-client";

export default function DashboardPage() {
  return (
    <>
      <DashboardHeader />
      <LoadState>
        <Dashboard />
      </LoadState>
    </>
  );
}

function DashboardHeader() {
  const { refresh, refreshing, loading } = useData();
  return (
    <PageHeader
      title="Dashboard"
      subtitle="Your income and family payments"
      action={
        !loading && (
          <button
            onClick={() => void refresh()}
            className="flex size-11 items-center justify-center rounded-xl bg-white text-slate-500 shadow-sm ring-1 ring-slate-100 hover:text-brand-600"
            aria-label="Refresh data from Google Sheets"
          >
            <RefreshCw className={cn("size-5", refreshing && "animate-spin")} />
          </button>
        )
      }
    />
  );
}

type Scope = "all" | "month";
const SCOPE_KEY = "fft.dashScope";

function Dashboard() {
  const { incomes, transactions, period, setPeriod } = useData();
  const { year, month } = period;

  // "All time" by default so the cards always reflect every record in the sheet.
  const [scope, setScopeState] = useState<Scope>("all");
  useEffect(() => {
    try {
      if (localStorage.getItem(SCOPE_KEY) === "month") setScopeState("month");
    } catch {
      /* storage unavailable */
    }
  }, []);
  const setScope = (s: Scope) => {
    setScopeState(s);
    try {
      localStorage.setItem(SCOPE_KEY, s);
    } catch {
      /* storage unavailable */
    }
  };
  const allTime = scope === "all";

  const summary = useMemo(() => {
    if (!allTime) return computeMonthlySummary(incomes, transactions, year, month);
    const a = computeAllTimeSummary(incomes, transactions);
    return {
      income: a.totalIncome,
      hasIncome: a.incomeCount > 0,
      totals: a.totals,
      totalGiven: a.totalGiven,
      remaining: a.remaining,
      transactionCount: a.transactionCount,
      isOverspent: a.remaining < 0,
    };
  }, [allTime, incomes, transactions, year, month]);
  const recent = useMemo(
    () => filterTransactions(transactions, allTime ? { sort: "date_desc" } : { year, month, sort: "date_desc" }).slice(0, 5),
    [allTime, transactions, year, month],
  );
  const years = useMemo(() => pickerYears(availableYears(incomes, transactions, year)), [incomes, transactions, year]);
  const trendEnd = allTime ? currentYearMonth() : { year, month };
  const trend = useMemo(
    () =>
      trailingMonths(trendEnd.year, trendEnd.month, 6).map((p) => {
        const s = computeMonthlySummary(incomes, transactions, p.year, p.month);
        return { label: MONTH_SHORT[p.month - 1], income: s.income, given: s.totalGiven };
      }),
    [incomes, transactions, trendEnd.year, trendEnd.month],
  );

  const label = allTime ? "all time" : monthLabel(year, month);
  const usedPct = summary.income > 0 ? Math.round((summary.totalGiven / summary.income) * 100) : null;

  return (
    <div className="space-y-4">
      <div className="flex rounded-2xl bg-white p-1 shadow-sm ring-1 ring-slate-100" role="tablist" aria-label="Dashboard period">
        {(
          [
            ["all", "All time"],
            ["month", "Monthly"],
          ] as const
        ).map(([key, text]) => (
          <button
            key={key}
            role="tab"
            aria-selected={scope === key}
            onClick={() => setScope(key)}
            className={cn(
              "h-10 flex-1 rounded-xl text-sm font-semibold transition-colors",
              scope === key ? "bg-brand-600 text-white shadow-sm" : "text-slate-500 hover:text-brand-700",
            )}
          >
            {text}
          </button>
        ))}
      </div>

      {!allTime && <MonthSwitcher year={year} month={month} years={years} onChange={setPeriod} />}

      {!allTime && !summary.hasIncome && (
        <Card className="flex items-center gap-3 bg-brand-50/60 ring-brand-100">
          <Wallet className="size-5 shrink-0 text-brand-600" aria-hidden />
          <p className="min-w-0 flex-1 text-sm text-slate-700">No income added for {label} yet.</p>
          <Link
            href={`/income?year=${year}&month=${month}`}
            className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-xl bg-brand-600 px-3 text-sm font-medium text-white"
          >
            <Plus className="size-4" aria-hidden /> Add
          </Link>
        </Card>
      )}

      {summary.isOverspent && (
        <div role="alert" className="flex gap-3 rounded-2xl bg-rose-50 p-4 text-sm text-rose-800 ring-1 ring-rose-200">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
          <p>
            You have given <strong className="num">{formatINR(Math.abs(summary.remaining))}</strong> more than your income {allTime ? "overall" : `in ${label}`}.
          </p>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={Wallet}
          label={allTime ? "Total income" : "Monthly income"}
          value={formatINR(summary.income)}
          hint={allTime ? `${incomes.length} income entries` : summary.hasIncome ? label : "Not added"}
          tone="brand"
        />
        <StatCard
          icon={HandCoins}
          label="Given to family"
          value={formatINR(summary.totalGiven)}
          hint={usedPct !== null ? `${usedPct}% of income` : `${summary.transactionCount} payments`}
          tone="violet"
        />
        <StatCard
          icon={summary.isOverspent ? TrendingDown : PiggyBank}
          label="Remaining balance"
          value={formatINR(summary.remaining)}
          hint={summary.isOverspent ? "Over budget" : "Income − payments"}
          tone={summary.isOverspent ? "danger" : "success"}
        />
        <StatCard icon={Receipt} label="Transactions" value={String(summary.transactionCount)} hint={allTime ? "all time" : `in ${MONTH_SHORT[month - 1]} ${year}`} tone="slate" />
      </div>

      {/* Person-wise breakdown */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Given to each person · {allTime ? "all time" : label}</CardTitle>
          <ul className="space-y-4">
            {RECIPIENTS.map((r) => {
              const v = summary.totals[r];
              const pct = summary.totalGiven > 0 ? (v / summary.totalGiven) * 100 : 0;
              return (
                <li key={r}>
                  <div className="flex items-center gap-3">
                    <RecipientAvatar recipient={r} size="sm" />
                    <span className="flex-1 text-sm font-medium text-slate-700">{r}</span>
                    <span className="num text-sm font-semibold text-slate-900">{formatINR(v)}</span>
                  </div>
                  <div className="ml-11 mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: RECIPIENT_META[r].color }} />
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-sm">
            <span className="text-slate-500">Total family payments</span>
            <span className="num font-semibold text-slate-900">{formatINR(summary.totalGiven)}</span>
          </div>
        </Card>

        <Card>
          <CardTitle>Person-wise split</CardTitle>
          <PersonChart totals={summary.totals} />
        </Card>
      </div>

      <Card>
        <CardTitle>Income vs family payments · last 6 months{allTime ? "" : ` to ${MONTH_SHORT[month - 1]} ${year}`}</CardTitle>
        <IncomeVsGivenChart data={trend} />
      </Card>

      <Card>
        <CardTitle
          action={
            <Link href="/payments" className="inline-flex min-h-9 items-center gap-1 text-sm font-medium text-brand-600">
              View all <ArrowRight className="size-4" aria-hidden />
            </Link>
          }
        >
          Recent transactions
        </CardTitle>
        {recent.length ? (
          <TransactionList transactions={recent} compact />
        ) : (
          <EmptyState
            icon={Receipt}
            title={allTime ? "No payments yet" : `No payments in ${label}`}
            description={allTime ? "Payments you record will show here." : "Payments you record for this month will show here."}
            action={
              <Link
                href="/payments"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-brand-700"
              >
                <Plus className="size-4" aria-hidden /> Add payment
              </Link>
            }
          />
        )}
      </Card>
    </div>
  );
}

const TONES = {
  brand: "bg-brand-50 text-brand-600",
  violet: "bg-violet-50 text-violet-600",
  success: "bg-emerald-50 text-emerald-600",
  danger: "bg-rose-50 text-rose-600",
  slate: "bg-slate-100 text-slate-600",
};

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint: string;
  tone: keyof typeof TONES;
}) {
  return (
    <Card className={cn("min-w-0 p-3.5 sm:p-4", tone === "danger" && "ring-rose-200")}>
      <div className={cn("mb-3 flex size-9 items-center justify-center rounded-xl", TONES[tone])}>
        <Icon className="size-[18px]" aria-hidden />
      </div>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={cn("num mt-0.5 truncate text-lg font-semibold tracking-tight sm:text-xl", tone === "danger" ? "text-rose-600" : "text-slate-900")} title={value}>
        {value}
      </p>
      <p className={cn("mt-0.5 truncate text-xs", tone === "danger" ? "font-medium text-rose-600" : "text-slate-400")}>{hint}</p>
    </Card>
  );
}
