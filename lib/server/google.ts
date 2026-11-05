/**
 * Minimal Google Sheets REST client authenticated with a service account.
 * Uses Node's crypto to sign the OAuth JWT, so no heavy Google SDK is needed.
 */
import { createSign } from "node:crypto";
import { AppError } from "./errors";
import { getCredentials, getGoogleConfig } from "./env";

const SCOPE = "https://www.googleapis.com/auth/spreadsheets";

let tokenCache: { token: string; expiresAt: number; email: string } | null = null;

export function resetTokenCache(): void {
  tokenCache = null;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function getAccessToken(): Promise<string> {
  const cfg = getCredentials();
  if (tokenCache && tokenCache.email === cfg.email && tokenCache.expiresAt - 60_000 > Date.now()) {
    return tokenCache.token;
  }

  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({ iss: cfg.email, scope: SCOPE, aud: cfg.tokenUrl, iat: now, exp: now + 3600 }));
  let signature: string;
  try {
    signature = b64url(createSign("RSA-SHA256").update(`${header}.${claims}`).sign(cfg.privateKey));
  } catch {
    throw new AppError(500, "GOOGLE_PRIVATE_KEY could not be read. Make sure you copied the complete private key.");
  }

  let res: Response;
  try {
    res = await fetch(cfg.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: `${header}.${claims}.${signature}`,
      }),
      cache: "no-store",
    });
  } catch {
    throw new AppError(503, "Could not reach Google. Check your internet connection and try again.");
  }

  const json = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string; error_description?: string };
  if (!res.ok || !json.access_token) {
    console.error("[google] token error", res.status, json.error, json.error_description);
    throw new AppError(
      500,
      "Google rejected the service account credentials. Check GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY.",
    );
  }
  tokenCache = { token: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000, email: cfg.email };
  return json.access_token;
}

function describeGoogleError(status: number, message: string): AppError {
  if (status === 403) {
    if (/has not been used|is disabled|SERVICE_DISABLED/i.test(message)) {
      return new AppError(500, "The Google Sheets API is not enabled in your Google Cloud project. Enable it and try again.");
    }
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() || "the service account email";
    return new AppError(
      500,
      `Permission denied by Google Sheets. Share the spreadsheet with ${email} as an Editor, and make sure the Google Sheets API is enabled.`,
    );
  }
  if (status === 404) return new AppError(500, "Spreadsheet not found. Check the sheet URL / GOOGLE_SHEET_ID.");
  if (status === 401) return new AppError(500, "Google authentication failed. Check the service account credentials.");
  if (status === 429) return new AppError(503, "Google Sheets is busy (rate limit). Please try again in a minute.");
  return new AppError(502, `Google Sheets error: ${message || `HTTP ${status}`}`);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Call the Sheets API (path relative to /v4/spreadsheets/{id}) with retries on 429/5xx. */
export async function sheetsRequest<T>(
  path: string,
  init: { method?: string; body?: unknown; sheetId?: string } = {},
): Promise<T> {
  // `sheetId` lets us check a new spreadsheet before switching to it.
  const cfg = init.sheetId ? { ...getCredentials(), sheetId: init.sheetId } : getGoogleConfig();
  const url = `${cfg.apiBase}/v4/spreadsheets/${encodeURIComponent(cfg.sheetId)}${path}`;
  let lastError: AppError | null = null;

  for (let attempt = 0; attempt < 4; attempt++) {
    const token = await getAccessToken();
    let res: Response;
    try {
      res = await fetch(url, {
        method: init.method ?? "GET",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        cache: "no-store",
      });
    } catch {
      lastError = new AppError(503, "Could not reach Google Sheets. Check your internet connection.");
      await sleep(300 * 2 ** attempt);
      continue;
    }

    if (res.ok) return (await res.json()) as T;

    const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    const message = body.error?.message ?? "";
    if (res.status === 401) tokenCache = null;
    lastError = describeGoogleError(res.status, message);
    console.error("[sheets]", init.method ?? "GET", path.split("?")[0], res.status, message);

    const retryable = res.status === 429 || res.status >= 500 || (res.status === 401 && attempt === 0);
    if (!retryable) break;
    await sleep(400 * 2 ** attempt + Math.random() * 200);
  }
  throw lastError ?? new AppError(502, "Google Sheets request failed");
}
