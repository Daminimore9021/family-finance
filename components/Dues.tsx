"use client";

import { useMemo, useState } from "react";
import { BellRing, CalendarClock, Check, CircleCheck, Pencil, Plus, Repeat, Trash2 } from "lucide-react";
import { LIMITS, RECIPIENTS, RECIPIENT_META } from "@/lib/constants";
import { daysBetween, nextDueDate } from "@/lib/calculations";
import { formatDate, formatINR, todayISO } from "@/lib/format";
import { ApiError, cn } from "@/lib/api-client";
import { validateDueInput } from "@/lib/validation";
import type { Due, DueRepeat, Recipient } from "@/lib/types";
import { useData } from "./DataProvider";
import { RecipientAvatar } from "./RecipientAvatar";
import { DatePicker } from "./ui/DateTimePicker";
import { ConfirmDialog, Modal } from "./ui/Modal";
import { Button, Card, CardTitle, Input, Segmented, Textarea } from "./ui/primitives";
import { useToast } from "./ui/Toast";

const REPEAT_LABEL: Record<DueRepeat, string> = { none: "One time", monthly: "Every month", yearly: "Every year" };

/* ------------------------------------------------------------------ */
/* Form                                                                */
/* ------------------------------------------------------------------ */

interface FormState {
  title: string;
  recipient: Recipient | "";
  amount: string;
  dueDate: string;
  repeat: DueRepeat;
  notes: string;
}

