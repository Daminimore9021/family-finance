"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { formatDate, formatINR, formatTime } from "@/lib/format";
import type { Transaction } from "@/lib/types";
import { useData } from "./DataProvider";
import { PaymentForm } from "./PaymentForm";
import { RecipientAvatar, RecipientBadge } from "./RecipientAvatar";
import { ConfirmDialog, Modal } from "./ui/Modal";
import { useToast } from "./ui/Toast";

interface Props {
  transactions: Transaction[];
  /** Hide edit/delete (e.g. compact lists). */
  readOnly?: boolean;
  /** Use cards even on wide screens. */
  compact?: boolean;
}

/**
 * Transactions as cards on phones and as a table on wider screens,
 * with edit (modal) and delete (confirmation) actions.
 */
export function TransactionList({ transactions, readOnly, compact }: Props) {
  const { removeTransaction } = useData();
  const toast = useToast();
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState<Transaction | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await removeTransaction(deleting.id);
      toast.success("Payment deleted");
      setDeleting(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete payment");
    } finally {
      setBusy(false);
    }
  }

  const actions = (t: Transaction) =>
    readOnly ? null : (
      <div className="flex shrink-0 items-center">
        <button
          onClick={() => setEditing(t)}
          className="flex size-10 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-brand-600"
          aria-label={`Edit payment to ${t.recipient} on ${formatDate(t.date)}`}
        >
          <Pencil className="size-4" />
        </button>
        <button
          onClick={() => setDeleting(t)}
          className="flex size-10 items-center justify-center rounded-full text-slate-400 hover:bg-rose-50 hover:text-rose-600"
          aria-label={`Delete payment to ${t.recipient} on ${formatDate(t.date)}`}
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    );

  return (
    <>
      {/* Cards (mobile, or compact mode) */}
      <ul className={compact ? "divide-y divide-slate-100" : "divide-y divide-slate-100 md:hidden"}>
        {transactions.map((t) => (
          <li key={t.id} className="flex items-center gap-3 py-3">
            <RecipientAvatar recipient={t.recipient} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate text-sm font-medium text-slate-900">{t.description || t.reason || t.recipient}</p>
                <p className="num shrink-0 text-sm font-semibold text-slate-900">{formatINR(t.amount)}</p>
              </div>
              <p className="mt-0.5 truncate text-xs text-slate-500">
                {t.recipient} · {formatDate(t.date)}
                {t.time ? `, ${formatTime(t.time)}` : ""}
                {t.reason && t.description ? ` · ${t.reason}` : ""}
              </p>
              {t.notes && <p className="mt-0.5 line-clamp-2 break-words text-xs text-slate-400">{t.notes}</p>}
            </div>
            {actions(t)}
          </li>
        ))}
      </ul>

      {/* Table (tablet & desktop) */}
      {!compact && (
        <div className="hidden md:block">
          <table className="w-full table-fixed text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
                <th className="w-28 py-2 pr-3 font-medium">Date</th>
                <th className="w-28 py-2 pr-3 font-medium">Recipient</th>
                <th className="w-32 py-2 pr-3 text-right font-medium">Amount</th>
                <th className="py-2 pr-3 font-medium">Description</th>
                <th className="py-2 pr-3 font-medium">Reason</th>
                {!readOnly && <th className="w-24 py-2 text-right font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {transactions.map((t) => (
                <tr key={t.id} className="align-top hover:bg-slate-50/60">
                  <td className="py-3 pr-3 text-slate-600">
                    {formatDate(t.date)}
                    {t.time && <span className="block text-xs text-slate-400">{formatTime(t.time)}</span>}
                  </td>
                  <td className="py-3 pr-3">
                    <RecipientBadge recipient={t.recipient} />
                  </td>
                  <td className="num py-3 pr-3 text-right font-semibold text-slate-900">{formatINR(t.amount)}</td>
                  <td className="py-3 pr-3 text-slate-700">
                    <p className="break-words">{t.description || <span className="text-slate-300">—</span>}</p>
                    {t.notes && <p className="mt-0.5 break-words text-xs text-slate-400">{t.notes}</p>}
                  </td>
                  <td className="break-words py-3 pr-3 text-slate-600">{t.reason || <span className="text-slate-300">—</span>}</td>
                  {!readOnly && <td className="py-1.5 text-right">{<div className="flex justify-end">{actions(t)}</div>}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={editing !== null} title="Edit payment" onClose={() => setEditing(null)}>
        {editing && (
          <PaymentForm key={editing.id} existing={editing} onSaved={() => setEditing(null)} onCancel={() => setEditing(null)} />
        )}
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title="Delete payment?"
        loading={busy}
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
        message={
          deleting && (
            <p>
              This will permanently remove the payment of <strong className="text-slate-900">{formatINR(deleting.amount)}</strong> to{" "}
              <strong className="text-slate-900">{deleting.recipient}</strong> on {formatDate(deleting.date)} from your Google Sheet.
            </p>
          )
        }
      />
    </>
  );
}
