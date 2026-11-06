"use client";

import { useMemo, useState } from "react";
import { Check, Gift, HandCoins } from "lucide-react";
import { RECIPIENTS, RECIPIENT_META, LIMITS, REASON_PRESETS } from "@/lib/constants";
import { frequentReasons } from "@/lib/calculations";
import { formatINR, todayISO } from "@/lib/format";
import { ApiError, cn } from "@/lib/api-client";
import { parseAmount, validateTransactionInput } from "@/lib/validation";
import type { PaymentKind, Recipient, Transaction } from "@/lib/types";
import { useData } from "./DataProvider";
import { DatePicker, TimePicker } from "./ui/DateTimePicker";
import { Button, Input, Segmented, Textarea } from "./ui/primitives";
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
  kind: PaymentKind;
  returnedAmount: string;
  returnedDate: string;
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
        kind: existing.kind,
        returnedAmount: existing.returnedAmount ? String(existing.returnedAmount) : "",
        returnedDate: existing.returnedDate || todayISO(),
      }
    : {
        recipient: "",
        amount: "",
        date: todayISO(),
        time: "",
        description: "",
        reason: "",
        notes: "",
        kind: "gift",
        returnedAmount: "",
        returnedDate: todayISO(),
      };
}

export function PaymentForm({ existing, onSaved, onCancel }: Props) {
  const { saveTransaction, transactions } = useData();
  const toast = useToast();
  const [form, setForm] = useState<FormState>(() => initialState(existing));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Reasons used before come first, then the presets, without duplicates.
  const reasonChips = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const r of [...frequentReasons(transactions, 6), ...REASON_PRESETS]) {
      const key = r.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        out.push(r);
      }
    }
    return out.slice(0, 10);
  }, [transactions]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: "" }));
  };

  const loanLeft = useMemo(() => {
    const total = parseAmount(form.amount) ?? 0;
    const back = parseAmount(form.returnedAmount || "0") ?? 0;
    return Math.max(0, Math.round((total - back) * 100) / 100);
  }, [form.amount, form.returnedAmount]);

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
      const what = result.data.kind === "loan" ? "Loan of" : "";
      toast.success(
        existing ? "Payment updated" : `${what} ₹${result.data.amount.toLocaleString("en-IN")} to ${result.data.recipient} saved`.trim(),
      );
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

      <Segmented
        label="Type"
        value={form.kind}
        onChange={(v) => set("kind", v)}
        options={[
          { value: "gift", label: "Given", icon: Gift },
          { value: "loan", label: "Loan (will come back)", icon: HandCoins },
        ]}
      />

      <Input
        label={form.kind === "loan" ? "Loan amount" : "Amount"}
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

      {form.kind === "loan" && (
        <div className="space-y-3 rounded-2xl bg-amber-50/60 p-3 ring-1 ring-amber-100">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Returned so far"
              optional
              prefix="₹"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0"
              value={form.returnedAmount}
              onChange={(e) => set("returnedAmount", e.target.value.replace(/[^\d.]/g, ""))}
              error={errors.returnedAmount}
            />
            <DatePicker label="Returned on" value={form.returnedDate} onChange={(v) => set("returnedDate", v)} error={errors.returnedDate} />
          </div>
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="text-slate-600">
              Still to get back: <strong className="num text-slate-900">{formatINR(loanLeft)}</strong>
            </span>
            {loanLeft > 0 && form.amount && (
              <button
                type="button"
                onClick={() => {
                  set("returnedAmount", form.amount);
                  set("returnedDate", todayISO());
                }}
                className="rounded-lg px-2 py-1 text-xs font-semibold text-brand-600 hover:bg-brand-50"
              >
                Fully returned
              </button>
            )}
          </div>
        </div>
      )}

      <div>
        <Input
          label="Reason"
          optional
          maxLength={LIMITS.reason}
          placeholder="Pick below or type your own"
          value={form.reason}
          onChange={(e) => set("reason", e.target.value)}
          error={errors.reason}
        />
        <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Quick reasons">
          {reasonChips.map((r) => {
            const active = form.reason.trim().toLowerCase() === r.toLowerCase();
            return (
              <button
                key={r}
                type="button"
                aria-pressed={active}
                onClick={() => set("reason", active ? "" : r)}
                className={cn(
                  "min-h-8 rounded-full px-3 text-xs font-medium ring-1 transition-colors",
                  active ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-slate-600 ring-slate-200 hover:bg-brand-50 hover:text-brand-700",
                )}
              >
                {r}
              </button>
            );
          })}
        </div>
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
          {existing ? "Save changes" : form.kind === "loan" ? "Save loan" : "Save payment"}
        </Button>
      </div>
    </form>
  );
}