export function DueForm({ existing, onDone }: { existing?: Due; onDone: () => void }) {
  const { saveDue } = useData();
  const toast = useToast();
  const [form, setForm] = useState<FormState>(() =>
    existing
      ? { ...existing, amount: String(existing.amount) }
      : { title: "", recipient: "", amount: "", dueDate: todayISO(), repeat: "monthly", notes: "" },
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: "" }));
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const result = validateDueInput(form);
    if (!result.ok) {
      setErrors(result.fields);
      return;
    }
    setSaving(true);
    try {
      await saveDue(result.data, existing?.id);
      toast.success(existing ? "Due updated" : `${result.data.title} added to upcoming dues`);
      onDone();
    } catch (err) {
      if (err instanceof ApiError && err.fields) setErrors(err.fields);
      toast.error(err instanceof Error ? err.message : "Could not save due");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Input
        label="What is it for?"
        required
        maxLength={LIMITS.title}
        placeholder="e.g. LIC installment, College fee"
        value={form.title}
        onChange={(e) => set("title", e.target.value)}
        error={errors.title}
      />

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-slate-700">
          For <span className="text-rose-500">*</span>
        </legend>
        <div className="grid grid-cols-3 gap-2">
          {RECIPIENTS.map((r) => {
            const selected = form.recipient === r;
            const meta = RECIPIENT_META[r];
            return (
              <button
                type="button"
                key={r}
                onClick={() => set("recipient", r)}
                aria-pressed={selected}
                className={cn(
                  "relative flex min-h-12 items-center justify-center rounded-xl px-1 text-sm font-medium ring-1 transition-all",
                  selected ? cn(meta.soft, meta.text, "ring-2") : "bg-slate-50 text-slate-600 ring-slate-200 hover:bg-slate-100",
                )}
                style={selected ? { boxShadow: `inset 0 0 0 2px ${meta.color}` } : undefined}
              >
                {selected && <Check className="absolute right-1.5 top-1.5 size-3.5" aria-hidden />}
                {meta.label}
              </button>
            );
          })}
        </div>
        {errors.recipient && <p className="mt-1.5 text-xs text-rose-600">{errors.recipient}</p>}
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Amount"
          required
          prefix="₹"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          value={form.amount}
          onChange={(e) => set("amount", e.target.value.replace(/[^\d.]/g, ""))}
          error={errors.amount}
        />
        <DatePicker label="Due date" required value={form.dueDate} onChange={(v) => set("dueDate", v)} error={errors.dueDate} />
      </div>

      <Segmented
        label="Repeats"
        value={form.repeat}
        onChange={(v) => set("repeat", v)}
        options={[
          { value: "none", label: "Once" },
          { value: "monthly", label: "Monthly" },
          { value: "yearly", label: "Yearly" },
        ]}
      />

      <Textarea
        label="Notes"
        optional
        maxLength={LIMITS.notes}
        placeholder="Policy number, where to pay, ..."
        value={form.notes}
        onChange={(e) => set("notes", e.target.value)}
        error={errors.notes}
      />

      <div className="grid grid-cols-2 gap-3">
        <Button variant="secondary" onClick={onDone} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          {existing ? "Save changes" : "Add due"}
        </Button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Dashboard card                                                      */
/* ------------------------------------------------------------------ */

function dueLabel(days: number): { text: string; tone: "overdue" | "soon" | "later" } {
  if (days < 0) return { text: `${-days} day${days === -1 ? "" : "s"} overdue`, tone: "overdue" };
  if (days === 0) return { text: "Due today", tone: "soon" };
  if (days === 1) return { text: "Due tomorrow", tone: "soon" };
  if (days <= 7) return { text: `In ${days} days`, tone: "soon" };
  return { text: `In ${days} days`, tone: "later" };
}

const TONE: Record<"overdue" | "soon" | "later", string> = {
  overdue: "bg-rose-50 text-rose-700 ring-rose-200",
  soon: "bg-amber-50 text-amber-700 ring-amber-200",
  later: "bg-slate-50 text-slate-600 ring-slate-200",
};

export function UpcomingDues() {
  const { dues, payDue, removeDue } = useData();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Due | null>(null);
  const [deleting, setDeleting] = useState<Due | null>(null);
  const [paying, setPaying] = useState<Due | null>(null);
  const [busy, setBusy] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const today = todayISO();
  const list = useMemo(() => dues.map((d) => ({ due: d, days: daysBetween(today, d.dueDate) })), [dues, today]);
  const urgent = list.filter((x) => x.days <= 7);
  const visible = showAll ? list : list.slice(0, Math.max(4, urgent.length));
  const urgentTotal = urgent.reduce((a, x) => a + x.due.amount, 0);

  async function confirmPay() {
    if (!paying) return;
    setBusy(true);
    try {
      await payDue(paying);
      toast.success(
        paying.repeat === "none"
          ? `${paying.title} paid and saved`
          : `${paying.title} paid · next due ${formatDate(nextDueDate(paying.dueDate, paying.repeat))}`,
      );
      setPaying(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not record payment");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await removeDue(deleting.id);
      toast.success("Due removed");
      setDeleting(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove due");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardTitle
        action={
          <button
            onClick={() => setAdding(true)}
            className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-sm font-medium text-brand-600 hover:bg-brand-50"
          >
            <Plus className="size-4" aria-hidden /> Add due
          </button>
        }
      >
        Upcoming dues
      </CardTitle>

      {urgent.length > 0 && (
        <div className="mb-3 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-200">
          <BellRing className="size-4 shrink-0" aria-hidden />
          <span>
            {urgent.length} due this week · <strong className="num">{formatINR(urgentTotal)}</strong>
          </span>
        </div>
      )}

      {list.length === 0 ? (
        <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
          <CalendarClock className="size-5 shrink-0 text-brand-600" aria-hidden />
          <p>Add LIC, college fee, gas or any payment that repeats, and it will remind you here.</p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {visible.map(({ due, days }) => {
            const label = dueLabel(days);
            return (
              <li key={due.id} className="flex items-center gap-3 py-3">
                <RecipientAvatar recipient={due.recipient} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-sm font-medium text-slate-900">{due.title}</p>
                    <p className="num shrink-0 text-sm font-semibold text-slate-900">{formatINR(due.amount)}</p>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                    <span className={cn("rounded-full px-2 py-0.5 font-semibold ring-1", TONE[label.tone])}>{label.text}</span>
                    <span>
                      {due.recipient} · {formatDate(due.dueDate)}
                    </span>
                    {due.repeat !== "none" && (
                      <span className="inline-flex items-center gap-0.5 text-slate-400">
                        <Repeat className="size-3" aria-hidden /> {REPEAT_LABEL[due.repeat]}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center">
                  <button
                    onClick={() => setPaying(due)}
                    className="flex size-10 items-center justify-center rounded-full text-emerald-600 hover:bg-emerald-50"
                    aria-label={`Mark ${due.title} as paid`}
                    title="Paid"
                  >
                    <CircleCheck className="size-5" />
                  </button>
                  <button
                    onClick={() => setEditing(due)}
                    className="flex size-10 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-brand-600"
                    aria-label={`Edit ${due.title}`}
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    onClick={() => setDeleting(due)}
                    className="flex size-10 items-center justify-center rounded-full text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    aria-label={`Remove ${due.title}`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {list.length > visible.length && (
        <button onClick={() => setShowAll(true)} className="mt-1 w-full rounded-lg py-2 text-sm font-medium text-brand-600 hover:bg-brand-50">
          Show all {list.length} dues
        </button>
      )}

      <Modal open={adding || editing !== null} title={editing ? "Edit due" : "Add upcoming due"} onClose={() => (setAdding(false), setEditing(null))}>
        {(adding || editing) && <DueForm key={editing?.id ?? "new"} existing={editing ?? undefined} onDone={() => (setAdding(false), setEditing(null))} />}
      </Modal>

      <Modal open={paying !== null} title="Mark as paid?" onClose={() => (busy ? undefined : setPaying(null))}>
        {paying && (
          <>
            <p className="text-sm text-slate-600">
              This saves a payment of <strong className="num text-slate-900">{formatINR(paying.amount)}</strong> to{" "}
              <strong className="text-slate-900">{paying.recipient}</strong> for <strong className="text-slate-900">{paying.title}</strong>, dated
              today.{" "}
              {paying.repeat === "none"
                ? "The due is then removed."
                : `The next due moves to ${formatDate(nextDueDate(paying.dueDate, paying.repeat))}.`}
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <Button variant="secondary" onClick={() => setPaying(null)} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={() => void confirmPay()} loading={busy}>
                Yes, paid
              </Button>
            </div>
          </>
        )}
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title="Remove this due?"
        confirmLabel="Remove"
        loading={busy}
        onCancel={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
        message={deleting && <p>This removes the reminder for {deleting.title}. Payments already recorded are kept.</p>}
      />
    </Card>
  );
}
