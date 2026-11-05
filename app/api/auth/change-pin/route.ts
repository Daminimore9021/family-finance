import { NextResponse } from "next/server";
import { checkPinWithLockout, issueSession, savePin } from "@/lib/server/auth";
import { AppError, badRequest } from "@/lib/server/errors";
import { readJson, route } from "@/lib/server/http";
import { isValidPin } from "@/lib/validation";

export const POST = route(async (req) => {
  const body = await readJson(req);
  if (!isValidPin(body.currentPin)) throw badRequest("Enter your current PIN", { currentPin: "Enter 4 digits" });
  if (!isValidPin(body.newPin)) throw badRequest("New PIN must be exactly 4 digits", { newPin: "Enter 4 digits" });
  if (body.newPin !== body.confirmPin) throw badRequest("New PINs do not match", { confirmPin: "PINs do not match" });
  if (body.newPin === body.currentPin) throw badRequest("New PIN must be different", { newPin: "Choose a different PIN" });

  try {
    await checkPinWithLockout(body.currentPin);
  } catch (err) {
    // A wrong current PIN is a form error here, not an expired session.
    if (err instanceof AppError && err.status === 401) throw new AppError(400, err.message, { currentPin: "Incorrect PIN" });
    throw err;
  }

  const hash = await savePin(body.newPin);
  // Changing the PIN signs out every other device; keep this one signed in.
  const res = NextResponse.json({ data: { ok: true } });
  await issueSession(res, hash);
  return res;
});
