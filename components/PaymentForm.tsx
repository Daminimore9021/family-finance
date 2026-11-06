"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { RECIPIENTS, RECIPIENT_META, LIMITS } from "@/lib/constants";
import { todayISO } from "@/lib/format";
import { ApiError, cn } from "@/lib/api-client";
import { validateTransactionInput } from "@/lib/validation";
import type { Recipient, Transaction } from "@/lib/types";
import { useData } from "./DataProvider";
import { DatePicker, TimePicker } from "./ui/DateTimePicker";
import { Button, Input, Textarea } from "./ui/primitives";
import { useToast } from "./ui/Toast";

interface Props {
  existing?: Transaction;
  onSaved?: (tx: Transaction) => void;
  onCancel?: () => void;
}

interface FormState {
  recipient: Recipient | "";
  amount: string;
  date: string;
  time: string;
  description: string;
  reason: string;
  notes: string;
}

function initialState(existing?: Transaction): FormState {
  return existing
    ? {
        recipient: existing.recipient,
        amount: String(existing.amount),
        date: existing.date,
        time: existing.time,
        description: existing.description,
        reason: existing.reason,
        notes: existing.notes,
      }
    : { recipient: "", amount: "", date: todayISO(), time: "", description: "", reason: "", notes: "" };
}

export function PaymentForm({ existing, onSaved, onCancel }: Props) {
  const { saveTransaction } = useData();
  const toast = useToast();
  const [form, setForm] = useState<FormState>(() => initialState(existing));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: "" }));
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const result = validateTransactionInput(form);
    if (!result.ok) {
      setErrors(result.fields);
      return;
    }
    setSaving(true);
    try {
      const saved = await saveTransaction(result.data, existing?.id);
      toast.success(existing ? "Payment updated" : `₹${result.data.amount.toLocaleString("en-IN")} to ${result.data.recipient} saved`);
      if (!existing) setForm({ ...initialState(), date: form.date });
      setErrors({});
      onSaved?.(saved);
    } catch (err) {
      if (err instanceof ApiError && err.fields) setErrors(err.fields);
      toast.error(err instanceof Error ? err.message : "Could not save payment");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-slate-700">
          Recipient <span className="text-rose-500">*</span>
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
                  "relative flex min-h-14 flex-col items-center justify-center rounded-xl px-1 text-sm font-medium ring-1 transition-all",
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

      <div className="grid grid-cols-2 gap-3">
        <DatePicker label="Payment date" required value={form.date} onChange={(v) => set("date", v)} error={errors.date} />
        <TimePicker label="Time" optional value={form.time} onChange={(v) => set("time", v)} error={errors.time} />
      </div>

      <Input
        label="Description"
        optional
        maxLength={LIMITS.description}
        placeholder="e.g. Monthly household money"
        value={form.description}
        onChange={(e) => set("description", e.target.value)}
        error={errors.description}
      />
      <Input
        label="Reason"
        optional
        maxLength={LIMITS.reason}
        placeholder="e.g. Medicine, fees, rent"
        value={form.reason}
        onChange={(e) => set("reason", e.target.value)}
        error={errors.reason}
      />
      <Textarea
        label="Notes"
        optional
        maxLength={LIMITS.notes}
        placeholder="Anything else to remember"
        value={form.notes}
        onChange={(e) => set("notes", e.target.value)}
        error={errors.notes}
      />

      <div className={cn("grid gap-3", onCancel ? "grid-cols-2" : "grid-cols-1")}>
        {onCancel && (
          <Button variant="secondary" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        )}
        <Button type="submit" loading={saving}>
          {existing ? "Save changes" : "Save payment"}
        </Button>
      </div>
    </form>
  );
}
