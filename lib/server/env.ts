import { AppError } from "./errors";

export const CREDENTIAL_ENV = ["GOOGLE_SERVICE_ACCOUNT_EMAIL", "GOOGLE_PRIVATE_KEY"] as const;

export const REQUIRED_ENV = [
  "GOOGLE_SERVICE_ACCOUNT_EMAIL",
  "GOOGLE_PRIVATE_KEY",
  "GOOGLE_SHEET_ID",
  "SESSION_SECRET",
] as const;

/** True when running on Vercel, where the file system is read-only. */
export const isVercel = () => process.env.VERCEL === "1";

export function missingEnv(): string[] {
  const missing: string[] = REQUIRED_ENV.filter((name) => !process.env[name]?.trim());
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length < 32 && !missing.includes("SESSION_SECRET")) {
    missing.push("SESSION_SECRET (must be at least 32 characters)");
  }
  return missing;
}

export const hasCredentials = () => CREDENTIAL_ENV.every((name) => Boolean(process.env[name]?.trim()));
export const hasSheetId = () => Boolean(process.env.GOOGLE_SHEET_ID?.trim());

export function assertEnv(): void {
  const missing = missingEnv();
  if (missing.length) {
    throw new AppError(500, `Server is not configured. Missing environment variables: ${missing.join(", ")}`);
  }
}

/**
 * Accepts the private key exactly as copied from the service-account JSON,
 * with literal "\n" sequences, real newlines, or wrapped in quotes.
 */
export function getPrivateKey(): string {
  let key = (process.env.GOOGLE_PRIVATE_KEY ?? "").trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }
  key = key.replace(/\\n/g, "\n").replace(/\r/g, "");
  if (!key.includes("PRIVATE KEY")) {
    throw new AppError(
      500,
      "GOOGLE_PRIVATE_KEY looks invalid. Copy the full private_key value (including BEGIN/END lines) from the service account JSON file.",
    );
  }
  return key;
}

/** Service-account credentials only (no spreadsheet needed). */
export function getCredentials() {
  if (!hasCredentials()) {
    throw new AppError(500, "Google service account credentials are not configured yet.");
  }
  return {
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!.trim(),
    privateKey: getPrivateKey(),
    // Overrides exist only for automated testing against a local mock; leave unset.
    tokenUrl: process.env.GOOGLE_TOKEN_URL?.trim() || "https://oauth2.googleapis.com/token",
    apiBase: (process.env.SHEETS_API_BASE_URL?.trim() || "https://sheets.googleapis.com").replace(/\/$/, ""),
  };
}

export function getGoogleConfig() {
  assertEnv();
  return { ...getCredentials(), sheetId: process.env.GOOGLE_SHEET_ID!.trim() };
}

/** Pulls the spreadsheet ID out of a full Google Sheets URL (or accepts a bare ID). */
export function extractSheetId(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const value = input.trim();
  const fromUrl = /\/spreadsheets\/d\/([a-zA-Z0-9-_]{20,})/.exec(value);
  if (fromUrl) return fromUrl[1];
  return /^[a-zA-Z0-9-_]{20,}$/.test(value) ? value : null;
}

export const sheetUrl = (id: string) => `https://docs.google.com/spreadsheets/d/${id}/edit`;
