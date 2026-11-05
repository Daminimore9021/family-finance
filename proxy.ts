import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

/**
 * Optimistic auth gate. Checks the signed session cookie before any page or
 * private API route runs. Every API route also performs a full check
 * (including the PIN version) on the server, so this is defence in depth.
 */
// Setup endpoints enforce their own rules (first run only, or login required).
const PUBLIC_API = new Set([
  "/api/auth/login",
  "/api/auth/setup",
  "/api/auth/session",
  "/api/auth/logout",
  "/api/sheet/connect",
  "/api/setup/credentials",
]);

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith("/api/");

  // Basic CSRF protection: reject cross-site state-changing requests.
  if (isApi && !["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.headers.get("origin");
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    if (origin) {
      let originHost = "";
      try {
        originHost = new URL(origin).host;
      } catch {
        originHost = "";
      }
      if (originHost !== host) {
        return NextResponse.json({ error: "Cross-site request blocked" }, { status: 403 });
      }
    }
  }

  if (isApi && PUBLIC_API.has(pathname)) return NextResponse.next();

  // The login page does its own full check (signature + current PIN) and
  // forwards signed-in users to the dashboard, so it is always reachable here.
  if (pathname === "/login") return NextResponse.next();

  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value).catch(() => null);

  if (!session) {
    if (isApi) return NextResponse.json({ error: "Please log in again" }, { status: 401 });
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|robots.txt).*)"],
};
