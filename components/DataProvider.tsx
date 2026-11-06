"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api-client";
import { currentYearMonth } from "@/lib/format";
import type { Income, IncomeInput, Transaction, TransactionInput } from "@/lib/types";

interface DataContextValue {
  incomes: Income[];
  transactions: Transaction[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  /** The month/year shown on the dashboard, shared across pages. */
  period: { year: number; month: number };
  setPeriod: (p: { year: number; month: number }) => void;
  saveIncome: (input: IncomeInput, id?: string) => Promise<Income>;
  removeIncome: (id: string) => Promise<void>;
  saveTransaction: (input: TransactionInput, id?: string) => Promise<Transaction>;
  removeTransaction: (id: string) => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

const PERIOD_KEY = "fft.period";

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriodState] = useState(currentYearMonth);

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(PERIOD_KEY) ?? "null");
      if (saved && Number.isInteger(saved.year) && Number.isInteger(saved.month)) setPeriodState(saved);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const setPeriod = useCallback((p: { year: number; month: number }) => {
    setPeriodState(p);
    try {
      sessionStorage.setItem(PERIOD_KEY, JSON.stringify(p));
    } catch {
      /* storage unavailable */
    }
  }, []);

  /** Re-reads everything from Google Sheets so all figures reflect the source of truth. */
  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const [inc, txs] = await Promise.all([api<Income[]>("/api/income"), api<Transaction[]>("/api/transactions")]);
      setIncomes(inc);
      setTransactions(txs);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Keep figures live: re-read the sheet when the app comes back into view and
  // every 30 seconds while it is visible (picks up entries made on other devices
  // or typed straight into the sheet).
  useEffect(() => {
    const visible = () => document.visibilityState === "visible";
    const onShow = () => visible() && void refresh();
    const timer = window.setInterval(onShow, 30_000);
    document.addEventListener("visibilitychange", onShow);
    window.addEventListener("focus", onShow);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onShow);
      window.removeEventListener("focus", onShow);
    };
  }, [refresh]);

  const saveIncome = useCallback(
    async (input: IncomeInput, id?: string) => {
      const saved = id
        ? await api<Income>(`/api/income/${encodeURIComponent(id)}`, { method: "PUT", body: input })
        : await api<Income>("/api/income", { method: "POST", body: input });
      // Update immediately, then re-sync with the sheet in the background.
      setIncomes((list) => [saved, ...list.filter((i) => i.id !== saved.id)].sort((a, b) => b.year - a.year || b.month - a.month));
      void refresh();
      return saved;
    },
    [refresh],
  );

  const removeIncome = useCallback(
    async (id: string) => {
      await api(`/api/income/${encodeURIComponent(id)}`, { method: "DELETE" });
      setIncomes((list) => list.filter((i) => i.id !== id));
      void refresh();
    },
    [refresh],
  );

  const saveTransaction = useCallback(
    async (input: TransactionInput, id?: string) => {
      const saved = id
        ? await api<Transaction>(`/api/transactions/${encodeURIComponent(id)}`, { method: "PUT", body: input })
        : await api<Transaction>("/api/transactions", { method: "POST", body: input });
      setTransactions((list) =>
        [saved, ...list.filter((t) => t.id !== saved.id)].sort(
          (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
        ),
      );
      void refresh();
      return saved;
    },
    [refresh],
  );

  const removeTransaction = useCallback(
    async (id: string) => {
      await api(`/api/transactions/${encodeURIComponent(id)}`, { method: "DELETE" });
      setTransactions((list) => list.filter((t) => t.id !== id));
      void refresh();
    },
    [refresh],
  );

  const value = useMemo(
    () => ({
      incomes,
      transactions,
      loading,
      refreshing,
      error,
      refresh,
      period,
      setPeriod,
      saveIncome,
      removeIncome,
      saveTransaction,
      removeTransaction,
    }),
    [incomes, transactions, loading, refreshing, error, refresh, period, setPeriod, saveIncome, removeIncome, saveTransaction, removeTransaction],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used inside DataProvider");
  return ctx;
}
