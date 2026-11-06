import ExcelJS from "exceljs";
import { MONTH_NAMES, RECIPIENTS } from "@/lib/constants";
import {
  computeAllTimeSummary,
  computeMonthlySummary,
  computeYearlySummary,
  dateParts,
  filterTransactions,
} from "@/lib/calculations";
import { formatTime } from "@/lib/format";
import type { Income, Recipient, Transaction } from "@/lib/types";

export type ExportType = "month" | "year" | "income" | "full";
export type ExportFormat = "csv" | "xlsx";

type CellValue = string | number | Date | null;

interface SummaryRow {
  label: string;
  value: CellValue;
  money?: boolean;
}

interface Section {
  name: string; // worksheet name / CSV section title
  columns: { header: string; width: number; money?: boolean; date?: boolean }[];
  rows: CellValue[][];
  totalRow?: CellValue[];
}

interface Report {
  title: string;
  filename: string;
  summary: SummaryRow[];
  sections: Section[];
}

/* ------------------------------------------------------------------ */
/* report assembly                                                     */
/* ------------------------------------------------------------------ */

const TX_COLUMNS: Section["columns"] = [
  { header: "Date", width: 14, date: true },
  { header: "Time", width: 10 },
  { header: "Recipient", width: 12 },
  { header: "Amount (INR)", width: 16, money: true },
  { header: "Description", width: 32 },
  { header: "Reason", width: 24 },
  { header: "Notes", width: 32 },
];

const INCOME_COLUMNS: Section["columns"] = [
  { header: "Month", width: 14 },
  { header: "Year", width: 8 },
  { header: "Income Amount (INR)", width: 20, money: true },
  { header: "Description", width: 36 },
];

const BREAKDOWN_COLUMNS: Section["columns"] = [
  { header: "Month", width: 16 },
  { header: "Income (INR)", width: 15, money: true },
  { header: "Mummy (INR)", width: 14, money: true },
  { header: "Papa (INR)", width: 14, money: true },
  { header: "Brother (INR)", width: 14, money: true },
  { header: "Total Given (INR)", width: 17, money: true },
  { header: "Remaining (INR)", width: 16, money: true },
  { header: "Payments", width: 10 },
];

function isoToDate(iso: string): Date {
  const p = dateParts(iso);
  return new Date(Date.UTC(p.year, p.month - 1, p.day));
}

function txRows(txs: Transaction[]): CellValue[][] {
  return txs.map((t) => [isoToDate(t.date), formatTime(t.time), t.recipient, t.amount, t.description, t.reason, t.notes]);
}

function txTotal(txs: Transaction[]): CellValue[] {
  return ["Total", "", `${txs.length} payments`, txs.reduce((a, t) => a + Math.round(t.amount * 100), 0) / 100, "", "", ""];
}

function summaryRows(
  period: string,
  s: { totalIncome: number; totals: Record<Recipient, number>; totalGiven: number; remaining: number; count: number },
): SummaryRow[] {
  return [
    { label: "Period", value: period },
    { label: "Total Income", value: s.totalIncome, money: true },
    { label: "Total Family Payments", value: s.totalGiven, money: true },
    ...RECIPIENTS.map((r) => ({ label: `${r} Total`, value: s.totals[r], money: true })),
    { label: "Remaining Balance", value: s.remaining, money: true },
    { label: "Number of Payments", value: s.count },
    // Servers (e.g. Vercel) run in UTC; show the date as it is in India.
    { label: "Generated On", value: new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) },
  ];
}

function breakdownRow(m: ReturnType<typeof computeMonthlySummary>): CellValue[] {
  return [
    `${MONTH_NAMES[m.month - 1]} ${m.year}`,
    m.income,
    m.totals.Mummy,
    m.totals.Papa,
    m.totals.Brother,
    m.totalGiven,
    m.remaining,
    m.transactionCount,
  ];
}

