"use client";

import { CloudOff, RefreshCw } from "lucide-react";
import { useData } from "./DataProvider";
import { Button, Card, Skeleton } from "./ui/primitives";

/**
 * Shows skeletons while the first load from Google Sheets is in flight,
 * and a retry card if it failed. Renders children once data is ready.
 */
export function LoadState({ children }: { children: React.ReactNode }) {
  const { loading, error, refresh, refreshing, incomes, transactions } = useData();

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading">
        <Skeleton className="h-12" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-48" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (error && incomes.length === 0 && transactions.length === 0) {
    return (
      <Card className="flex flex-col items-center py-10 text-center">
        <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
          <CloudOff className="size-6" aria-hidden />
        </div>
        <p className="font-medium text-slate-800">Could not load your data</p>
        <p className="mt-1 max-w-sm break-words text-sm text-slate-500">{error}</p>
        <Button className="mt-5" icon={RefreshCw} loading={refreshing} onClick={() => void refresh()}>
          Try again
        </Button>
      </Card>
    );
  }

  return <>{children}</>;
}
