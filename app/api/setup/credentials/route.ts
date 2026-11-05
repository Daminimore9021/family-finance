import type { NextRequest } from "next/server";
import { saveServiceAccountKey } from "@/lib/server/connection";
import { hasCredentials, isVercel } from "@/lib/server/env";
import { AppError } from "@/lib/server/errors";
import { errorResponse, ok, readJson } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/**
 * POST /api/setup/credentials { keyJson }
 * First-run only (no credentials configured yet) and only on a laptop.
 * Verifies the service-account key with Google, then saves it to .env.local.
 */
export async function POST(req: NextRequest) {
  try {
    if (isVercel()) throw new AppError(400, "On Vercel, add the key as environment variables instead.");
    if (hasCredentials()) throw new AppError(409, "A service account key is already configured.");
    const body = await readJson(req);
    const email = await saveServiceAccountKey(body.keyJson);
    return ok({ serviceAccountEmail: email });
  } catch (err) {
    return errorResponse(err);
  }
}
