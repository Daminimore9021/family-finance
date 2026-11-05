import { NextResponse } from "next/server";
import { clearSession } from "@/lib/server/auth";

export async function POST() {
  const res = NextResponse.json({ data: { ok: true } }, { headers: { "Cache-Control": "no-store" } });
  clearSession(res);
  return res;
}
