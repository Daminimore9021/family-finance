"use client";

import { useState } from "react";
import { Check, Copy, Link2 } from "lucide-react";
import { api, ApiError, cn } from "@/lib/api-client";
import { Button, Input } from "./ui/primitives";

export interface ConnectResult {
  sheetId: string;
  sheetUrl: string;
  title: string;
  pinStatus: "none" | "copied" | "same" | "different";
  requiresLogin: boolean;
}

/** Paste a Google Sheets link → the server checks access, creates tabs/headers and switches to it. */
export function SheetConnectForm({
  submitLabel = "Connect sheet",
  beforeConnect,
  onConnected,
  onError,
}: {
  submitLabel?: string;
  /** Return false to cancel (e.g. a confirmation step). */
  beforeConnect?: (url: string) => Promise<boolean> | boolean;
  onConnected: (result: ConnectResult) => void;
  onError?: (message: string) => void;
}) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/\/spreadsheets\/d\/[\w-]{20,}/.test(url) && !/^[\w-]{20,}$/.test(url.trim())) {
      setError("Paste the full link from your browser's address bar (docs.google.com/spreadsheets/d/…)");
      return;
    }
    if (beforeConnect && !(await beforeConnect(url))) return;
    setBusy(true);
    setError("");
    try {
      onConnected(await api<ConnectResult>("/api/sheet/connect", { method: "POST", body: { url } }));
      setUrl("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not connect the sheet";
      setError(err instanceof ApiError && err.fields?.url ? err.fields.url : message);
      onError?.(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      <Input
        label="Google Sheet link"
        placeholder="https://docs.google.com/spreadsheets/d/…"
        inputMode="url"
        autoComplete="off"
        value={url}
        onChange={(e) => {
          setUrl(e.target.value);
          setError("");
        }}
        error={error}
      />
      <Button type="submit" icon={Link2} loading={busy} className="w-full">
        {busy ? "Checking sheet…" : submitLabel}
      </Button>
    </form>
  );
}

/** Shows the service-account email with a copy button (users must share their sheet with it). */
export function ServiceEmail({ email, className }: { email: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className={cn("flex items-center gap-2 rounded-xl bg-slate-50 p-2 pl-3 ring-1 ring-slate-200", className)}>
      <code className="min-w-0 flex-1 break-all text-xs text-slate-800">{email}</code>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(email);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            /* clipboard unavailable */
          }
        }}
        className="flex min-h-9 shrink-0 items-center gap-1 rounded-lg bg-white px-2.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100"
        aria-label="Copy service account email"
      >
        {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
