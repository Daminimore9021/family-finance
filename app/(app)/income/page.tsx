"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Pencil, Trash2, Wallet } from "lucide-react";
import { useData } from "@/components/DataProvider";
import { IncomeForm } from "@/components/IncomeForm";
import { LoadState } from "@/components/LoadState";
import { Card, CardTitle, EmptyState, PageHeader } from "@/components/ui/primitives";
import { ConfirmDialog, Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { computeMonthlySummary } from "@/lib/calculations";
import { formatINR, monthLabel } from "@/lib/format";
import { cn } from "@/lib/api-client";
import type { Income } from "@/lib/types";

export default function IncomePage() {
  return (
    <>
      <PageHeader title="Monthly Income" subtitle="Record what you earn each month" />
      <LoadState>
        <Suspense>
          <IncomeContent />
        </Suspense>
      </LoadState>
    </>
  );
}

function IncomeContent() {
  const params = useSearchParams();
  const { incomes, transactions, period, removeIncome } = useData();
  const toast = useToast();
  const [editing, setEditing] = useState<Income | null>(null);
  const [deleting, setDeleting] = useState<Income | null>(null);
  const [busy, setBusy] = useState(false);

  const defaultPeriod = useMemo(() => {
    const y = Number(params.get("year"));
    const m = Number(params.get("month"));
    if (Number.isInteger(y) && y > 0 && Number.isInteger(m) && m >= 1 && m <= 12) return { year: y, month: m };
    return period;
  }, [params, period]);

  const byYear = useMemo(() => {
    const groups = new Map<number, Income[]>();
    for (const i of incomes) groups.set(i.year, [...(groups.get(i.year) ?? []), i]);
    return [...groups.entries()].sort((a, b) => b[0] - a[0]);
  }, [incomes]);

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await removeIncome(deleting.id);
      toast.success(`Deleted income for ${monthLabel(deleting.year, deleting.month)}`);
      setDeleting(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete income");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:items-start">
      <Card>
        <CardTitle>Add monthly income</CardTitle>
        <IncomeForm key={`${defaultPeriod.year}-${defaultPeriod.month}`} defaultPeriod={defaultPeriod} onEditExisting={setEditing} />
      </Card>

      <Card>
        <CardTitle>Income history</CardTitle>
        {incomes.length === 0 ? (
          <EmptyState icon={Wallet} title="No income recorded yet" description="Add your first month's income using the form." />
        ) : (
          <div className="space-y-5">
            {byYear.map(([year, list]) => (
              <section key={year}>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{year}</h3>
                <ul className="divide-y divide-slate-100">
                  {list.map((income) => {
                    const s = computeMonthlySummary(incomes, transactions, income.year, income.month);
                    return (
                      <li key={income.id} className="flex items-center gap-3 py-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <p className="truncate text-sm font-medium text-slate-900">{monthLabel(income.year, income.month)}</p>
                            <p className="num shrink-0 text-sm font-semibold text-slate-900">{formatINR(income.amount)}</p>
                          </div>
                          <p className="mt-0.5 truncate text-xs text-slate-500">
                            Given {formatINR(s.totalGiven)} ·{" "}
                            <span className={cn(s.isOverspent ? "font-medium text-rose-600" : "text-emerald-700")}>
                              Left {formatINR(s.remaining)}
                            </span>
                          </p>
                          {income.description && <p className="mt-0.5 truncate text-xs text-slate-400">{income.description}</p>}
                        </div>
                        <div className="flex shrink-0">
                          <button
                            onClick={() => setEditing(income)}
                            className="flex size-10 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-brand-600"
                            aria-label={`Edit income for ${monthLabel(income.year, income.month)}`}
                          >
                            <Pencil className="size-4" />
                          </button>
                          <button
                            onClick={() => setDeleting(income)}
                            className="flex size-10 items-center justify-center rounded-full text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                            aria-label={`Delete income for ${monthLabel(income.year, income.month)}`}
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </Card>

      <Modal open={editing !== null} title="Edit income" onClose={() => setEditing(null)}>
        {editing && <IncomeForm key={editing.id} existing={editing} onSaved={() => setEditing(null)} onCancel={() => setEditing(null)} />}
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title="Delete income?"
        loading={busy}
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
        message={
          deleting && (
            <p>
              This removes the income of <strong className="text-slate-900">{formatINR(deleting.amount)}</strong> for{" "}
              <strong className="text-slate-900">{monthLabel(deleting.year, deleting.month)}</strong>. Payments for that month are kept.
            </p>
          )
        }
      />
    </div>
  );
}
