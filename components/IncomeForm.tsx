"use client";

import { useMemo, useState } from "react";
import { Info } from "lucide-react";
import { LIMITS, MONTH_NAMES } from "@/lib/constants";
import { incomesForMonth, sumAmounts } from "@/lib/calculations";
import { formatINR, monthLabel } from "@/lib/format";
import { ApiError, cn } from "@/lib/api-client";
import { validateIncomeInput } from "@/lib/validation";
import type { Income } from "@/lib/types";
import { useData } from "./DataProvider";
import { pickerYears } from "./MonthSwitcher";
import { Button, Input, Select, Textarea } from "./ui/primitives";
import { useToast } from "./ui/Toast";

interface Props {
  existing?: Income;
  defaultPeriod?: { year: number; month: number };
  onSaved?: (income: Income) => void;
  onCancel?: () => void;
  onEditExisting?: (income: Income) => void;
}

export function IncomeForm({ existing, defaultPeriod, onSaved, onCancel, onEditExisting }: Props) {
  const { incomes, saveIncome } = useData();
  const toast = useToast();
  const start = existing ?? defaultPeriod ?? { year: new Date().getFullYear(), month: new Date().getMonth() + 1 };
  const [month, setMonth] = useState(String(start.month));
  const [year, setYear] = useState(String(start.year));
  const [amount, setAmount] = useState(existing ? String(existing.amount) : "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const years = useMemo(() => pickerYears(incomes.map((i) => i.year)), [incomes]);

  // Other incomes already recorded for the chosen month. Not a blocker: a month can
  // have several incomes (salary, freelancing, ...), this just tells the user.
  const others = useMemo(
    () => incomesForMonth(incomes, Number(year), Number(month)).filter((i) => i.id !== existing?.id),
    [incomes, year, month, existing?.id],
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const result = validateIncomeInput({ month, year, amount, description });
    if (!result.ok) {
      setErrors(result.fields);
      return;
    }
    setSaving(true);
    try {
      const saved = await saveIncome(result.data, existing?.id);
      toast.success(`${existing ? "Updated" : "Saved"} ${saved.description || "income"} for ${monthLabel(saved.year, saved.month)}`);
      if (!existing) {
        setAmount("");
        setDescription("");
      }
      setErrors({});
      onSaved?.(saved);
    } catch (err) {
      if (err instanceof ApiError && err.fields) setErrors(err.fields);
      toast.error(err instanceof Error ? err.message : "Could not save income");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Select label="Month" required value={month} onChange={(e) => setMonth(e.target.value)} error={errors.month}>
          {MONTH_NAMES.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </Select>
        <Select label="Year" required value={year} onChange={(e) => setYear(e.target.value)} error={errors.year}>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </Select>
      </div>

      {others.length > 0 && (
        <div role="status" className="flex gap-3 rounded-xl bg-brand-50 p-3 text-sm text-brand-900 ring-1 ring-brand-100">
          <Info className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden />
          <div className="min-w-0">
            <p>
              <strong>{monthLabel(Number(year), Number(month))}</strong> already has{" "}
              {others.length === 1 ? "an income" : `${others.length} incomes`} of{" "}
              <strong className="num">{formatINR(sumAmounts(others.map((i) => i.amount)))}</strong>
              {others.some((i) => i.description) && <> ({others.map((i) => i.description).filter(Boolean).join(", ")})</>}.
              {existing ? "" : " This will be added as another income for the month."}
            </p>
            {onEditExisting && !existing && others.length === 1 && (
              <button type="button" className="mt-1 font-semibold text-brand-700 underline" onClick={() => onEditExisting(others[0])}>
                Edit that entry instead
              </button>
            )}
          </div>
        </div>
      )}

      <Input
        label="Income amount"
        required
        prefix="₹"
        inputMode="decimal"
        autoComplete="off"
        placeholder="0"
        value={amount}
        onChange={(e) => {
          setAmount(e.target.value.replace(/[^\d.]/g, ""));
          if (errors.amount) setErrors((x) => ({ ...x, amount: "" }));
        }}
        error={errors.amount}
      />
      <Textarea
        label="Description"
        optional
        maxLength={LIMITS.description}
        placeholder="e.g. Salary, Freelancing"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        error={errors.description}
      />

      <div className={cn("grid gap-3", onCancel ? "grid-cols-2" : "grid-cols-1")}>
        {onCancel && (
          <Button variant="secondary" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        )}
        <Button type="submit" loading={saving}>
          {existing ? "Save changes" : "Save income"}
        </Button>
      </div>
    </form>
  );
}
