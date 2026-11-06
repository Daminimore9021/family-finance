"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, X } from "lucide-react";
import { MONTH_NAMES, MONTH_SHORT } from "@/lib/constants";
import { formatDate, formatTime, todayISO } from "@/lib/format";
import { cn } from "@/lib/api-client";

/* ------------------------------------------------------------------ */
/* Shared bits                                                         */
/* ------------------------------------------------------------------ */

const triggerBase =
  "flex h-12 w-full min-w-0 items-center gap-2.5 rounded-xl bg-slate-50 px-3.5 text-left text-base ring-1 ring-inset ring-slate-200 transition-colors hover:bg-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-60 sm:text-sm";

const panelBase =
  "animate-fade-in absolute left-0 top-full z-30 mt-2 w-[18.5rem] max-w-[calc(100vw-2rem)] rounded-2xl bg-white p-3 shadow-xl ring-1 ring-slate-200";

/** Closes the popover on outside click or Escape. */
function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);
  return { open, setOpen, ref };
}

interface LabelProps {
  label: string;
  id: string;
  required?: boolean;
  optional?: boolean;
  error?: string;
  children: React.ReactNode;
}

function Field({ label, id, required, optional, error, children }: LabelProps) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1.5 flex items-baseline gap-1 text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-rose-500">*</span>}
        {optional && <span className="text-xs font-normal text-slate-400">(optional)</span>}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-xs text-rose-600">
          {error}
        </p>
      )}
    </div>
  );
}

const navBtn =
  "flex size-9 items-center justify-center rounded-full text-slate-500 hover:bg-brand-50 hover:text-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500";

/* ------------------------------------------------------------------ */
/* DatePicker                                                          */
/* ------------------------------------------------------------------ */

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

function parseISO(value: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return m ? { y: Number(m[1]), m: Number(m[2]) - 1, d: Number(m[3]) } : null;
}

interface DatePickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  optional?: boolean;
  error?: string;
}

