/**
 * Pure business-logic helpers. Shared by the dashboard, history, API filters
 * and exports so every screen computes figures the same way.
 *
 * All sums are done in integer paise to avoid floating point drift
 * (e.g. 0.1 + 0.2), then converted back to rupees.
 */
import { RECIPIENTS } from "./constants";
import type {
  DueRepeat,
  Income,
  MonthlySummary,
  Recipient,
  RecipientTotals,
  Transaction,
  TransactionFilter,
  YearlySummary,
} from "./types";

const toPaise = (n: number) => Math.round(n * 100);
const fromPaise = (p: number) => p / 100;

export function sumAmounts(values: number[]): number {
  return fromPaise(values.reduce((acc, v) => acc + toPaise(v), 0));
}

export function emptyTotals(): RecipientTotals {
  return RECIPIENTS.reduce((acc, r) => ({ ...acc, [r]: 0 }), {} as RecipientTotals);
}

/** Extract year and month from a YYYY-MM-DD string without timezone conversion. */
export function dateParts(iso: string): { year: number; month: number; day: number } {
  return {
    year: Number(iso.slice(0, 4)),
    month: Number(iso.slice(5, 7)),
    day: Number(iso.slice(8, 10)),
  };
}

export function isInMonth(tx: Transaction, year: number, month: number): boolean {
  const p = dateParts(tx.date);
  return p.year === year && p.month === month;
}

export function isInYear(tx: Transaction, year: number): boolean {
  return dateParts(tx.date).year === year;
}

/** Every income entry for a month (e.g. salary and freelancing), oldest first. */
export function incomesForMonth(incomes: Income[], year: number, month: number): Income[] {
  return incomes
    .filter((i) => i.year === year && i.month === month)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** What a payment really cost: for a loan, the part that has not come back. */
export function netAmount(tx: Pick<Transaction, "amount" | "kind" | "returnedAmount">): number {
  if (tx.kind !== "loan") return tx.amount;
  return fromPaise(Math.max(0, toPaise(tx.amount) - toPaise(tx.returnedAmount || 0)));
}

export function recipientTotals(transactions: Transaction[]): RecipientTotals {
  const paise = emptyTotals();
  for (const tx of transactions) {
    if (tx.recipient in paise) paise[tx.recipient] += toPaise(netAmount(tx));
  }
  for (const r of RECIPIENTS) paise[r] = fromPaise(paise[r]);
  return paise;
}

export function computeMonthlySummary(
  incomes: Income[],
  transactions: Transaction[],
  year: number,
  month: number,
): MonthlySummary {
  const incomeRecords = incomesForMonth(incomes, year, month);
  const monthTx = transactions.filter((t) => isInMonth(t, year, month));
  const totals = recipientTotals(monthTx);
  const totalGiven = sumAmounts(RECIPIENTS.map((r) => totals[r]));
  const income = sumAmounts(incomeRecords.map((i) => i.amount));
  const remaining = fromPaise(toPaise(income) - toPaise(totalGiven));
  return {
    year,
    month,
    income,
    hasIncome: incomeRecords.length > 0,
    incomeRecords,
    totals,
    totalGiven,
    remaining,
    transactionCount: monthTx.length,
    isOverspent: remaining < 0,
  };
}

export function computeYearlySummary(incomes: Income[], transactions: Transaction[], year: number): YearlySummary {
  const months = Array.from({ length: 12 }, (_, i) => computeMonthlySummary(incomes, transactions, year, i + 1));
  const totals = emptyTotals();
  for (const r of RECIPIENTS) totals[r] = sumAmounts(months.map((m) => m.totals[r]));
  const totalIncome = sumAmounts(months.map((m) => m.income));
  const totalGiven = sumAmounts(months.map((m) => m.totalGiven));
  return {
    year,
    months,
    totalIncome,
    totals,
    totalGiven,
    remaining: fromPaise(toPaise(totalIncome) - toPaise(totalGiven)),
    transactionCount: months.reduce((acc, m) => acc + m.transactionCount, 0),
    monthsWithIncome: months.filter((m) => m.hasIncome).length,
  };
}

/** Summary across every record ever stored (used by the full report export). */
export function computeAllTimeSummary(incomes: Income[], transactions: Transaction[]) {
  const totals = recipientTotals(transactions);
  const totalIncome = sumAmounts(incomes.map((i) => i.amount));
  const totalGiven = sumAmounts(RECIPIENTS.map((r) => totals[r]));
  return {
    totalIncome,
    totals,
    totalGiven,
    remaining: fromPaise(toPaise(totalIncome) - toPaise(totalGiven)),
    transactionCount: transactions.length,
    incomeCount: incomes.length,
  };
}

/** Years that have any data, always including `includeYear`, newest first. */
export function availableYears(incomes: Income[], transactions: Transaction[], includeYear: number): number[] {
  const set = new Set<number>([includeYear]);
  incomes.forEach((i) => set.add(i.year));
  transactions.forEach((t) => set.add(dateParts(t.date).year));
  return [...set].filter((y) => Number.isFinite(y)).sort((a, b) => b - a);
}

/** The `count` months ending with (and including) year/month, oldest first. */
export function trailingMonths(year: number, month: number, count: number): { year: number; month: number }[] {
  const out: { year: number; month: number }[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const index = year * 12 + (month - 1) - i;
    out.push({ year: Math.floor(index / 12), month: (index % 12) + 1 });
  }
  return out;
}

export function compareTransactions(a: Transaction, b: Transaction, sort: TransactionFilter["sort"] = "date_desc"): number {
  switch (sort) {
    case "date_asc":
      return a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt);
    case "amount_desc":
      return b.amount - a.amount || b.date.localeCompare(a.date);
    case "amount_asc":
      return a.amount - b.amount || b.date.localeCompare(a.date);
    case "date_desc":
    default:
      return b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt);
  }
}