export function buildReport(
  type: ExportType,
  incomes: Income[],
  transactions: Transaction[],
  year: number,
  month: number,
): Report {
  if (type === "month") {
    const s = computeMonthlySummary(incomes, transactions, year, month);
    const txs = filterTransactions(transactions, { year, month, sort: "date_asc" });
    const label = `${MONTH_NAMES[month - 1]} ${year}`;
    return {
      title: `Family Payments – ${label}`,
      filename: `family-payments-${year}-${String(month).padStart(2, "0")}`,
      summary: summaryRows(label, {
        totalIncome: s.income,
        totals: s.totals,
        totalGiven: s.totalGiven,
        remaining: s.remaining,
        count: s.transactionCount,
      }),
      sections: [{ name: "Transactions", columns: TX_COLUMNS, rows: txRows(txs), totalRow: txTotal(txs) }],
    };
  }

  if (type === "year") {
    const y = computeYearlySummary(incomes, transactions, year);
    const txs = filterTransactions(transactions, { year, sort: "date_asc" });
    return {
      title: `Family Payments – Year ${year}`,
      filename: `family-payments-${year}`,
      summary: summaryRows(`Year ${year}`, {
        totalIncome: y.totalIncome,
        totals: y.totals,
        totalGiven: y.totalGiven,
        remaining: y.remaining,
        count: y.transactionCount,
      }),
      sections: [
        { name: "Monthly Breakdown", columns: BREAKDOWN_COLUMNS, rows: y.months.map(breakdownRow) },
        { name: "Transactions", columns: TX_COLUMNS, rows: txRows(txs), totalRow: txTotal(txs) },
      ],
    };
  }

  const all = computeAllTimeSummary(incomes, transactions);
  const sortedIncome = [...incomes].sort((a, b) => a.year - b.year || a.month - b.month);
  const incomeSection: Section = {
    name: "Income",
    columns: INCOME_COLUMNS,
    rows: sortedIncome.map((i) => [MONTH_NAMES[i.month - 1], i.year, i.amount, i.description]),
    totalRow: ["Total", "", all.totalIncome, `${incomes.length} months`],
  };
  const allSummary = summaryRows("All time", {
    totalIncome: all.totalIncome,
    totals: all.totals,
    totalGiven: all.totalGiven,
    remaining: all.remaining,
    count: all.transactionCount,
  });

  if (type === "income") {
    return { title: "Income History", filename: "income-history", summary: allSummary, sections: [incomeSection] };
  }

  // full report: every month that has any data, oldest first
  const monthKeys = new Set<string>();
  incomes.forEach((i) => monthKeys.add(`${i.year}-${String(i.month).padStart(2, "0")}`));
  transactions.forEach((t) => monthKeys.add(t.date.slice(0, 7)));
  const breakdown = [...monthKeys]
    .sort()
    .map((k) => computeMonthlySummary(incomes, transactions, Number(k.slice(0, 4)), Number(k.slice(5, 7))));
  const txs = filterTransactions(transactions, { sort: "date_asc" });

  return {
    title: "Complete Financial Report",
    filename: "financial-report-complete",
    summary: allSummary,
    sections: [
      { name: "Monthly Breakdown", columns: BREAKDOWN_COLUMNS, rows: breakdown.map(breakdownRow) },
      incomeSection,
      { name: "Transactions", columns: TX_COLUMNS, rows: txRows(txs), totalRow: txTotal(txs) },
    ],
  };
}

/* ------------------------------------------------------------------ */
/* CSV                                                                 */
/* ------------------------------------------------------------------ */

function csvCell(value: CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number") return String(value);
  let s = value;
  // Prevent CSV formula injection when opened in Excel.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(report: Report): string {
  const lines: string[] = [];
  const line = (cells: CellValue[]) => lines.push(cells.map(csvCell).join(","));

  line([report.title]);
  line([]);
  line(["Summary"]);
  report.summary.forEach((s) => line([s.label, s.value]));

  for (const section of report.sections) {
    line([]);
    line([section.name]);
    line(section.columns.map((c) => c.header));
    if (section.rows.length === 0) line(["No records"]);
    section.rows.forEach((r) => line(r));
    if (section.totalRow && section.rows.length) line(section.totalRow);
  }
  // BOM so Excel opens UTF-8 (₹ and Hindi text) correctly; CRLF line endings for Excel.
  return "﻿" + lines.join("\r\n") + "\r\n";
}

/* ------------------------------------------------------------------ */
/* Excel                                                               */
/* ------------------------------------------------------------------ */

const MONEY_FMT = '"₹"#,##0.00;[Red]-"₹"#,##0.00';
const DATE_FMT = "dd-mmm-yyyy";
const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } };

export async function toXlsx(report: Report): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Family Finance Tracker";
  wb.created = new Date();

  // Summary sheet
  const ws = wb.addWorksheet("Summary");
  ws.getColumn(1).width = 28;
  ws.getColumn(2).width = 22;
  ws.getCell("A1").value = report.title;
  ws.getCell("A1").font = { bold: true, size: 14 };
  ws.addRow([]);
  const head = ws.addRow(["Item", "Value"]);
  head.font = { bold: true, color: { argb: "FFFFFFFF" } };
  head.eachCell((c) => (c.fill = HEADER_FILL));
  for (const s of report.summary) {
    const row = ws.addRow([s.label, s.value]);
    if (s.money) row.getCell(2).numFmt = MONEY_FMT;
    if (s.label === "Remaining Balance") row.font = { bold: true };
  }

  for (const section of report.sections) {
    const sheet = wb.addWorksheet(section.name.slice(0, 31), { views: [{ state: "frozen", ySplit: 1 }] });
    sheet.columns = section.columns.map((c) => ({ header: c.header, width: c.width }));
    const header = sheet.getRow(1);
    header.font = { bold: true, color: { argb: "FFFFFFFF" } };
    header.eachCell((c) => (c.fill = HEADER_FILL));
    header.height = 20;

    section.columns.forEach((c, i) => {
      const col = sheet.getColumn(i + 1);
      if (c.money) col.numFmt = MONEY_FMT;
      if (c.date) col.numFmt = DATE_FMT;
      if (!c.money && !c.date) col.alignment = { wrapText: true, vertical: "top" };
    });

    section.rows.forEach((r) => sheet.addRow(r));
    if (section.rows.length === 0) {
      sheet.addRow(["No records"]);
    } else if (section.totalRow) {
      const total = sheet.addRow(section.totalRow);
      total.font = { bold: true };
      total.eachCell((c) => (c.border = { top: { style: "thin" } }));
    }
    if (section.rows.length) {
      sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: section.columns.length } };
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}
