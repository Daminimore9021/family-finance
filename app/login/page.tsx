"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Lock, RefreshCw, ShieldCheck } from "lucide-react";
import { GoogleSetup } from "@/components/GoogleSetup";
import { PinPad } from "@/components/PinPad";
import { ServiceEmail } from "@/components/SheetConnectForm";
import { Button } from "@/components/ui/primitives";
import { api } from "@/lib/api-client";
import type { SessionInfo } from "@/lib/types";

type Mode = "loading" | "config-error" | "setup" | "confirm" | "login";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("loading");
  const [info, setInfo] = useState<SessionInfo | null>(null);
  const [pin, setPin] = useState("");
  const [firstPin, setFirstPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [shake, setShake] = useState(false);

  const load = useCallback(async () => {
    setMode("loading");
    setMessage(null);
    try {
      const s = await api<SessionInfo>("/api/auth/session");
      setInfo(s);
      if (s.authenticated) {
        router.replace("/");
        return;
      }
      if (s.missingEnv?.length || s.error) setMode("config-error");
      else setMode(s.configured ? "login" : "setup");
    } catch (err) {
      setInfo({ configured: false, authenticated: false, error: err instanceof Error ? err.message : "Could not reach the server" });
      setMode("config-error");
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  const fail = (msg: string) => {
    setMessage(msg);
    setShake(true);
    setTimeout(() => {
      setShake(false);
      setPin("");
    }, 450);
  };

  const onPinChange = async (value: string) => {
    setMessage(null);
    setPin(value);
    if (value.length < 4 || busy) return;

    if (mode === "setup") {
      setFirstPin(value);
      setTimeout(() => {
        setPin("");
        setMode("confirm");
      }, 150);
      return;
    }

    setBusy(true);
    try {
      if (mode === "confirm") {
        if (value !== firstPin) {
          setBusy(false);
          fail("PINs did not match. Start again.");
          setTimeout(() => setMode("setup"), 450);
          return;
        }
        await api("/api/auth/setup", { method: "POST", body: { pin: firstPin, confirmPin: value } });
      } else {
        await api("/api/auth/login", { method: "POST", body: { pin: value } });
      }
      router.replace("/");
      router.refresh();
    } catch (err) {
      setBusy(false);
      fail(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  const titles: Record<Exclude<Mode, "loading" | "config-error">, { title: string; sub: string }> = {
    setup: { title: "Create your PIN", sub: "Choose a 4-digit PIN to protect your finances." },
    confirm: { title: "Confirm your PIN", sub: "Enter the same 4 digits again." },
    login: { title: "Welcome back", sub: "Enter your 4-digit PIN to continue." },
  };

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-brand-50 via-page to-page px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-brand-600 text-2xl font-bold text-white shadow-lg shadow-brand-600/25">
            ₹
          </div>
          <p className="text-sm font-medium text-brand-700">Family Finance</p>
        </div>

        {mode === "loading" && (
          <div className="flex justify-center py-16">
            <Loader2 className="size-7 animate-spin text-brand-600" aria-label="Loading" />
          </div>
        )}

        {mode === "config-error" && info && info.canConfigure && (info.needsCredentials || info.needsSheet) && (
          <GoogleSetup info={info} onDone={load} />
        )}

        {mode === "config-error" && info && !(info.canConfigure && (info.needsCredentials || info.needsSheet)) && (
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
            <div className="mb-3 flex items-center gap-2 text-amber-700">
              <AlertTriangle className="size-5" aria-hidden />
              <h1 className="font-semibold">Setup needed</h1>
            </div>
            {info.missingEnv?.length ? (
              <>
                <p className="text-sm text-slate-600">These environment variables are missing on the server:</p>
                <ul className="mt-3 space-y-1">
                  {info.missingEnv.map((v) => (
                    <li key={v} className="break-all rounded-lg bg-slate-50 px-3 py-2 font-mono text-xs text-slate-800">
                      {v}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <>
                <p className="break-words text-sm text-slate-600">{info.error}</p>
                {info.serviceAccountEmail && /share/i.test(info.error ?? "") && (
                  <ServiceEmail email={info.serviceAccountEmail} className="mt-3" />
                )}
              </>
            )}
            <p className="mt-4 text-xs text-slate-500">
              Follow <strong>PENDING_SETUP_AND_DEPLOYMENT_GUIDE.md</strong> in the project folder, then restart the app.
            </p>
            <Button variant="secondary" icon={RefreshCw} className="mt-5 w-full" onClick={load}>
              Try again
            </Button>
          </div>
        )}

        {(mode === "setup" || mode === "confirm" || mode === "login") && (
          <div className="flex flex-col items-center">
            <div className="mb-1 flex items-center gap-2">
              {mode === "login" ? (
                <Lock className="size-4 text-slate-400" aria-hidden />
              ) : (
                <ShieldCheck className="size-4 text-slate-400" aria-hidden />
              )}
              <h1 className="text-xl font-semibold text-slate-900">{titles[mode].title}</h1>
            </div>
            <p className="mb-8 text-center text-sm text-slate-500">{titles[mode].sub}</p>
            <PinPad value={pin} onChange={onPinChange} disabled={busy} shake={shake} />
            <div className="mt-6 min-h-10 text-center" aria-live="assertive">
              {busy ? (
                <Loader2 className="mx-auto size-5 animate-spin text-brand-600" aria-label="Checking" />
              ) : message ? (
                <p className="text-sm font-medium text-rose-600">{message}</p>
              ) : null}
            </div>
            {mode === "login" && (
              <p className="mt-2 max-w-xs text-center text-xs text-slate-400">
                Forgot your PIN? See “Forgot PIN” in the setup guide to reset it from your Google Sheet.
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
