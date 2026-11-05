/**
 * Signed session tokens using Web Crypto HMAC-SHA256.
 * Works in both the Node.js runtime (API routes) and the proxy runtime.
 *
 * Token format: base64url(JSON payload) + "." + base64url(HMAC signature)
 * Payload: { v: pinVersion, iat, exp } — `v` is derived from the stored PIN hash,
 * so changing the PIN invalidates every existing session.
 */

export const SESSION_COOKIE = "fft_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

export interface SessionPayload {
  v: string;
  iat: number;
  exp: number;
}

const encoder = new TextEncoder();

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64url(input: string): Uint8Array<ArrayBuffer> {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((input.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function getSessionSecret(): string | null {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) return null;
  return secret;
}

let keyCache: { secret: string; key: CryptoKey } | null = null;

async function getKey(): Promise<CryptoKey> {
  const secret = getSessionSecret();
  if (!secret) throw new Error("SESSION_SECRET is missing or shorter than 32 characters");
  if (keyCache?.secret === secret) return keyCache.key;
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
  keyCache = { secret, key };
  return key;
}

export async function signSession(pinVersion: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = { v: pinVersion, iat: now, exp: now + SESSION_MAX_AGE_SECONDS };
  const body = base64url(encoder.encode(JSON.stringify(payload)));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await getKey(), encoder.encode(body)));
  return `${body}.${base64url(sig)}`;
}

/** Returns the payload when the signature is valid and the token has not expired. */
export async function verifySession(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token || token.length > 1024) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  try {
    const [body, sig] = parts;
    const valid = await crypto.subtle.verify("HMAC", await getKey(), fromBase64url(sig), encoder.encode(body));
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromBase64url(body))) as SessionPayload;
    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (typeof payload.v !== "string") return null;
    return payload;
  } catch {
    return null;
  }
}

/** Short fingerprint of the stored PIN hash, embedded in sessions. */
export async function pinVersion(pinHash: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(pinHash)));
  return base64url(digest).slice(0, 16);
}
