import { idParam, ok, readJson, route } from "@/lib/server/http";
import { deleteDue, updateDue } from "@/lib/server/repo";
import { badRequest } from "@/lib/server/errors";
import { validateDueInput } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export const PUT = route<Ctx>(async (req, ctx) => {
  const id = await idParam(ctx);
  const result = validateDueInput(await readJson(req));
  if (!result.ok) throw badRequest("Please fix the highlighted fields", result.fields);
  return ok(await updateDue(id, result.data));
});

export const DELETE = route<Ctx>(async (_req, ctx) => {
  const id = await idParam(ctx);
  await deleteDue(id);
  return ok({ id });
});
