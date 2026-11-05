"use client";

import { useRef, useState } from "react";
import { CheckCircle2, FileKey2, Loader2, Sheet } from "lucide-react";
import { api, cn } from "@/lib/api-client";
import type { SessionInfo } from "@/lib/types";
import { ServiceEmail, SheetConnectForm } from "./SheetConnectForm";

/**
 * First-run setup on a laptop: upload the service-account key file, then paste
 * the Google Sheet link. Both are verified with Google and saved to .env.local.
 */
export function GoogleSetup({ info, onDone }: { info: SessionInfo; onDone: () => void }) {
  const [keyError, setKeyError] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const keyDone = !info.needsCredentials;

  async function uploadKey(file: File) {
    setKeyError("");
    setUploading(true);
    try {
      const keyJson = await file.text();
      await api("/api/setup/credentials", { method: "POST", body: { keyJson } });
      onDone();
    } catch (err) {
      setKeyError(err instanceof Error ? err.message : "Could not use that key file");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-3">
      <div className="mb-2 text-center">
        <h1 className="text-xl font-semibold text-slate-900">Connect Google Sheets</h1>
        <p className="mt-1 text-sm text-slate-500">Two one-time steps. Your data will live in your own Google Sheet.</p>
      </div>

      {/* Step 1 — key file */}
      <Step n={1} done={keyDone} icon={FileKey2} title="Upload your service account key">
        {keyDone ? (
          <p className="text-sm text-slate-600">Key saved. The app signs in to Google as:</p>
        ) : (
          <>
            <p className="text-sm text-slate-600">
              Choose the <strong>.json</strong> key file you downloaded from Google Cloud (Service Accounts → Keys → Add key → JSON).
            </p>
            <label
              className={cn(
                "mt-3 flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand-200 bg-brand-50/50 px-3 text-sm font-medium text-brand-700 hover:bg-brand-50",
                uploading && "pointer-events-none opacity-60",
              )}
            >
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <FileKey2 className="size-4" />}
              {uploading ? "Checking key with Google…" : "Choose key file (.json)"}
              <input
                ref={fileRef}
                type="file"
                accept=".json,application/json"
                className="sr-only"
                onChange={(e) => e.target.files?.[0] && uploadKey(e.target.files[0])}
              />
            </label>
            {keyError && <p className="mt-2 break-words text-xs text-rose-600">{keyError}</p>}
          </>
        )}
        {keyDone && info.serviceAccountEmail && <ServiceEmail email={info.serviceAccountEmail} className="mt-2" />}
      </Step>

      {/* Step 2 — sheet */}
      <Step n={2} done={keyDone && !info.needsSheet} icon={Sheet} title="Connect your Google Sheet" disabled={!keyDone}>
        {keyDone && info.error && (
          <p className="mb-3 break-words rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{info.error}</p>
        )}
        {keyDone ? (
          <>
            <ol className="mb-3 list-decimal space-y-1 pl-5 text-sm text-slate-600">
              <li>
                In your sheet, click <strong>Share</strong>, add the email above as <strong>Editor</strong>, and untick “Notify people”.
              </li>
              <li>Copy the sheet link from the address bar and paste it below.</li>
            </ol>
            <SheetConnectForm onConnected={onDone} />
            <p className="mt-2 text-xs text-slate-400">
              The app creates the Income, Transactions and Settings tabs with the right columns automatically.
            </p>
          </>
        ) : (
          <p className="text-sm text-slate-400">Finish step 1 first.</p>
        )}
      </Step>

      {!keyDone && info.error && <p className="break-words rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{info.error}</p>}
    </div>
  );
}

function Step({
  n,
  done,
  icon: Icon,
  title,
  disabled,
  children,
}: {
  n: number;
  done: boolean;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100", disabled && "opacity-60")}>
      <div className="mb-2 flex items-center gap-2">
        {done ? (
          <CheckCircle2 className="size-5 text-emerald-600" aria-hidden />
        ) : (
          <span className="flex size-5 items-center justify-center rounded-full bg-brand-600 text-[11px] font-bold text-white">{n}</span>
        )}
        <Icon className="size-4 text-slate-400" aria-hidden />
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      </div>
      {children}
    </section>
  );
}
