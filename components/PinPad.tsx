"use client";

import { useEffect } from "react";
import { Delete } from "lucide-react";
import { cn } from "@/lib/api-client";

interface Props {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  shake?: boolean;
}

/** 4-dot PIN display with an on-screen keypad; physical keyboard digits work too. */
export function PinPad({ value, onChange, disabled, shake }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (disabled) return;
      if (/^\d$/.test(e.key) && value.length < 4) onChange(value + e.key);
      else if (e.key === "Backspace") onChange(value.slice(0, -1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [value, onChange, disabled]);

  const press = (d: string) => !disabled && value.length < 4 && onChange(value + d);

  return (
    <div className="flex w-full flex-col items-center">
      <div className={cn("mb-8 flex gap-4", shake && "animate-shake")} aria-label={`${value.length} of 4 digits entered`} role="status">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn(
              "size-4 rounded-full transition-all",
              i < value.length ? "scale-110 bg-brand-600" : "bg-slate-200",
              shake && "bg-rose-500",
            )}
          />
        ))}
      </div>
      <div className="grid w-full max-w-[280px] grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <Key key={d} onClick={() => press(d)} disabled={disabled}>
            {d}
          </Key>
        ))}
        <span />
        <Key onClick={() => press("0")} disabled={disabled}>
          0
        </Key>
        <Key onClick={() => onChange(value.slice(0, -1))} disabled={disabled || value.length === 0} label="Delete last digit">
          <Delete className="size-6" />
        </Key>
      </div>
    </div>
  );
}

function Key({
  children,
  onClick,
  disabled,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-16 items-center justify-center rounded-2xl bg-white text-2xl font-medium text-slate-800 shadow-sm ring-1 ring-slate-100 transition active:scale-95 active:bg-slate-100 disabled:opacity-40"
    >
      {children}
    </button>
  );
}
