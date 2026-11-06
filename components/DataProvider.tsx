"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api-client";
import { nextDueDate } from "@/lib/calculations";
import { currentYearMonth, todayISO } from "@/lib/format";
import type { Due, DueInput, Income, IncomeInput, Transaction, TransactionInput } from "@/lib/types";

interface DataContextValue {
  incomes: Income[];
  transactions: Transaction[];
  dues: Due[];
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
  saveDue: (input: DueInput, id?: string) => Promise<Due>;
  removeDue: (id: string) => Promise<void>;
  /** Records the due as a payment today, then moves a repeating due to its next date (or removes a one-off). */
  payDue: (due: Due) => Promise<Transaction>;
}

const DataContext = createContext<DataContextValue | null>(null);

const PERIOD_KEY = "fft.period";

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [dues, setDues] = useState<Due[]>([]);
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
  const lastRefresh = useRef(0);
  const refresh = useCallback(async () => {
    lastRefresh.current = Date.now();
    setRefreshing(true);
    try {
      // One request → one Google Sheets read (keeps us well under Google's per-minute limit).
      const all = await api<{ incomes: Income[]; transactions: Transaction[]; dues: Due[] }>("/api/data");
      setIncomes(all.incomes);
      setTransactions(all.transactions);
      setDues(all.dues);
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

  // Keep figures live: re-read the sheet when the app comes back into view (at most
  // every 30 s) and every 2 minutes while it stays open, so entries made on other
  // devices show up without hammering Google's read limit.
  useEffect(() => {
    const visible = () => document.visibilityState === "visible";
    const onShow = () => {
      if (visible() && Date.now() - lastRefresh.current > 30_000) void refresh();
    };
    const timer = window.setInterval(() => visible() && void refresh(), 120_000);
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

  const saveDue = useCallback(
    async (input: DueInput, id?: string) => {
      const saved = id
        ? await api<Due>(`/api/dues/${encodeURIComponent(id)}`, { method: "PUT", body: input })
        : await api<Due>("/api/dues", { method: "POST", body: input });
      setDues((list) => [saved, ...list.filter((d) => d.id !== saved.id)].sort((a, b) => a.dueDate.localeCompare(b.dueDate)));
      void refresh();
      return saved;
    },
    [refresh],
  );

  const removeDue = useCallback(
    async (id: string) => {
      await api(`/api/dues/${encodeURIComponent(id)}`, { method: "DELETE" });
      setDues((list) => list.filter((d) => d.id !== id));
      void refresh();
    },
    [refresh],
  );

  const payDue = useCallback(
    async (due: Due) => {
      const tx = await saveTransaction({
        date: todayISO(),
        time: "",
        recipient: due.recipient,
        amount: due.amount,
        description: "",
        reason: due.title,
        notes: due.notes,
        kind: "gift",
        returnedAmount: 0,
        returnedDate: "",
      });
      const { id, createdAt: _c, updatedAt: _u, ...rest } = due;
      if (due.repeat === "none") await removeDue(id);
      else await saveDue({ ...rest, dueDate: nextDueDate(due.dueDate, due.repeat) }, id);
      return tx;
    },
    [saveTransaction, saveDue, removeDue],
  );

  const value = useMemo(
    () => ({
      incomes,
      transactions,
      dues,
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
      saveDue,
      removeDue,
      payDue,
    }),
    [
      incomes,
      transactions,
      dues,
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
      saveDue,
      removeDue,
      payDue,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used inside DataProvider");
  return ctx;
}
