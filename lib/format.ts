import { MONTH_NAMES, MONTH_SHORT } from "./constants";

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const inrCompact = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  notation: "compact",
  maximumFractionDigits: 1,
});

const inrPaise = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** ₹1,23,456 or ₹1,23,456.50 — Indian digit grouping. Negative values keep the minus sign. */
export function formatINR(value: number): string {
  if (!Number.isFinite(value)) return "₹0";
  return Number.isInteger(Math.round(value * 100) / 100) ? inrFormatter.format(value) : inrPaise.format(value);
}

/** ₹1.2L style for chart axes. */
export function formatINRCompact(value: number): string {
  if (!Number.isFinite(value)) return "₹0";
  return inrCompact.format(value);
}

export function monthLabel(year: number, month: number, short = false): string {
  const names = short ? MONTH_SHORT : MONTH_NAMES;
  return `${names[month - 1] ?? "?"} ${year}`;
}

/** "05 Nov 2026" from an ISO date (no timezone shifting). */
export function formatDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${m[3]} ${MONTH_SHORT[Number(m[2]) - 1]} ${m[1]}`;
}

/** Today's date in the user's local timezone as YYYY-MM-DD. */
export function todayISO(): string {
  const d = new Date();
  return toISODate(d);
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function currentYearMonth(): { year: number; month: number } {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}
