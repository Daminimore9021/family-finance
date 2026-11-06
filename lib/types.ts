import type { Recipient } from "./constants";

export type { Recipient };

export interface Income {
  id: string;
  /** 1 – 12 */
  month: number;
  year: number;
  amount: number;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  /** ISO calendar date, YYYY-MM-DD */
  date: string;
  /** 24-hour HH:MM, or "" when no time was recorded */
  time: string;
  recipient: Recipient;
  amount: number;
  description: string;
  reason: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface IncomeInput {
  month: number;
  year: number;
  amount: number;
  description: string;
}

export interface TransactionInput {
  date: string;
  /** 24-hour HH:MM, or "" */
  time: string;
  recipient: Recipient;
  amount: number;
  description: string;
  reason: string;
  notes: string;
}

export type RecipientTotals = Record<Recipient, number>;

export interface MonthlySummary {
  year: number;
  month: number;
  income: number;
  hasIncome: boolean;
  incomeRecord: Income | null;
  totals: RecipientTotals;
  totalGiven: number;
  remaining: number;
  transactionCount: number;
  isOverspent: boolean;
}

export interface YearlySummary {
  year: number;
  months: MonthlySummary[];
  totalIncome: number;
  totals: RecipientTotals;
  totalGiven: number;
  remaining: number;
  transactionCount: number;
  monthsWithIncome: number;
}

export type SortOrder = "date_desc" | "date_asc" | "amount_desc" | "amount_asc";

export interface TransactionFilter {
  year?: number;
  month?: number;
  recipient?: Recipient | "all";
  search?: string;
  sort?: SortOrder;
}

export interface ApiErrorBody {
  error: string;
  fields?: Record<string, string>;
}

export interface SessionInfo {
  configured: boolean;
  authenticated: boolean;
  missingEnv?: string[];
  error?: string;
  /** True on a laptop: the key file and sheet link can be set from the setup screen. */
  canConfigure?: boolean;
  needsCredentials?: boolean;
  needsSheet?: boolean;
  serviceAccountEmail?: string;
}

