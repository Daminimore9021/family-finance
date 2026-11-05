import { NextResponse, type NextRequest } from "next/server";
import { clearSession, getPinHash, issueSession, requireAuth } from "@/lib/server/auth";
import { connectSheet } from "@/lib/server/connection";
import { extractSheetId, hasCredentials, hasSheetId, isVercel, sheetUrl } from "@/lib/server/env";
import { AppError, badRequest } from "@/lib/server/errors";
import { errorResponse, readJson } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/**
 * POST /api/sheet/connect { url }
 * - First run (no sheet configured yet): allowed without login.
 * - Afterwards: requires login; switches the app to another spreadsheet.
 */
export async function POST(req: NextRequest) {
  try {
    if (isVercel()) {
      throw new AppError(
        400,
        "On Vercel the sheet is set with the GOOGLE_SHEET_ID environment variable (Project → Settings → Environment Variables), then redeploy.",
      );
    }
    if (!hasCredentials()) throw badRequest("Upload the service account key first.");

    // Setup mode: no sheet yet, or the configured sheet can't be opened (wrong link / not shared).
    // In that case nothing is protected by a PIN yet, so a new link may be entered without login.
    let firstRun = !hasSheetId();
    if (!firstRun) {
      try {
        await getPinHash(true);
      } catch (err) {
        if (!(err instanceof AppError)) throw err;
        firstRun = true;
      }
    }
    if (!firstRun) await requireAuth(req);

    const body = await readJson(req);
    const sheetId = extractSheetId(body.url);
    if (!sheetId) throw badRequest("Paste the full Google Sheet link (it contains /spreadsheets/d/…)", { url: "Invalid sheet link" });
    if (!firstRun && sheetId === process.env.GOOGLE_SHEET_ID?.trim()) {
      throw badRequest("The app is already using this sheet.", { url: "Already connected" });
    }

    const currentPin = firstRun ? null : await getPinHash(true);
    const result = await connectSheet(sheetId, currentPin);

    const res = NextResponse.json(
      { data: { ...result, sheetUrl: sheetUrl(sheetId), requiresLogin: result.pinStatus === "different" } },
      { headers: { "Cache-Control": "no-store" } },
    );
    if (result.pinStatus === "different") clearSession(res); // new sheet has its own PIN
    else if (currentPin && (result.pinStatus === "copied" || result.pinStatus === "same")) await issueSession(res, currentPin);
    return res;
  } catch (err) {
    return errorResponse(err);
  }
}
