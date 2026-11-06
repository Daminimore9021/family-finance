import { route, ok, readJson } from "@/lib/server/http";
import { createDue, listDues } from "@/lib/server/repo";
import { badRequest } from "@/lib/server/errors";
import { validateDueInput } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** GET /api/dues — every upcoming / repeating payment, soonest first. */
export const GET = route(async () => ok(await listDues()));

export const POST = route(async (req) => {
  const result = validateDueInput(await readJson(req));
  if (!result.ok) throw badRequest("Please fix the highlighted fields", result.fields);
  return ok(await createDue(result.data), 201);
});
