import { randomUUID } from "node:crypto";
import { MONTH_NAMES } from "@/lib/constants";
import { isRecipient } from "@/lib/calculations";
import { isValidISODate, parseAmount } from "@/lib/validation";
import type { Income, IncomeInput, Transaction, TransactionInput } from "@/lib/types";
import { notFound } from "./errors";
import {
  appendRecord,
  deleteRecordRow,
  ensureTable,
  findRow,
  readTable,
  updateRecord,
  withWriteLock,
  type Cell,
  type RawRecord,
  type TableSchema,
} from "./sheets";

export const INCOME_SCHEMA: TableSchema = {
  title: "Income",
  idColumn: "income_id",
  headers: ["income_id", "month", "year", "amount", "description", "created_at", "updated_at"],
};

export const TRANSACTION_SCHEMA: TableSchema = {
  title: "Transactions",
  idColumn: "transaction_id",
  headers: ["transaction_id", "date", "recipient", "amount", "description", "reason", "notes", "created_at", "updated_at", "time"],
};

export const SETTINGS_SCHEMA: TableSchema = {
  title: "Settings",
  idColumn: "key",
  headers: ["key", "value", "updated_at"],
};

/* ------------------------------------------------------------------ */
/* cell parsing — tolerant of values typed by hand in Google Sheets    */
/* ------------------------------------------------------------------ */

const str = (v: Cell | undefined) => (v === undefined || v === null ? "" : String(v).trim());

function num(v: Cell | undefined): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  return parseAmount(str(v));
}

/** Sheet date cell -> YYYY-MM-DD. Handles ISO text, serial numbers and DD/MM/YYYY. */
export function parseDateCell(v: Cell | undefined): string | null {
  if (typeof v === "number" && v > 0) {
    const ms = Date.UTC(1899, 11, 30) + Math.floor(v) * 86_400_000;
    return new Date(ms).toISOString().slice(0, 10);
  }
  const s = str(v);
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (iso) {
    const out = `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
    return isValidISODate(out) ? out : null;
  }
  const dmy = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
  if (dmy) {
    const out = `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
    return isValidISODate(out) ? out : null;
  }
  return null;
}

function parseMonthCell(v: Cell | undefined): number | null {
  const n = num(v);
  if (n !== null && Number.isInteger(n) && n >= 1 && n <= 12) return n;
  const s = str(v).toLowerCase();
  const idx = MONTH_NAMES.findIndex((m) => m.toLowerCase() === s || m.slice(0, 3).toLowerCase() === s);
  return idx >= 0 ? idx + 1 : null;
}

function rowToIncome(r: RawRecord): Income | null {
  const month = parseMonthCell(r.month);
  const year = num(r.year);
  const amount = num(r.amount);
  if (!month || !year || amount === null) {
    console.warn("[repo] skipping invalid income row", r.income_id);
    return null;
  }
  return {
    id: str(r.income_id),
    month,
    year,
    amount,
    description: str(r.description),
    createdAt: str(r.created_at),
    updatedAt: str(r.updated_at),
  };
}

/** Sheet time cell -> HH:MM (24h), or "". Handles "14:05", "2:05 PM" and day-fraction numbers. */
export function parseTimeCell(v: Cell | undefined): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  if (typeof v === "number" && v >= 0 && v < 1) {
    const mins = Math.round(v * 24 * 60) % (24 * 60);
    return `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;
  }
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap]\.?m\.?)?$/i.exec(str(v));
  if (!m) return "";
  let h = Number(m[1]);
  const min = Number(m[2]);
  if (m[3]) {
    if (h < 1 || h > 12) return "";
    h = (h % 12) + (m[3][0].toLowerCase() === "p" ? 12 : 0);
  }
  return h <= 23 && min <= 59 ? `${pad(h)}:${pad(min)}` : "";
}

function rowToTransaction(r: RawRecord): Transaction | null {
  const date = parseDateCell(r.date);
  const amount = num(r.amount);
  const recipientRaw = str(r.recipient);
  // Accept common spellings typed by hand.
  const alias: Record<string, string> = { mummy: "Mummy", mother: "Mummy", papa: "Papa", father: "Papa", brother: "Brother", bhai: "Brother" };
  const recipient = alias[recipientRaw.toLowerCase()] ?? recipientRaw;
  if (!date || amount === null || !isRecipient(recipient)) {
    console.warn("[repo] skipping invalid transaction row", r.transaction_id);
    return null;
  }
  return {
    id: str(r.transaction_id),
    date,
    time: parseTimeCell(r.time),
    recipient,
    amount,
    description: str(r.description),
    reason: str(r.reason),
    notes: str(r.notes),
    createdAt: str(r.created_at),
    updatedAt: str(r.updated_at),
  };
}

const newId = (prefix: string) => `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
const nowIso = () => new Date().toISOString();

/* ------------------------------------------------------------------ */
/* Income                                                              */
/* ------------------------------------------------------------------ */

export async function listIncome(): Promise<Income[]> {
  const table = await readTable(INCOME_SCHEMA);
  return table.rows
    .map((r) => rowToIncome(r.record))
    .filter((x): x is Income => x !== null)
    .sort((a, b) => b.year - a.year || b.month - a.month);
}

export function createIncome(input: IncomeInput): Promise<Income> {
  return withWriteLock(async () => {
    // A month can have several incomes (salary, freelancing, ...).
    const table = await readTable(INCOME_SCHEMA);

    const ts = nowIso();
    const income: Income = { id: newId("inc"), ...input, createdAt: ts, updatedAt: ts };
    await appendRecord(INCOME_SCHEMA, table.headers, {
      income_id: income.id,
      month: income.month,
      year: income.year,
      amount: income.amount,
      description: income.description,
      created_at: ts,
      updated_at: ts,
    });
    return income;
  });
}

export function updateIncome(id: string, input: IncomeInput): Promise<Income> {
  return withWriteLock(async () => {
    const table = await readTable(INCOME_SCHEMA);
    const row = findRow(table, INCOME_SCHEMA, id);
    if (!row) throw notFound("Income entry not found. It may have been deleted.");
    const ts = nowIso();
    await updateRecord(INCOME_SCHEMA, table.headers, row, {
      month: input.month,
      year: input.year,
      amount: input.amount,
      description: input.description,
      updated_at: ts,
    });
    return { id, ...input, createdAt: str(row.record.created_at), updatedAt: ts };
  });
}

export function deleteIncome(id: string): Promise<void> {
  return withWriteLock(async () => {
    const table = await readTable(INCOME_SCHEMA);
    const row = findRow(table, INCOME_SCHEMA, id);
    if (!row) throw notFound("Income entry not found. It may have already been deleted.");
    await deleteRecordRow(INCOME_SCHEMA, table.headers, row);
  });
}

/* ------------------------------------------------------------------ */
/* Transactions                                                        */
/* ------------------------------------------------------------------ */

export async function listTransactions(): Promise<Transaction[]> {
  const table = await readTable(TRANSACTION_SCHEMA);
  return table.rows
    .map((r) => rowToTransaction(r.record))
    .filter((x): x is Transaction => x !== null)
    .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time) || b.createdAt.localeCompare(a.createdAt));
}