/** Calendar popover in the app's brand colours. Value is YYYY-MM-DD. */
export function DatePicker({ label, value, onChange, required, optional, error }: DatePickerProps) {
  const id = useId();
  const { open, setOpen, ref } = usePopover();
  const today = todayISO();
  const selected = parseISO(value);
  const start = selected ?? parseISO(today)!;
  const [view, setView] = useState({ y: start.y, m: start.m });
  const [mode, setMode] = useState<"days" | "months">("days");

  // Re-centre on the selected date whenever the popover opens.
  useEffect(() => {
    if (!open) return;
    const s = parseISO(value) ?? parseISO(todayISO())!;
    setView({ y: s.y, m: s.m });
    setMode("days");
  }, [open, value]);

  const cells = useMemo(() => {
    const first = new Date(view.y, view.m, 1).getDay();
    const days = new Date(view.y, view.m + 1, 0).getDate();
    const out: (number | null)[] = Array.from({ length: first }, () => null);
    for (let d = 1; d <= days; d++) out.push(d);
    while (out.length % 7) out.push(null);
    return out;
  }, [view]);

  const shift = (delta: number) =>
    setView((v) => {
      const idx = v.y * 12 + v.m + delta;
      return { y: Math.floor(idx / 12), m: ((idx % 12) + 12) % 12 };
    });

  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  return (
    <Field label={label} id={id} required={required} optional={optional} error={error}>
      <div ref={ref} className="relative">
        <button
          id={id}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onClick={() => setOpen((o) => !o)}
          className={cn(triggerBase, open && "bg-white ring-2 ring-brand-500", error && "ring-rose-400")}
        >
          <CalendarDays className="size-4 shrink-0 text-brand-600" aria-hidden />
          <span className={cn("truncate", value ? "text-slate-900" : "text-slate-400")}>
            {value ? formatDate(value) : "Select date"}
          </span>
        </button>

        {open && (
          <div role="dialog" aria-label={`Choose ${label.toLowerCase()}`} className={panelBase}>
            <div className="mb-2 flex items-center justify-between">
              <button type="button" className={navBtn} onClick={() => (mode === "days" ? shift(-1) : shift(-12))} aria-label={mode === "days" ? "Previous month" : "Previous year"}>
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setMode((m) => (m === "days" ? "months" : "days"))}
                className="rounded-lg px-2.5 py-1.5 text-sm font-semibold text-slate-800 hover:bg-brand-50 hover:text-brand-700"
              >
                {mode === "days" ? `${MONTH_NAMES[view.m]} ${view.y}` : view.y}
              </button>
              <button type="button" className={navBtn} onClick={() => (mode === "days" ? shift(1) : shift(12))} aria-label={mode === "days" ? "Next month" : "Next year"}>
                <ChevronRight className="size-4" />
              </button>
            </div>

            {mode === "days" ? (
              <>
                <div className="grid grid-cols-7 text-center text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  {WEEKDAYS.map((w) => (
                    <span key={w} className="py-1">
                      {w}
                    </span>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-y-1">
                  {cells.map((d, i) => {
                    if (d === null) return <span key={i} />;
                    const v = iso(view.y, view.m, d);
                    const isSel = v === value;
                    const isToday = v === today;
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => pick(v)}
                        aria-pressed={isSel}
                        aria-label={formatDate(v)}
                        className={cn(
                          "num mx-auto flex size-9 items-center justify-center rounded-full text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
                          isSel
                            ? "bg-brand-600 font-semibold text-white shadow-sm"
                            : isToday
                              ? "font-semibold text-brand-700 ring-1 ring-inset ring-brand-500 hover:bg-brand-50"
                              : "text-slate-700 hover:bg-brand-50 hover:text-brand-700",
                        )}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="grid grid-cols-3 gap-2 py-1">
                {MONTH_SHORT.map((name, m) => {
                  const isSel = selected?.y === view.y && selected.m === m;
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => {
                        setView((v) => ({ ...v, m }));
                        setMode("days");
                      }}
                      className={cn(
                        "h-11 rounded-xl text-sm font-medium transition-colors",
                        isSel ? "bg-brand-600 text-white" : "bg-slate-50 text-slate-700 hover:bg-brand-50 hover:text-brand-700",
                      )}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2">
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100">
                Close
              </button>
              <button type="button" onClick={() => pick(today)} className="rounded-lg px-3 py-2 text-sm font-semibold text-brand-600 hover:bg-brand-50">
                Today
              </button>
            </div>
          </div>
        )}
      </div>
    </Field>
  );
}

/* ------------------------------------------------------------------ */
/* TimePicker                                                          */
/* ------------------------------------------------------------------ */

const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

function split(value: string): { h12: number; min: number; pm: boolean } | null {
  const m = /^(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const h = Number(m[1]);
  return { h12: h % 12 === 0 ? 12 : h % 12, min: Number(m[2]), pm: h >= 12 };
}

const join = (h12: number, min: number, pm: boolean) => `${pad((h12 % 12) + (pm ? 12 : 0))}:${pad(min)}`;

interface TimePickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  optional?: boolean;
  error?: string;
}

/** Hour / minute / AM-PM popover in the app's brand colours. Value is 24h HH:MM or "". */
export function TimePicker({ label, value, onChange, required, optional, error }: TimePickerProps) {
  const id = useId();
  const { open, setOpen, ref } = usePopover();
  const parts = split(value);

  const now = () => {
    const d = new Date();
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  // Picking an hour or minute before anything is set starts from the current time.
  const base = parts ?? split(now())!;
  const set = (patch: Partial<{ h12: number; min: number; pm: boolean }>) => {
    const next = { ...base, ...patch };
    onChange(join(next.h12, next.min, next.pm));
  };

  const chip = (active: boolean) =>
    cn(
      "num flex h-9 items-center justify-center rounded-lg text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
      active ? "bg-brand-600 font-semibold text-white shadow-sm" : "bg-slate-50 text-slate-700 hover:bg-brand-50 hover:text-brand-700",
    );

  return (
    <Field label={label} id={id} required={required} optional={optional} error={error}>
      <div ref={ref} className="relative">
        <button
          id={id}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onClick={() => setOpen((o) => !o)}
          className={cn(triggerBase, "pr-10", open && "bg-white ring-2 ring-brand-500", error && "ring-rose-400")}
        >
          <Clock className="size-4 shrink-0 text-brand-600" aria-hidden />
          <span className={cn("truncate", value ? "num text-slate-900" : "text-slate-400")}>
            {value ? formatTime(value) : "Select time"}
          </span>
        </button>
        {value && !required && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute inset-y-0 right-1.5 my-auto flex size-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Clear time"
          >
            <X className="size-4" />
          </button>
        )}

        {open && (
          <div role="dialog" aria-label={`Choose ${label.toLowerCase()}`} className={cn(panelBase, "left-auto right-0 sm:left-0 sm:right-auto")}>
            <div className="mb-3 flex items-center justify-between">
              <p className="num text-2xl font-semibold tracking-tight text-slate-900">
                {parts ? formatTime(value) : <span className="text-slate-300">--:--</span>}
              </p>
              <div className="flex rounded-xl bg-slate-100 p-1" role="group" aria-label="AM or PM">
                {(["AM", "PM"] as const).map((p) => {
                  const active = parts ? parts.pm === (p === "PM") : false;
                  return (
                    <button
                      key={p}
                      type="button"
                      aria-pressed={active}
                      onClick={() => set({ pm: p === "PM" })}
                      className={cn(
                        "h-8 rounded-lg px-3 text-xs font-semibold transition-colors",
                        active ? "bg-brand-600 text-white shadow-sm" : "text-slate-500 hover:text-brand-700",
                      )}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>

            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">Hour</p>
            <div className="grid grid-cols-6 gap-1.5">
              {HOURS.map((h) => (
                <button key={h} type="button" aria-pressed={parts?.h12 === h} onClick={() => set({ h12: h })} className={chip(parts?.h12 === h)}>
                  {h}
                </button>
              ))}
            </div>

            <p className="mb-1.5 mt-3 text-[11px] font-medium uppercase tracking-wide text-slate-400">Minute</p>
            <div className="grid grid-cols-6 gap-1.5">
              {MINUTES.map((m) => (
                <button key={m} type="button" aria-pressed={parts?.min === m} onClick={() => set({ min: m })} className={chip(parts?.min === m)}>
                  {pad(m)}
                </button>
              ))}
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2">
              <button type="button" onClick={() => onChange(now())} className="rounded-lg px-3 py-2 text-sm font-semibold text-brand-600 hover:bg-brand-50">
                Now
              </button>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </Field>
  );
}
