"use client";

import { useMemo, useState } from "react";
import { CalendarDays, CalendarRange, FileDown, FileSpreadsheet, FileText, Wallet, type LucideIcon } from "lucide-react";
import { useData } from "@/components/DataProvider";
import { LoadState } from "@/components/LoadState";
import { MonthSwitcher, pickerYears } from "@/components/MonthSwitcher";
import { Button, Card, PageHeader } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";
import { availableYears, computeAllTimeSummary, computeMonthlySummary, computeYearlySummary } from "@/lib/calculations";
import { formatINR, monthLabel } from "@/lib/format";
import { downloadFile, cn } from "@/lib/api-client";

export default function ReportsPage() {
  return (
    <>
      <PageHeader title="Reports & Export" subtitle="Download Excel or CSV files" />
      <LoadState>
        <ReportsContent />
      </LoadState>
    </>
  );
}

type ExportType = "month" | "year" | "income" | "full";

function ReportsContent() {
  const { incomes, transactions, period } = useData();
  const toast = useToast();
  const [sel, setSel] = useState(period);
  const [year, setYear] = useState(period.year);
  const [busy, setBusy] = useState<string | null>(null);

  const years = useMemo(() => pickerYears(availableYears(incomes, transactions, period.year)), [incomes, transactions, period.year]);
  const month = useMemo(() => computeMonthlySummary(incomes, transactions, sel.year, sel.month), [incomes, transactions, sel]);
  const yearly = useMemo(() => computeYearlySummary(incomes, transactions, year), [incomes, transactions, year]);
  const all = useMemo(() => computeAllTimeSummary(incomes, transactions), [incomes, transactions]);

  async function download(type: ExportType, format: "csv" | "xlsx") {
    const key = `${type}-${format}`;
    const params = new URLSearchParams({ type, format });
    if (type === "month") {
      params.set("year", String(sel.year));
      params.set("month", String(sel.month));
    }
    if (type === "year") params.set("year", String(year));
    setBusy(key);
    try {
      const name = await downloadFile(`/api/export?${params}`);
      toast.success(`Downloaded ${name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setBusy(null);
    }
  }

  const buttons = (type: ExportType) => (
    <div className="mt-4 grid grid-cols-2 gap-2">
      <Button icon={FileSpreadsheet} loading={busy === `${type}-xlsx`} disabled={busy !== null} onClick={() => download(type, "xlsx")}>
        Excel
      </Button>
      <Button variant="secondary" icon={FileText} loading={busy === `${type}-csv`} disabled={busy !== null} onClick={() => download(type, "csv")}>
        CSV
      </Button>
    </div>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ExportCard icon={CalendarDays} title="Selected month's transactions" description="Every payment in one month with a summary sheet.">
        <MonthSwitcher year={sel.year} month={sel.month} years={years} onChange={setSel} />
        <Facts
          items={[
            ["Income", formatINR(month.income)],
            ["Given", formatINR(month.totalGiven)],
            ["Remaining", formatINR(month.remaining), month.isOverspent],
            ["Payments", String(month.transactionCount)],
          ]}
        />
        {buttons("month")}
      </ExportCard>

      <ExportCard icon={CalendarRange} title="Yearly transaction history" description="All payments in a year, month-wise breakdown and totals.">
        <select
          aria-label="Year to export"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="h-11 w-full rounded-xl border-0 bg-slate-50 px-3 text-sm font-semibold text-slate-800 ring-1 ring-inset ring-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <Facts
          items={[
            ["Income", formatINR(yearly.totalIncome)],
            ["Given", formatINR(yearly.totalGiven)],
            ["Remaining", formatINR(yearly.remaining), yearly.remaining < 0],
            ["Payments", String(yearly.transactionCount)],
          ]}
        />
        {buttons("year")}
      </ExportCard>

      <ExportCard icon={Wallet} title="Income history" description="Month | Year | Income Amount | Description for every month recorded.">
        <Facts
          items={[
            ["Months", String(all.incomeCount)],
            ["Total income", formatINR(all.totalIncome)],
          ]}
        />
        {buttons("income")}
      </ExportCard>

      <ExportCard
        icon={FileDown}
        title="Complete financial report"
        description="Summary, month-wise breakdown, all income and all transactions in one file."
      >
        <Facts
          items={[
            ["Total income", formatINR(all.totalIncome)],
            ["Total given", formatINR(all.totalGiven)],
            ["Mummy", formatINR(all.totals.Mummy)],
            ["Papa", formatINR(all.totals.Papa)],
            ["Brother", formatINR(all.totals.Brother)],
            ["Remaining", formatINR(all.remaining), all.remaining < 0],
          ]}
        />
        {buttons("full")}
      </ExportCard>

      <p className="text-xs text-slate-400 lg:col-span-2">
        Exports are generated from the latest data in your Google Sheet. Excel files open in Microsoft Excel, Google Sheets and
        LibreOffice. Selected month: {monthLabel(sel.year, sel.month)}.
      </p>
    </div>
  );
}

function ExportCard({ icon: Icon, title, description, children }: { icon: LucideIcon; title: string; description: string; children: React.ReactNode }) {
  return (
    <Card className="flex flex-col">
      <div className="mb-4 flex gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <Icon className="size-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <p className="mt-0.5 text-xs text-slate-500">{description}</p>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3">{children}</div>
    </Card>
  );
}

function Facts({ items }: { items: [string, string, boolean?][] }) {
  return (
    <dl className="grid grid-cols-2 gap-2">
      {items.map(([k, v, danger]) => (
        <div key={k} className="min-w-0 rounded-lg bg-slate-50 px-3 py-2">
          <dt className="text-[11px] text-slate-500">{k}</dt>
          <dd className={cn("num truncate text-sm font-semibold", danger ? "text-rose-600" : "text-slate-800")}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}
