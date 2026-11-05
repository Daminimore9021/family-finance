"use client";

import { useMemo, useState } from "react";
import { Receipt, Search, X } from "lucide-react";
import { useData } from "@/components/DataProvider";
import { LoadState } from "@/components/LoadState";
import { PaymentForm } from "@/components/PaymentForm";
import { TransactionList } from "@/components/TransactionList";
import { Card, CardTitle, EmptyState, PageHeader } from "@/components/ui/primitives";
import { RECIPIENTS, RECIPIENT_META, MONTH_NAMES } from "@/lib/constants";
import { filterTransactions, recipientTotals, sumAmounts } from "@/lib/calculations";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/api-client";
import type { Recipient, SortOrder } from "@/lib/types";

export default function PaymentsPage() {
  return (
    <>
      <PageHeader title="Family Payments" subtitle="Record money given to Mummy, Papa or Brother" />
      <LoadState>
        <PaymentsContent />
      </LoadState>
    </>
  );
}

const SORT_LABELS: Record<SortOrder, string> = {
  date_desc: "Newest first",
  date_asc: "Oldest first",
  amount_desc: "Highest amount",
  amount_asc: "Lowest amount",
};

const ctrl =
  "h-11 w-full min-w-0 rounded-xl border-0 bg-slate-50 px-3 text-sm text-slate-800 ring-1 ring-inset ring-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500";

function PaymentsContent() {
  const { transactions, period } = useData();
  const [monthFilter, setMonthFilter] = useState(`${period.year}-${String(period.month).padStart(2, "0")}`);
  const [recipient, setRecipient] = useState<Recipient | "all">("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOrder>("date_desc");

  // Months that have payments, plus the currently selected one.
  const monthOptions = useMemo(() => {
    const set = new Set<string>(transactions.map((t) => t.date.slice(0, 7)));
    set.add(`${period.year}-${String(period.month).padStart(2, "0")}`);
    return [...set].sort().reverse();
  }, [transactions, period]);

  const filtered = useMemo(() => {
    const [y, m] = monthFilter === "all" ? [undefined, undefined] : monthFilter.split("-").map(Number);
    return filterTransactions(transactions, { year: y, month: m, recipient, search, sort });
  }, [transactions, monthFilter, recipient, search, sort]);

  const totals = useMemo(() => recipientTotals(filtered), [filtered]);
  const total = useMemo(() => sumAmounts(filtered.map((t) => t.amount)), [filtered]);
  const hasFilters = recipient !== "all" || search.trim() !== "";

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:items-start">
      <Card>
        <CardTitle>Add payment</CardTitle>
        <PaymentForm />
      </Card>

      <Card className="min-w-0">
        <CardTitle>Transactions</CardTitle>

        {/* Filters */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <select aria-label="Filter by month" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} className={ctrl}>
              <option value="all">All months</option>
              {monthOptions.map((k) => (
                <option key={k} value={k}>
                  {MONTH_NAMES[Number(k.slice(5, 7)) - 1]} {k.slice(0, 4)}
                </option>
              ))}
            </select>
            <select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as SortOrder)} className={ctrl}>
              {(Object.keys(SORT_LABELS) as SortOrder[]).map((s) => (
                <option key={s} value={s}>
                  {SORT_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search description, reason, notes"
              aria-label="Search transactions"
              className={cn(ctrl, "pl-9 text-base sm:text-sm")}
            />
          </div>
          <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Filter by recipient">
            {(["all", ...RECIPIENTS] as const).map((r) => {
              const active = recipient === r;
              return (
                <button
                  key={r}
                  onClick={() => setRecipient(r)}
                  aria-pressed={active}
                  className={cn(
                    "flex min-h-10 min-w-0 items-center justify-center gap-1.5 rounded-full px-1 text-[13px] font-medium ring-1 transition-colors",
                    active ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50",
                  )}
                >
                  {r !== "all" && <span className="size-2 rounded-full" style={{ backgroundColor: RECIPIENT_META[r].color }} />}
                  {r === "all" ? "All" : r}
                </button>
              );
            })}
          </div>
        </div>

        {/* Totals for the current filter */}
        <div className="mt-4 rounded-xl bg-slate-50 p-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm text-slate-600">
              {filtered.length} payment{filtered.length === 1 ? "" : "s"}
            </span>
            <span className="num text-base font-semibold text-slate-900">{formatINR(total)}</span>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {RECIPIENTS.map((r) => (
              <div key={r} className="min-w-0 rounded-lg bg-white px-2 py-1.5 ring-1 ring-slate-100">
                <p className="flex items-center gap-1 text-[11px] text-slate-500">
                  <span className="size-1.5 rounded-full" style={{ backgroundColor: RECIPIENT_META[r].color }} />
                  {r}
                </p>
                <p className="num truncate text-sm font-semibold text-slate-800">{formatINR(totals[r])}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-2">
          {filtered.length ? (
            <TransactionList transactions={filtered} />
          ) : (
            <EmptyState
              icon={Receipt}
              title={transactions.length ? "No matching payments" : "No payments yet"}
              description={transactions.length ? "Try a different month, person or search." : "Add your first payment using the form."}
              action={
                hasFilters ? (
                  <button
                    onClick={() => {
                      setRecipient("all");
                      setSearch("");
                    }}
                    className="inline-flex min-h-10 items-center gap-1 rounded-xl px-3 text-sm font-medium text-brand-600 hover:bg-brand-50"
                  >
                    <X className="size-4" aria-hidden /> Clear filters
                  </button>
                ) : undefined
              }
            />
          )}
        </div>
      </Card>
    </div>
  );
}
