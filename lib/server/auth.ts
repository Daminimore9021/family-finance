import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { pinVersion, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, signSession, verifySession } from "@/lib/session";
import { AppError, unauthorized } from "./errors";
import { getSettings, setSettings } from "./repo";

const KEYS = {
  pinHash: "pin_hash",
  failed: "failed_attempts",
  lockedUntil: "locked_until",
} as const;

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 5;
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

function scryptAsync(pin: string, salt: Buffer, keylen: number, opts: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(pin, salt, keylen, opts, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

/** Returns "scrypt$N$r$p$salt$hash" — the PIN itself is never stored. */
export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(pin, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, maxmem: 64 * 1024 * 1024 });
  return ["scrypt", SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPinHash(pin: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, N, r, p, saltB64, hashB64] = parts;
  const expected = Buffer.from(hashB64, "base64");
  const actual = await scryptAsync(pin, Buffer.from(saltB64, "base64"), expected.length, {
    N: Number(N),
    r: Number(r),
    p: Number(p),
    maxmem: 64 * 1024 * 1024,
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function getPinHash(fresh = false): Promise<string | null> {
  const settings = await getSettings(fresh);
  return settings[KEYS.pinHash] || null;
}

export async function savePin(pin: string): Promise<string> {
  const hash = await hashPin(pin);
  await setSettings({ [KEYS.pinHash]: hash, [KEYS.failed]: "0", [KEYS.lockedUntil]: "" });
  return hash;
}

/**
 * Checks a PIN with brute-force protection. The attempt counter lives in the
 * Settings sheet so the lockout works across serverless instances.
 */
export async function checkPinWithLockout(pin: string): Promise<string> {
  const settings = await getSettings(true);
  const hash = settings[KEYS.pinHash];
  if (!hash) throw new AppError(409, "No PIN has been set up yet.");

  const lockedUntil = Number(settings[KEYS.lockedUntil] || 0);
  if (lockedUntil > Date.now()) {
    const mins = Math.ceil((lockedUntil - Date.now()) / 60_000);
    throw new AppError(429, `Too many wrong attempts. Try again in ${mins} minute${mins === 1 ? "" : "s"}.`);
  }

  const ok = await verifyPinHash(pin, hash);
  const failed = Number(settings[KEYS.failed] || 0);

  if (!ok) {
    const attempts = failed + 1;
    if (attempts >= MAX_ATTEMPTS) {
      await setSettings({ [KEYS.failed]: "0", [KEYS.lockedUntil]: String(Date.now() + LOCK_MINUTES * 60_000) });
      throw new AppError(429, `Too many wrong attempts. Locked for ${LOCK_MINUTES} minutes.`);
    }
    await setSettings({ [KEYS.failed]: String(attempts) });
    const left = MAX_ATTEMPTS - attempts;
    throw new AppError(401, `Incorrect PIN. ${left} attempt${left === 1 ? "" : "s"} left.`);
  }

  if (failed > 0 || settings[KEYS.lockedUntil]) {
    await setSettings({ [KEYS.failed]: "0", [KEYS.lockedUntil]: "" });
  }
  return hash;
}

/* ------------------------------------------------------------------ */
/* sessions                                                            */
/* ------------------------------------------------------------------ */

export async function issueSession(res: NextResponse, pinHash: string): Promise<void> {
  const token = await signSession(await pinVersion(pinHash));
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export function clearSession(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/** Full server-side check: valid signature, not expired, and issued for the current PIN. */
export async function isAuthenticated(req: NextRequest): Promise<boolean> {
  const payload = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!payload) return false;
  const hash = await getPinHash();
  if (!hash) return false;
  return payload.v === (await pinVersion(hash));
}

export async function requireAuth(req: NextRequest): Promise<void> {
  if (!(await isAuthenticated(req))) throw unauthorized();
}
