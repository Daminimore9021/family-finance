import { LIMITS, MAX_AMOUNT, MAX_YEAR, MIN_YEAR } from "./constants";
import { isRecipient } from "./calculations";
import type { DueInput, DueRepeat, IncomeInput, PaymentKind, TransactionInput } from "./types";

export type ValidationResult<T> = { ok: true; data: T } | { ok: false; fields: Record<string, string> };

function asTrimmedString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

export function parseAmount(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[₹,\s]/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function validateAmount(value: unknown, fields: Record<string, string>): number {
  const amount = parseAmount(value);
  if (amount === null) {
    fields.amount = "Enter a valid amount";
    return 0;
  }
  if (amount <= 0) fields.amount = "Amount must be greater than 0";
  else if (amount > MAX_AMOUNT) fields.amount = "Amount is too large";
  else if (Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-6) fields.amount = "Use at most 2 decimal places";
  return Math.round(amount * 100) / 100;
}

function validateText(
  value: unknown,
  name: keyof typeof LIMITS,
  fields: Record<string, string>,
): string {
  const text = asTrimmedString(value).replace(/\s+/g, " ");
  if (text.length > LIMITS[name]) fields[name] = `Keep it under ${LIMITS[name]} characters`;
  return text;
}

/** Strict YYYY-MM-DD that is a real calendar date. */
export function isValidISODate(value: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (y < MIN_YEAR || y > MAX_YEAR || mo < 1 || mo > 12 || d < 1) return false;
  const daysInMonth = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  return d <= daysInMonth;
}

/** 24-hour HH:MM. */
export function isValidTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function validateIncomeInput(body: unknown): ValidationResult<IncomeInput> {
  const fields: Record<string, string> = {};
  const b = (body ?? {}) as Record<string, unknown>;

  const month = Number(b.month);
  if (!Number.isInteger(month) || month < 1 || month > 12) fields.month = "Select a month";

  const year = Number(b.year);
  if (!Number.isInteger(year) || year < MIN_YEAR || year > MAX_YEAR)
    fields.year = `Enter a year between ${MIN_YEAR} and ${MAX_YEAR}`;

  const amount = validateAmount(b.amount, fields);
  const description = validateText(b.description, "description", fields);

  if (Object.keys(fields).length) return { ok: false, fields };
  return { ok: true, data: { month, year, amount, description } };
}

export function validateTransactionInput(body: unknown): ValidationResult<TransactionInput> {
  const fields: Record<string, string> = {};
  const b = (body ?? {}) as Record<string, unknown>;

  const recipient = asTrimmedString(b.recipient);
  if (!isRecipient(recipient)) fields.recipient = "Choose Mummy, Papa or Brother";

  const date = asTrimmedString(b.date);
  if (!isValidISODate(date)) fields.date = "Enter a valid date";

  const time = asTrimmedString(b.time);
  if (time && !isValidTime(time)) fields.time = "Enter a valid time";

  const amount = validateAmount(b.amount, fields);
  const description = validateText(b.description, "description", fields);
  const reason = validateText(b.reason, "reason", fields);
  const notes = validateText(b.notes, "notes", fields);

  const kindRaw = asTrimmedString(b.kind) || "gift";
  if (kindRaw !== "gift" && kindRaw !== "loan") fields.kind = "Choose gift or loan";
  const kind = kindRaw as PaymentKind;

  let returnedAmount = 0;
  let returnedDate = "";
  if (kind === "loan") {
    const raw = asTrimmedString(b.returnedAmount);
    const parsed = raw === "" ? 0 : parseAmount(raw);
    if (parsed === null || parsed < 0) fields.returnedAmount = "Enter a valid amount";
    else if (parsed > amount && !fields.amount) fields.returnedAmount = "Can't be more than the loan";
    else returnedAmount = Math.round(parsed * 100) / 100;
    returnedDate = asTrimmedString(b.returnedDate);
    if (returnedDate && !isValidISODate(returnedDate)) fields.returnedDate = "Enter a valid date";
    if (returnedAmount === 0) returnedDate = "";
  }

  if (Object.keys(fields).length) return { ok: false, fields };
  return {
    ok: true,
    data: {
      recipient: recipient as TransactionInput["recipient"],
      date,
      time,
      amount,
      description,
      reason,
      notes,
      kind,
      returnedAmount,
      returnedDate,
    },
  };
}

const REPEATS: DueRepeat[] = ["none", "monthly", "yearly"];

export function validateDueInput(body: unknown): ValidationResult<DueInput> {
  const fields: Record<string, string> = {};
  const b = (body ?? {}) as Record<string, unknown>;

  const title = validateText(b.title, "title", fields);
  if (!title && !fields.title) fields.title = "Enter what this payment is for";

  const recipient = asTrimmedString(b.recipient);
  if (!isRecipient(recipient)) fields.recipient = "Choose Mummy, Papa or Brother";

  const amount = validateAmount(b.amount, fields);

  const dueDate = asTrimmedString(b.dueDate);
  if (!isValidISODate(dueDate)) fields.dueDate = "Enter a valid date";

  const repeat = (asTrimmedString(b.repeat) || "none") as DueRepeat;
  if (!REPEATS.includes(repeat)) fields.repeat = "Choose how often it repeats";

  const notes = validateText(b.notes, "notes", fields);

  if (Object.keys(fields).length) return { ok: false, fields };
  return { ok: true, data: { title, recipient: recipient as DueInput["recipient"], amount, dueDate, repeat, notes } };
}

export function isValidPin(pin: unknown): pin is string {
  return typeof pin === "string" && /^\d{4}$/.test(pin);
}
