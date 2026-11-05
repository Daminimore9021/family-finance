"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Database, KeyRound, LogOut, RefreshCw } from "lucide-react";
import { useData } from "@/components/DataProvider";
import { Button, Card, CardTitle, Input, PageHeader } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/api-client";
import { isValidPin } from "@/lib/validation";

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" subtitle="Security and account" />
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <ChangePinCard />
        <div className="space-y-4">
          <DataCard />
          <LogoutCard />
        </div>
      </div>
    </>
  );
}

function ChangePinCard() {
  const toast = useToast();
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const digits = (v: string) => v.replace(/\D/g, "").slice(0, 4);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!isValidPin(currentPin)) errs.currentPin = "Enter your current 4-digit PIN";
    if (!isValidPin(newPin)) errs.newPin = "New PIN must be 4 digits";
    else if (newPin === currentPin) errs.newPin = "Choose a different PIN";
    if (newPin !== confirmPin) errs.confirmPin = "PINs do not match";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setSaving(true);
    try {
      await api("/api/auth/change-pin", { method: "POST", body: { currentPin, newPin, confirmPin } });
      toast.success("PIN changed. Other devices have been signed out.");
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
    } catch (err) {
      if (err instanceof ApiError && err.fields) setErrors(err.fields);
      toast.error(err instanceof Error ? err.message : "Could not change PIN");
    } finally {
      setSaving(false);
    }
  }

  const pinProps = {
    type: "password" as const,
    inputMode: "numeric" as const,
    pattern: "\\d{4}",
    maxLength: 4,
    autoComplete: "off",
    className: "tracking-[0.5em]",
  };

  return (
    <Card>
      <CardTitle>
        <span className="flex items-center gap-2">
          <KeyRound className="size-4 text-brand-600" aria-hidden /> Change PIN
        </span>
      </CardTitle>
      <form onSubmit={submit} noValidate className="space-y-4">
        <Input label="Current PIN" required value={currentPin} onChange={(e) => setCurrentPin(digits(e.target.value))} error={errors.currentPin} {...pinProps} />
        <Input label="New PIN" required value={newPin} onChange={(e) => setNewPin(digits(e.target.value))} error={errors.newPin} {...pinProps} />
        <Input
          label="Confirm new PIN"
          required
          value={confirmPin}
          onChange={(e) => setConfirmPin(digits(e.target.value))}
          error={errors.confirmPin}
          {...pinProps}
        />
        <Button type="submit" loading={saving} className="w-full">
          Update PIN
        </Button>
      </form>
    </Card>
  );
}

function DataCard() {
  const { refresh, refreshing, incomes, transactions, error } = useData();
  const toast = useToast();
  return (
    <Card>
      <CardTitle>
        <span className="flex items-center gap-2">
          <Database className="size-4 text-brand-600" aria-hidden /> Data
        </span>
      </CardTitle>
      <p className="text-sm text-slate-600">
        All records are stored in your Google Sheet. Currently loaded: <strong>{incomes.length}</strong> income entries and{" "}
        <strong>{transactions.length}</strong> payments.
      </p>
      {error && <p className="mt-2 break-words text-sm text-rose-600">{error}</p>}
      <Button
        variant="secondary"
        icon={RefreshCw}
        loading={refreshing}
        className="mt-4 w-full"
        onClick={async () => {
          await refresh();
          toast.success("Data refreshed from Google Sheets");
        }}
      >
        Refresh from Google Sheets
      </Button>
    </Card>
  );
}

function LogoutCard() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Card>
      <CardTitle>
        <span className="flex items-center gap-2">
          <LogOut className="size-4 text-rose-600" aria-hidden /> Logout
        </span>
      </CardTitle>
      <p className="text-sm text-slate-600">Sign out of this device. You will need your PIN to sign in again.</p>
      <Button
        variant="danger"
        icon={LogOut}
        loading={busy}
        className="mt-4 w-full"
        onClick={async () => {
          setBusy(true);
          try {
            await api("/api/auth/logout", { method: "POST" });
          } finally {
            router.replace("/login");
            router.refresh();
          }
        }}
      >
        Logout
      </Button>
    </Card>
  );
}
