import { NextResponse, type NextRequest } from "next/server";
import { hasCredentials, hasSheetId, isVercel, missingEnv } from "@/lib/server/env";
import { getPinHash, isAuthenticated } from "@/lib/server/auth";
import { AppError } from "@/lib/server/errors";
import type { SessionInfo } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Public: tells the login screen whether to show setup, login, or a config screen. */
export async function GET(req: NextRequest) {
  const headers = { "Cache-Control": "no-store" };
  const base: Pick<SessionInfo, "canConfigure" | "needsCredentials" | "needsSheet" | "serviceAccountEmail"> = {
    canConfigure: !isVercel(),
    needsCredentials: !hasCredentials(),
    needsSheet: !hasSheetId(),
    serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() || undefined,
  };

  const missing = missingEnv();
  if (missing.length) {
    const body: SessionInfo = { configured: false, authenticated: false, missingEnv: missing, ...base };
    return NextResponse.json({ data: body }, { headers });
  }
  try {
    const configured = Boolean(await getPinHash(true));
    const authenticated = configured && (await isAuthenticated(req));
    const body: SessionInfo = { configured, authenticated, ...base };
    return NextResponse.json({ data: body }, { headers });
  } catch (err) {
    const message = err instanceof AppError ? err.message : "Could not connect to Google Sheets.";
    // A wrong or unshared sheet can be fixed from the setup screen by pasting the link again.
    const sheetProblem = /spreadsheet|share|not found|permission/i.test(message);
    const body: SessionInfo = {
      configured: false,
      authenticated: false,
      error: message,
      ...base,
      needsSheet: base.needsSheet || sheetProblem,
    };
    return NextResponse.json({ data: body }, { headers });
  }
}
