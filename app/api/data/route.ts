import { ok, route } from "@/lib/server/http";
import { listEverything } from "@/lib/server/repo";

export const dynamic = "force-dynamic";

/** GET /api/data — income, payments and dues together (one Google Sheets read). */
export const GET = route(async () => ok(await listEverything()));
