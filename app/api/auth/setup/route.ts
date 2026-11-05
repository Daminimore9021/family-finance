import { NextResponse } from "next/server";
import { getPinHash, issueSession, savePin } from "@/lib/server/auth";
import { badRequest, conflict } from "@/lib/server/errors";
import { readJson, route } from "@/lib/server/http";
import { ensureAllTables } from "@/lib/server/repo";
import { isValidPin } from "@/lib/validation";

/** Public, but only works once: creates the PIN when none exists yet. */
export const POST = route(
  async (req) => {
    const body = await readJson(req);
    if (!isValidPin(body.pin)) throw badRequest("PIN must be exactly 4 digits", { pin: "Enter 4 digits" });
    if (body.pin !== body.confirmPin) throw badRequest("PINs do not match", { confirmPin: "PINs do not match" });

    if (await getPinHash(true)) throw conflict("A PIN is already set up. Please log in.");
    await ensureAllTables(); // make sure Income & Transactions tabs exist from day one
    const hash = await savePin(body.pin);

    const res = NextResponse.json({ data: { ok: true } }, { status: 201 });
    await issueSession(res, hash);
    return res;
  },
  { auth: false },
);
