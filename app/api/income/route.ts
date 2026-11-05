import { route, ok, readJson } from "@/lib/server/http";
import { createIncome, listIncome } from "@/lib/server/repo";
import { badRequest } from "@/lib/server/errors";
import { validateIncomeInput } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** GET /api/income?year=2026 — all income records (optionally for one year), newest first. */
export const GET = route(async (req) => {
  const yearParam = req.nextUrl.searchParams.get("year");
  let incomes = await listIncome();
  if (yearParam) {
    const year = Number(yearParam);
    if (!Number.isInteger(year)) throw badRequest("Invalid year");
    incomes = incomes.filter((i) => i.year === year);
  }
  return ok(incomes);
});

export const POST = route(async (req) => {
  const result = validateIncomeInput(await readJson(req));
  if (!result.ok) throw badRequest("Please fix the highlighted fields", result.fields);
  return ok(await createIncome(result.data), 201);
});
