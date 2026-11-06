"use client";

import { forwardRef, useId } from "react";
import { Loader2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/api-client";

/* ------------------------------------------------------------------ */
/* Button                                                              */
/* ------------------------------------------------------------------ */

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-700 disabled:bg-brand-600/50",
  secondary: "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 active:bg-slate-100 disabled:text-slate-400",
  ghost: "text-slate-600 hover:bg-slate-100 active:bg-slate-200 disabled:text-slate-300",
  danger: "bg-rose-600 text-white shadow-sm hover:bg-rose-700 active:bg-rose-700 disabled:bg-rose-600/50",
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  icon?: LucideIcon;
  size?: "md" | "sm";
}

export function Button({
  variant = "primary",
  loading,
  icon: Icon,
  size = "md",
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        "inline-flex select-none items-center justify-center gap-2 rounded-xl font-medium transition-colors disabled:cursor-not-allowed",
        size === "md" ? "min-h-11 px-4 text-sm" : "min-h-9 px-3 text-xs",
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : Icon ? <Icon className="size-4" aria-hidden /> : null}
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Card                                                                */
/* ------------------------------------------------------------------ */

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100 sm:p-5", className)} {...rest}>
      {children}
    </div>
  );
}

export function CardTitle({ children, action, className }: { children: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mb-3 flex items-center justify-between gap-2", className)}>
      <h2 className="text-sm font-semibold text-slate-800">{children}</h2>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Form fields                                                         */
/* ------------------------------------------------------------------ */

const fieldBase =
  "block w-full min-w-0 rounded-xl border-0 bg-slate-50 px-3.5 text-base text-slate-900 ring-1 ring-inset ring-slate-200 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-brand-500 focus:outline-none disabled:opacity-60 sm:text-sm";

interface FieldWrapProps {
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  required?: boolean;
  id: string;
  children: React.ReactNode;
}

function FieldWrap({ label, error, hint, optional, required, id, children }: FieldWrapProps) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1.5 flex items-baseline gap-1 text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-rose-500">*</span>}
        {optional && <span className="text-xs font-normal text-slate-400">(optional)</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-xs text-rose-600">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  prefix?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, optional, prefix, className, id, required, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <FieldWrap label={label} error={error} hint={hint} optional={optional} required={required} id={inputId}>
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-slate-500">{prefix}</span>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className={cn(fieldBase, "h-12", prefix && "pl-8", error && "ring-rose-400", className)}
          required={required}
          {...rest}
        />
      </div>
    </FieldWrap>
  );
});

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  optional?: boolean;
}

export function Select({ label, error, optional, className, id, children, required, ...rest }: SelectProps) {
  const autoId = useId();
  const selectId = id ?? autoId;
  return (
    <FieldWrap label={label} error={error} optional={optional} required={required} id={selectId}>
      <select
        id={selectId}
        aria-invalid={error ? true : undefined}
        className={cn(fieldBase, "h-12 appearance-none bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-9", error && "ring-rose-400", className)}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
        }}
        required={required}
        {...rest}
      >
        {children}
      </select>
    </FieldWrap>
  );
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  optional?: boolean;
}

export function Textarea({ label, error, optional, className, id, ...rest }: TextareaProps) {
  const autoId = useId();
  const areaId = id ?? autoId;
  return (
    <FieldWrap label={label} error={error} optional={optional} id={areaId}>
      <textarea
        id={areaId}
        rows={2}
        className={cn(fieldBase, "resize-none py-3", error && "ring-rose-400", className)}
        {...rest}
      />
    </FieldWrap>
  );
}

/* ------------------------------------------------------------------ */
/* Misc                                                                */
/* ------------------------------------------------------------------ */

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("size-5 animate-spin text-brand-600", className)} aria-label="Loading" />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-slate-200/70", className)} />;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
      <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
        <Icon className="size-6" aria-hidden />
      </div>
      <p className="font-medium text-slate-800">{title}</p>
      {description && <p className="mt-1 max-w-xs text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="truncate text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Segmented control                                                   */
/* ------------------------------------------------------------------ */

export function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; icon?: LucideIcon }[];
}) {
  return (
    <div className="min-w-0">
      <p className="mb-1.5 text-sm font-medium text-slate-700">{label}</p>
      <div className="flex gap-1 rounded-xl bg-slate-100 p-1" role="radiogroup" aria-label={label}>
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={o.label}
              onClick={() => onChange(o.value)}
              className={cn(
                "flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-medium transition-colors",
                active ? "bg-white text-brand-700 shadow-sm ring-1 ring-brand-200" : "text-slate-500 hover:text-brand-700",
              )}
            >
              {o.icon && <o.icon className="size-4 shrink-0" aria-hidden />}
              <span className="truncate">{o.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
