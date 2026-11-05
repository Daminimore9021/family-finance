"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  FileSpreadsheet,
  HandCoins,
  History,
  LayoutDashboard,
  LogOut,
  Settings,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { api, cn } from "@/lib/api-client";
import { DataProvider } from "./DataProvider";

interface NavItem {
  href: string;
  label: string;
  short: string;
  icon: LucideIcon;
}

export const NAV: NavItem[] = [
  { href: "/", label: "Dashboard", short: "Home", icon: LayoutDashboard },
  { href: "/income", label: "Add Income", short: "Income", icon: Wallet },
  { href: "/payments", label: "Add Payment", short: "Pay", icon: HandCoins },
  { href: "/history", label: "History", short: "History", icon: History },
  { href: "/reports", label: "Reports & Export", short: "Reports", icon: FileSpreadsheet },
  { href: "/settings", label: "Settings", short: "Settings", icon: Settings },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    try {
      await api("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <DataProvider>
      <div className="min-h-dvh lg:flex">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-slate-200/70 bg-white px-4 py-6 lg:flex">
          <div className="mb-8 flex items-center gap-3 px-2">
            <div className="flex size-10 items-center justify-center rounded-xl bg-brand-600 text-lg font-bold text-white">₹</div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Family Finance</p>
              <p className="text-xs text-slate-500">Income &amp; family payments</p>
            </div>
          </div>
          <nav className="flex flex-1 flex-col gap-1" aria-label="Main">
            {NAV.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                    active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <item.icon className="size-5" aria-hidden />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <button
            onClick={logout}
            disabled={loggingOut}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-rose-50 hover:text-rose-700"
          >
            <LogOut className="size-5" aria-hidden />
            {loggingOut ? "Logging out…" : "Logout"}
          </button>
        </aside>

        <main className="min-w-0 flex-1 px-4 pb-28 pt-[max(env(safe-area-inset-top),16px)] sm:px-6 lg:px-10 lg:pb-12 lg:pt-8">
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </main>

        {/* Mobile bottom navigation */}
        <nav
          className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/80 bg-white/95 backdrop-blur lg:hidden"
          aria-label="Main"
        >
          <div className="mx-auto grid max-w-lg grid-cols-6">
            {NAV.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex min-h-16 flex-col items-center justify-center gap-1 px-0.5 text-[10.5px] font-medium leading-none transition-colors",
                    active ? "text-brand-700" : "text-slate-500 active:text-slate-800",
                  )}
                  aria-current={active ? "page" : undefined}
                  aria-label={item.label}
                >
                  <span
                    className={cn(
                      "flex h-8 w-11 items-center justify-center rounded-full transition-colors",
                      active && "bg-brand-50",
                    )}
                  >
                    <item.icon className="size-5" aria-hidden />
                  </span>
                  <span className="max-w-full truncate">{item.short}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </DataProvider>
  );
}
