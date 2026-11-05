import { idParam, ok, readJson, route } from "@/lib/server/http";
import { deleteIncome, updateIncome } from "@/lib/server/repo";
import { badRequest } from "@/lib/server/errors";
import { validateIncomeInput } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export const PUT = route<Ctx>(async (req, ctx) => {
  const id = await idParam(ctx);
  const result = validateIncomeInput(await readJson(req));
  if (!result.ok) throw badRequest("Please fix the highlighted fields", result.fields);
  return ok(await updateIncome(id, result.data));
});

export const DELETE = route<Ctx>(async (_req, ctx) => {
  const id = await idParam(ctx);
  await deleteIncome(id);
  return ok({ id });
});
