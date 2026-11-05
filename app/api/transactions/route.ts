import { route, ok, readJson } from "@/lib/server/http";
import { createTransaction, listTransactions } from "@/lib/server/repo";
import { badRequest } from "@/lib/server/errors";
import { filterTransactions, isRecipient } from "@/lib/calculations";
import { validateTransactionInput } from "@/lib/validation";
import type { SortOrder, TransactionFilter } from "@/lib/types";

export const dynamic = "force-dynamic";

const SORTS: SortOrder[] = ["date_desc", "date_asc", "amount_desc", "amount_asc"];

/**
 * GET /api/transactions?year=2026&month=11&recipient=Mummy&q=medicine&sort=date_desc
 * All query parameters are optional.
 */
export const GET = route(async (req) => {
  const p = req.nextUrl.searchParams;
  const filter: TransactionFilter = {};
  const year = p.get("year");
  if (year) {
    filter.year = Number(year);
    if (!Number.isInteger(filter.year)) throw badRequest("Invalid year");
  }
  const month = p.get("month");
  if (month) {
    filter.month = Number(month);
    if (!Number.isInteger(filter.month) || filter.month < 1 || filter.month > 12) throw badRequest("Invalid month");
  }
  const recipient = p.get("recipient");
  if (recipient && recipient !== "all") {
    if (!isRecipient(recipient)) throw badRequest("Invalid recipient");
    filter.recipient = recipient;
  }
  const q = p.get("q");
  if (q) filter.search = q.slice(0, 100);
  const sort = p.get("sort") as SortOrder | null;
  if (sort) {
    if (!SORTS.includes(sort)) throw badRequest("Invalid sort");
    filter.sort = sort;
  }
  return ok(filterTransactions(await listTransactions(), filter));
});

export const POST = route(async (req) => {
  const result = validateTransactionInput(await readJson(req));
  if (!result.ok) throw badRequest("Please fix the highlighted fields", result.fields);
  return ok(await createTransaction(result.data), 201);
});
