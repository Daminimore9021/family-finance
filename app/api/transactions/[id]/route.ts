import { idParam, ok, readJson, route } from "@/lib/server/http";
import { deleteTransaction, updateTransaction } from "@/lib/server/repo";
import { badRequest } from "@/lib/server/errors";
import { validateTransactionInput } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export const PUT = route<Ctx>(async (req, ctx) => {
  const id = await idParam(ctx);
  const result = validateTransactionInput(await readJson(req));
  if (!result.ok) throw badRequest("Please fix the highlighted fields", result.fields);
  return ok(await updateTransaction(id, result.data));
});

export const DELETE = route<Ctx>(async (_req, ctx) => {
  const id = await idParam(ctx);
  await deleteTransaction(id);
  return ok({ id });
});