function transactionRecord(input: TransactionInput): RawRecord {
  return {
    date: input.date,
    time: input.time,
    recipient: input.recipient,
    amount: input.amount,
    description: input.description,
    reason: input.reason,
    notes: input.notes,
  };
}

export function createTransaction(input: TransactionInput): Promise<Transaction> {
  return withWriteLock(async () => {
    const table = await readTable(TRANSACTION_SCHEMA);
    const ts = nowIso();
    const tx: Transaction = { id: newId("txn"), ...input, createdAt: ts, updatedAt: ts };
    await appendRecord(TRANSACTION_SCHEMA, table.headers, {
      transaction_id: tx.id,
      ...transactionRecord(input),
      created_at: ts,
      updated_at: ts,
    });
    return tx;
  });
}

export function updateTransaction(id: string, input: TransactionInput): Promise<Transaction> {
  return withWriteLock(async () => {
    const table = await readTable(TRANSACTION_SCHEMA);
    const row = findRow(table, TRANSACTION_SCHEMA, id);
    if (!row) throw notFound("Payment not found. It may have been deleted.");
    const ts = nowIso();
    await updateRecord(TRANSACTION_SCHEMA, table.headers, row, { ...transactionRecord(input), updated_at: ts });
    return { id, ...input, createdAt: str(row.record.created_at), updatedAt: ts };
  });
}

export function deleteTransaction(id: string): Promise<void> {
  return withWriteLock(async () => {
    const table = await readTable(TRANSACTION_SCHEMA);
    const row = findRow(table, TRANSACTION_SCHEMA, id);
    if (!row) throw notFound("Payment not found. It may have already been deleted.");
    await deleteRecordRow(TRANSACTION_SCHEMA, table.headers, row);
  });
}

/** Creates the Income, Transactions and Settings tabs (with headers) if they are missing. */
export async function ensureAllTables(): Promise<void> {
  for (const schema of [INCOME_SCHEMA, TRANSACTION_SCHEMA, SETTINGS_SCHEMA]) await ensureTable(schema);
}

/* ------------------------------------------------------------------ */
/* Settings (key/value) — stores the PIN hash and login lockout state  */
/* ------------------------------------------------------------------ */

let settingsCache: { at: number; values: Record<string, string> } | null = null;
const SETTINGS_TTL_MS = 15_000;

export function resetSettingsCache(): void {
  settingsCache = null;
}

export async function getSettings(fresh = false): Promise<Record<string, string>> {
  if (!fresh && settingsCache && Date.now() - settingsCache.at < SETTINGS_TTL_MS) return settingsCache.values;
  const table = await readTable(SETTINGS_SCHEMA);
  const values: Record<string, string> = {};
  for (const r of table.rows) values[str(r.record.key)] = str(r.record.value);
  settingsCache = { at: Date.now(), values };
  return values;
}

export function setSettings(updates: Record<string, string>): Promise<void> {
  return withWriteLock(async () => {
    const table = await readTable(SETTINGS_SCHEMA);
    const ts = nowIso();
    for (const [key, value] of Object.entries(updates)) {
      const row = findRow(table, SETTINGS_SCHEMA, key);
      if (row) await updateRecord(SETTINGS_SCHEMA, table.headers, row, { value, updated_at: ts });
      else await appendRecord(SETTINGS_SCHEMA, table.headers, { key, value, updated_at: ts });
    }
    settingsCache = null;
  });
}
