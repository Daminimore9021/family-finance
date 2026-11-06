/**
 * Unit tests for the business logic. Run with: npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  availableYears,
  computeAllTimeSummary,
  computeMonthlySummary,
  computeYearlySummary,
  daysBetween,
  filterTransactions,
  loanSummary,
  nextDueDate,
  reasonBreakdown,
  sumAmounts,
  trailingMonths,
} from "../lib/calculations";
import { isValidISODate, validateDueInput, validateIncomeInput, validateTransactionInput } from "../lib/validation";
import type { Income, Recipient, Transaction } from "../lib/types";

let n = 0;
const tx = (recipient: Recipient, amount: number, date: string, description = ""): Transaction => ({
  id: `t${++n}`,
  recipient,
  amount,
  date,
  time: "",
  description,
  reason: "",
  notes: "",
  kind: "gift",
  returnedAmount: 0,
  returnedDate: "",
  createdAt: `2026-01-01T00:00:${String(n).padStart(2, "0")}Z`,
  updatedAt: "",
});
const inc = (year: number, month: number, amount: number): Income => ({
  id: `i${year}${month}`,
  year,
  month,
  amount,
  description: "",
  createdAt: "",
  updatedAt: "",
});

const incomes = [inc(2026, 11, 50000), inc(2026, 10, 45000), inc(2025, 12, 40000)];
const transactions = [
  tx("Mummy", 10000, "2026-11-02", "Household"),
  tx("Papa", 15000.5, "2026-11-05", "Medicine"),
  tx("Brother", 5000, "2026-11-30"),
  tx("Mummy", 2000, "2026-10-31"), // different month – must not leak into November
  tx("Papa", 3000, "2025-11-15"), // same month, different year – must not leak
  tx("Brother", 0.1, "2026-12-01"),
  tx("Brother", 0.2, "2026-12-01"),
];

test("monthly summary only uses the selected month and year", () => {
  const s = computeMonthlySummary(incomes, transactions, 2026, 11);
  assert.equal(s.income, 50000);
  assert.deepEqual(s.totals, { Mummy: 10000, Papa: 15000.5, Brother: 5000 });
  assert.equal(s.totalGiven, 30000.5);
  assert.equal(s.remaining, 19999.5);
  assert.equal(s.transactionCount, 3);
  assert.equal(s.isOverspent, false);
});

test("negative balance when payments exceed income", () => {
  const s = computeMonthlySummary([inc(2026, 11, 1000)], transactions, 2026, 11);
  assert.equal(s.remaining, -29000.5);
  assert.equal(s.isOverspent, true);
});

test("month without income record has 0 income and is flagged", () => {
  const s = computeMonthlySummary(incomes, transactions, 2026, 12);
  assert.equal(s.hasIncome, false);
  assert.equal(s.income, 0);
  assert.equal(s.totalGiven, 0.3); // paise arithmetic: 0.1 + 0.2 === 0.3
  assert.equal(s.remaining, -0.3);
});

test("yearly summary adds up months", () => {
  const y = computeYearlySummary(incomes, transactions, 2026);
  assert.equal(y.totalIncome, 95000);
  assert.deepEqual(y.totals, { Mummy: 12000, Papa: 15000.5, Brother: 5000.3 });
  assert.equal(y.totalGiven, 32000.8);
  assert.equal(y.remaining, 62999.2);
  assert.equal(y.months.length, 12);
  assert.equal(y.monthsWithIncome, 2);
  assert.equal(y.transactionCount, 6);
});

test("all-time summary", () => {
  const a = computeAllTimeSummary(incomes, transactions);
  assert.equal(a.totalIncome, 135000);
  assert.equal(a.totalGiven, 35000.8);
  assert.equal(a.remaining, 99999.2);
});

test("filters: month, recipient, search, sort", () => {
  assert.equal(filterTransactions(transactions, { year: 2026, month: 11 }).length, 3);
  assert.equal(filterTransactions(transactions, { recipient: "Papa" }).length, 2);
  assert.equal(filterTransactions(transactions, { search: "medic" })[0].recipient, "Papa");
  const byAmount = filterTransactions(transactions, { sort: "amount_desc" });
  assert.equal(byAmount[0].amount, 15000.5);
  const newest = filterTransactions(transactions, { sort: "date_desc" });
  assert.equal(newest[0].date, "2026-12-01");
});

test("helpers", () => {
  assert.equal(sumAmounts([0.1, 0.2, 0.3]), 0.6);
  assert.deepEqual(trailingMonths(2026, 2, 3), [
    { year: 2025, month: 12 },
    { year: 2026, month: 1 },
    { year: 2026, month: 2 },
  ]);
  assert.deepEqual(availableYears(incomes, transactions, 2027), [2027, 2026, 2025]);
});

test("validation", () => {
  assert.equal(isValidISODate("2026-02-29"), false);
  assert.equal(isValidISODate("2028-02-29"), true);
  assert.equal(validateIncomeInput({ month: 11, year: 2026, amount: "1,00,000" }).ok, true);
  assert.equal(validateIncomeInput({ month: 0, year: 2026, amount: 5 }).ok, false);
  const t = validateTransactionInput({ recipient: "Mummy", amount: "500", date: "2026-11-05" });
  assert.ok(t.ok && t.data.description === "" && t.data.reason === "" && t.data.notes === "");
  assert.equal(validateTransactionInput({ recipient: "Mummy", amount: -1, date: "2026-11-05" }).ok, false);
  assert.equal(validateTransactionInput({ recipient: "Sister", amount: 1, date: "2026-11-05" }).ok, false);
});

test("a month can have several incomes (salary + freelancing) and they add up", () => {
  const list = [inc(2026, 11, 50000), { ...inc(2026, 11, 12000.5), id: "free" }];
  const s = computeMonthlySummary(list, [tx("Papa", 2000.5, "2026-11-03")], 2026, 11);
  assert.equal(s.income, 62000.5);
  assert.equal(s.incomeRecords.length, 2);
  assert.equal(s.remaining, 60000);
});

test("loans: only the part not returned counts as given", () => {
  const loan = { ...tx("Papa", 10000, "2026-10-24"), kind: "loan" as const, returnedAmount: 4000, returnedDate: "2026-11-01" };
  const s = computeMonthlySummary([], [loan, tx("Papa", 500, "2026-10-02")], 2026, 10);
  assert.equal(s.totals.Papa, 6500);
  const l = loanSummary([loan]);
  assert.deepEqual(l, { loanCount: 1, openCount: 1, lent: 10000, returned: 4000, pending: 6000 });
  assert.equal(loanSummary([{ ...loan, returnedAmount: 10000 }]).openCount, 0);
});

test("reason breakdown groups case-insensitively and keeps blanks together", () => {
  const list = [
    { ...tx("Papa", 100, "2026-10-01"), reason: "Groceries" },
    { ...tx("Papa", 250, "2026-10-02"), reason: "groceries " },
    tx("Papa", 50, "2026-10-03"),
  ];
  const r = reasonBreakdown(list);
  assert.deepEqual(r[0], { label: "Groceries", amount: 350, count: 2 });
  assert.deepEqual(r[1], { label: "No reason", amount: 50, count: 1 });
});

test("next due date clamps the day and rolls the year", () => {
  assert.equal(nextDueDate("2026-01-31", "monthly"), "2026-02-28");
  assert.equal(nextDueDate("2026-12-15", "monthly"), "2027-01-15");
  assert.equal(nextDueDate("2028-02-29", "yearly"), "2029-02-28");
  assert.equal(nextDueDate("2026-05-10", "none"), "2026-05-10");
  assert.equal(daysBetween("2026-11-07", "2026-11-10"), 3);
  assert.equal(daysBetween("2026-11-07", "2026-10-31"), -7);
});

test("validation: loans and dues", () => {
  const base = { recipient: "Papa", date: "2026-10-24", amount: "10000" };
  const ok = validateTransactionInput({ ...base, kind: "loan", returnedAmount: "2500", returnedDate: "2026-11-01" });
  assert.ok(ok.ok && ok.data.kind === "loan" && ok.data.returnedAmount === 2500);
  const tooMuch = validateTransactionInput({ ...base, kind: "loan", returnedAmount: "20000" });
  assert.ok(!tooMuch.ok && tooMuch.fields.returnedAmount);
  const gift = validateTransactionInput({ ...base, returnedAmount: "500" });
  assert.ok(gift.ok && gift.data.kind === "gift" && gift.data.returnedAmount === 0);
  const due = validateDueInput({ title: "LIC", recipient: "Papa", amount: "12000", dueDate: "2027-02-12", repeat: "yearly" });
  assert.ok(due.ok && due.data.repeat === "yearly");
  const bad = validateDueInput({ recipient: "Papa", amount: "0", dueDate: "x", repeat: "weekly" });
  assert.ok(!bad.ok && bad.fields.title && bad.fields.amount && bad.fields.dueDate && bad.fields.repeat);
});