export function filterTransactions(transactions: Transaction[], filter: TransactionFilter): Transaction[] {
  const search = filter.search?.trim().toLowerCase() ?? "";
  return transactions
    .filter((t) => {
      const p = dateParts(t.date);
      if (filter.year !== undefined && p.year !== filter.year) return false;
      if (filter.month !== undefined && p.month !== filter.month) return false;
      if (filter.recipient && filter.recipient !== "all" && t.recipient !== filter.recipient) return false;
      if (search) {
        const haystack = `${t.description} ${t.reason} ${t.notes}`.toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    })
    .sort((a, b) => compareTransactions(a, b, filter.sort));
}

/* ------------------------------------------------------------------ */
/* Reasons, loans, dues                                                */
/* ------------------------------------------------------------------ */

export const NO_REASON = "No reason";

/** Net amount per reason (case-insensitive), biggest first. Blank reasons are grouped. */
export function reasonBreakdown(transactions: Transaction[]): { label: string; amount: number; count: number }[] {
  const groups = new Map<string, { label: string; paise: number; count: number }>();
  for (const t of transactions) {
    const label = t.reason.trim() || NO_REASON;
    const key = label.toLowerCase();
    const g = groups.get(key) ?? { label, paise: 0, count: 0 };
    g.paise += toPaise(netAmount(t));
    g.count += 1;
    groups.set(key, g);
  }
  return [...groups.values()]
    .map((g) => ({ label: g.label, amount: fromPaise(g.paise), count: g.count }))
    .sort((a, b) => b.amount - a.amount || a.label.localeCompare(b.label));
}

/** Reasons used at least twice, most frequent first (for quick-pick chips). */
export function frequentReasons(transactions: Transaction[], limit = 8): string[] {
  return reasonBreakdown(transactions)
    .filter((r) => r.label !== NO_REASON && r.count >= 2)
    .sort((a, b) => b.count - a.count || b.amount - a.amount)
    .slice(0, limit)
    .map((r) => r.label);
}

export function loanSummary(transactions: Transaction[]) {
  const loans = transactions.filter((t) => t.kind === "loan");
  const pending = loans.map(netAmount);
  return {
    loanCount: loans.length,
    openCount: pending.filter((p) => p > 0).length,
    lent: sumAmounts(loans.map((t) => t.amount)),
    returned: sumAmounts(loans.map((t) => Math.min(t.returnedAmount || 0, t.amount))),
    pending: sumAmounts(pending),
  };
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Next occurrence of a repeating due. Day is clamped to the month (31 Jan -> 28 Feb). */
export function nextDueDate(iso: string, repeat: DueRepeat): string {
  const { year, month, day } = dateParts(iso);
  if (repeat === "none") return iso;
  const idx = year * 12 + (month - 1) + (repeat === "monthly" ? 1 : 12);
  const y = Math.floor(idx / 12);
  const m = (idx % 12) + 1;
  const d = Math.min(day, daysInMonth(y, m));
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Whole days from `fromIso` to `toIso` (negative when `toIso` is earlier). */
export function daysBetween(fromIso: string, toIso: string): number {
  const a = dateParts(fromIso);
  const b = dateParts(toIso);
  return Math.round((Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / 86_400_000);
}

export function isRecipient(value: unknown): value is Recipient {
  return typeof value === "string" && (RECIPIENTS as readonly string[]).includes(value);
}
