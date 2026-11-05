import { route } from "@/lib/server/http";
import { listIncome, listTransactions } from "@/lib/server/repo";
import { badRequest } from "@/lib/server/errors";
import { buildReport, toCsv, toXlsx, type ExportFormat, type ExportType } from "@/lib/server/export";
import { MAX_YEAR, MIN_YEAR } from "@/lib/constants";

export const dynamic = "force-dynamic";

const TYPES: ExportType[] = ["month", "year", "income", "full"];
const FORMATS: ExportFormat[] = ["csv", "xlsx"];

/** GET /api/export?type=month|year|income|full&format=csv|xlsx&year=2026&month=11 */
export const GET = route(async (req) => {
  const p = req.nextUrl.searchParams;
  const type = p.get("type") as ExportType;
  const format = p.get("format") as ExportFormat;
  if (!TYPES.includes(type)) throw badRequest("Invalid export type");
  if (!FORMATS.includes(format)) throw badRequest("Invalid export format");

  const now = new Date();
  const year = Number(p.get("year") ?? now.getFullYear());
  const month = Number(p.get("month") ?? now.getMonth() + 1);
  if (!Number.isInteger(year) || year < MIN_YEAR || year > MAX_YEAR) throw badRequest("Invalid year");
  if (!Number.isInteger(month) || month < 1 || month > 12) throw badRequest("Invalid month");

  const [incomes, transactions] = await Promise.all([listIncome(), listTransactions()]);
  const report = buildReport(type, incomes, transactions, year, month);

  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  if (format === "csv") {
    headers["Content-Type"] = "text/csv; charset=utf-8";
    headers["Content-Disposition"] = `attachment; filename="${report.filename}.csv"`;
    return new Response(toCsv(report), { headers });
  }
  headers["Content-Type"] = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  headers["Content-Disposition"] = `attachment; filename="${report.filename}.xlsx"`;
  return new Response(await toXlsx(report), { headers });
});
