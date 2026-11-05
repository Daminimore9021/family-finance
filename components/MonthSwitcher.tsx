"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { MONTH_NAMES } from "@/lib/constants";
import { shiftMonth } from "@/lib/format";

interface Props {
  year: number;
  month: number;
  years: number[];
  onChange: (p: { year: number; month: number }) => void;
}

const selectCls =
  "h-11 min-w-0 appearance-none rounded-xl bg-transparent px-2 text-center text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500";

/** Previous / month / year / next control used on the dashboard and reports. */
export function MonthSwitcher({ year, month, years, onChange }: Props) {
  const yearOptions = years.includes(year) ? years : [...years, year].sort((a, b) => b - a);
  return (
    <div className="flex items-center justify-between gap-1 rounded-2xl bg-white p-1 shadow-sm ring-1 ring-slate-100">
      <button
        onClick={() => onChange(shiftMonth(year, month, -1))}
        className="flex size-11 shrink-0 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-50 active:bg-slate-100"
        aria-label="Previous month"
      >
        <ChevronLeft className="size-5" />
      </button>
      <div className="flex min-w-0 flex-1 items-center justify-center">
        <select
          aria-label="Month"
          value={month}
          onChange={(e) => onChange({ year, month: Number(e.target.value) })}
          className={selectCls}
        >
          {MONTH_NAMES.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </select>
        <select
          aria-label="Year"
          value={year}
          onChange={(e) => onChange({ year: Number(e.target.value), month })}
          className={selectCls}
        >
          {yearOptions.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>
      <button
        onClick={() => onChange(shiftMonth(year, month, 1))}
        className="flex size-11 shrink-0 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-50 active:bg-slate-100"
        aria-label="Next month"
      >
        <ChevronRight className="size-5" />
      </button>
    </div>
  );
}

/** Years for pickers: data years plus a window around the current year. */
export function pickerYears(dataYears: number[]): number[] {
  const now = new Date().getFullYear();
  const set = new Set<number>(dataYears);
  for (let y = now + 1; y >= now - 5; y--) set.add(y);
  return [...set].sort((a, b) => b - a);
}
