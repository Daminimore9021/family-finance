/**
 * Connecting the app to a Google Sheet (and, on first run, saving the
 * service-account key) from inside the app instead of editing .env.local by hand.
 *
 * Persistence: values are written to .env.local in the project folder. This
 * works on a laptop (`npm run dev` / `npm start`). On Vercel the file system is
 * read-only, so there the values must be set in Project → Settings → Environment Variables.
 */
import { randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { AppError, badRequest } from "./errors";
import { getAccessToken, resetTokenCache, sheetsRequest } from "./google";
import { isVercel } from "./env";
import { resetSheetCaches } from "./sheets";
import { ensureAllTables, getSettings, resetSettingsCache, setSettings } from "./repo";

/* ------------------------------------------------------------------ */
/* .env.local                                                          */
/* ------------------------------------------------------------------ */

function envLine(key: string, value: string): string {
  // Multi-line values (the private key) are stored on one line with \n escapes.
  const escaped = value.replace(/\r/g, "").replace(/\n/g, "\\n");
  return /[\s#"'\\]/.test(escaped) ? `${key}="${escaped.replace(/"/g, '\\"')}"` : `${key}=${escaped}`;
}

/** Updates (or creates) .env.local and applies the values to the running server immediately. */
export async function saveLocalEnv(values: Record<string, string>): Promise<void> {
  if (isVercel()) {
    throw new AppError(400, "On Vercel, change these values in Project → Settings → Environment Variables, then redeploy.");
  }
  const file = path.join(process.cwd(), ".env.local");
  let content = "";
  try {
    content = await fs.readFile(file, "utf8");
  } catch {
    content = "# Created by Family Finance Tracker. Never share or commit this file.\n";
  }
  for (const [key, value] of Object.entries(values)) {
    const line = envLine(key, value);
    const pattern = new RegExp(`^${key}=.*$`, "m");
    content = pattern.test(content) ? content.replace(pattern, () => line) : `${content.replace(/\n?$/, "\n")}${line}\n`;
  }
  try {
    await fs.writeFile(file, content, "utf8");
  } catch {
    throw new AppError(500, "Could not write .env.local in the project folder. Check folder permissions.");
  }
  Object.assign(process.env, values);
}

/** Puts env vars back after a failed attempt (deleting ones that did not exist). */
function restoreEnv(values: Record<string, string | undefined>): void {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

export function ensureSessionSecretValues(): Record<string, string> {
  const secret = process.env.SESSION_SECRET;
  return secret && secret.length >= 32 ? {} : { SESSION_SECRET: randomBytes(32).toString("hex") };
}

/* ------------------------------------------------------------------ */
/* Service-account key upload (first run only)                         */
/* ------------------------------------------------------------------ */

export async function saveServiceAccountKey(jsonText: unknown): Promise<string> {
  if (typeof jsonText !== "string" || jsonText.length > 10_000) throw badRequest("Choose the .json key file you downloaded");
  let key: { type?: string; client_email?: string; private_key?: string };
  try {
    key = JSON.parse(jsonText);
  } catch {
    throw badRequest("That file is not valid JSON. Choose the service account key (.json) file.");
  }
  if (key.type !== "service_account" || !key.client_email || !key.private_key?.includes("PRIVATE KEY")) {
    throw badRequest("That JSON is not a service account key. In Google Cloud, create a key of type JSON for a service account.");
  }

  const previous = {
    GOOGLE_SERVICE_ACCOUNT_EMAIL: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    GOOGLE_PRIVATE_KEY: process.env.GOOGLE_PRIVATE_KEY,
  };
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = key.client_email;
  process.env.GOOGLE_PRIVATE_KEY = key.private_key;
  resetTokenCache();
  try {
    await getAccessToken(); // proves Google accepts the key before we save it
  } catch (err) {
    restoreEnv(previous);
    resetTokenCache();
    throw err;
  }
  await saveLocalEnv({
    GOOGLE_SERVICE_ACCOUNT_EMAIL: key.client_email,
    GOOGLE_PRIVATE_KEY: key.private_key,
    ...ensureSessionSecretValues(),
  });
  return key.client_email;
}

/* ------------------------------------------------------------------ */
/* Sheet connection                                                    */
/* ------------------------------------------------------------------ */

export async function getSheetTitle(sheetId: string): Promise<string> {
  const meta = await sheetsRequest<{ properties?: { title?: string } }>(`?fields=${encodeURIComponent("properties.title")}`, {
    sheetId,
  });
  return meta.properties?.title ?? "Untitled spreadsheet";
}

export type PinStatus = "none" | "copied" | "same" | "different";

/**
 * Checks access to the new spreadsheet, creates the Income / Transactions /
 * Settings tabs with headers, carries the current PIN over (if the new sheet
 * has none), and saves the sheet ID. Existing data in the new sheet is kept.
 */
export async function connectSheet(sheetId: string, currentPinHash: string | null) {
  const title = await getSheetTitle(sheetId); // throws a clear error if not shared / not found

  const previous = process.env.GOOGLE_SHEET_ID;
  const resetAll = () => {
    resetSheetCaches();
    resetSettingsCache();
  };
  process.env.GOOGLE_SHEET_ID = sheetId;
  resetAll();

  try {
    await ensureAllTables();
    const existing = (await getSettings(true)).pin_hash || null;
    let pinStatus: PinStatus;
    if (!existing) {
      if (currentPinHash) {
        await setSettings({ pin_hash: currentPinHash, failed_attempts: "0", locked_until: "" });
        pinStatus = "copied";
      } else {
        pinStatus = "none";
      }
    } else {
      pinStatus = existing === currentPinHash ? "same" : "different";
    }
    await saveLocalEnv({ GOOGLE_SHEET_ID: sheetId, ...ensureSessionSecretValues() });
    return { sheetId, title, pinStatus };
  } catch (err) {
    restoreEnv({ GOOGLE_SHEET_ID: previous });
    resetAll();
    throw err;
  }
}
