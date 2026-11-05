import { NextResponse } from "next/server";
import { checkPinWithLockout, issueSession } from "@/lib/server/auth";
import { badRequest } from "@/lib/server/errors";
import { readJson, route } from "@/lib/server/http";
import { isValidPin } from "@/lib/validation";

export const POST = route(
  async (req) => {
    const body = await readJson(req);
    if (!isValidPin(body.pin)) throw badRequest("Enter your 4-digit PIN");
    const hash = await checkPinWithLockout(body.pin);
    const res = NextResponse.json({ data: { ok: true } });
    await issueSession(res, hash);
    return res;
  },
  { auth: false },
);
