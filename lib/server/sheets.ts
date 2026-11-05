/**
 * Table-style access to Google Sheets tabs.
 *
 * - Columns are matched by header name, so re-ordering columns in the sheet
 *   (or adding your own extra columns) does not break the app.
 * - Records are identified by their ID column, never by row number. Row
 *   numbers are looked up fresh right before every update/delete and verified.
 * - Writes use valueInputOption=RAW so text is never interpreted as a formula
 *   and amounts are stored as real numbers.
 */
import { AppError } from "./errors";
import { sheetsRequest } from "./google";

export type Cell = string | number | boolean;
export type RawRecord = Record<string, Cell>;

export interface TableSchema {
  title: string;
  idColumn: string;
  headers: readonly string[];
}

export interface TableRow {
  rowNumber: number; // 1-based sheet row (header is row 1)
  record: RawRecord;
}

export interface Table {
  headers: string[];
  rows: TableRow[];
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

export function columnLetter(index: number): string {
  // 1 -> A, 26 -> Z, 27 -> AA
  let n = index;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function a1(title: string, range?: string): string {
  const quoted = `'${title.replace(/'/g, "''")}'`;
  return encodeURIComponent(range ? `${quoted}!${range}` : quoted);
}

/* ------------------------------------------------------------------ */
/* simple in-process write lock                                        */
/* ------------------------------------------------------------------ */

let lockChain: Promise<unknown> = Promise.resolve();

/**
 * Serialises read-modify-write operations inside one server instance so two
 * quick taps cannot create duplicates or delete the wrong row.
 */
export function withWriteLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = lockChain.then(fn, fn);
  lockChain = run.catch(() => undefined);
  return run;
}

/* ------------------------------------------------------------------ */
/* sheet metadata & schema                                             */
/* ------------------------------------------------------------------ */

let sheetIdCache: { at: number; ids: Map<string, number> } | null = null;
const ensuredTables = new Set<string>();

/** Forget cached tab IDs/headers — used after switching to a different spreadsheet. */
export function resetSheetCaches(): void {
  sheetIdCache = null;
  ensuredTables.clear();
}

async function getSheetIds(force = false): Promise<Map<string, number>> {
  if (!force && sheetIdCache && Date.now() - sheetIdCache.at < 5 * 60_000) return sheetIdCache.ids;
  const meta = await sheetsRequest<{ sheets?: { properties: { sheetId: number; title: string } }[] }>(
    `?fields=${encodeURIComponent("sheets.properties(sheetId,title)")}`,
  );
  const ids = new Map<string, number>();
  for (const s of meta.sheets ?? []) ids.set(s.properties.title, s.properties.sheetId);
  sheetIdCache = { at: Date.now(), ids };
  return ids;
}

async function getSheetId(title: string): Promise<number> {
  let ids = await getSheetIds();
  if (!ids.has(title)) ids = await getSheetIds(true);
  const id = ids.get(title);
  if (id === undefined) throw new AppError(500, `The "${title}" tab is missing from the spreadsheet.`);
  return id;
}

/** Creates the tab and header row if missing, and adds any missing header columns. */
export async function ensureTable(schema: TableSchema): Promise<void> {
  if (ensuredTables.has(schema.title)) return;

  let ids = await getSheetIds();
  if (!ids.has(schema.title)) ids = await getSheetIds(true);

  if (!ids.has(schema.title)) {
    try {
      const res = await sheetsRequest<{ replies: { addSheet: { properties: { sheetId: number } } }[] }>(":batchUpdate", {
        method: "POST",
        body: {
          requests: [
            {
              addSheet: {
                properties: { title: schema.title, gridProperties: { frozenRowCount: 1 } },
              },
            },
          ],
        },
      });
      const sheetId = res.replies[0].addSheet.properties.sheetId;
      // Bold header row — cosmetic, ignore failures.
      await sheetsRequest(":batchUpdate", {
        method: "POST",
        body: {
          requests: [
            {
              repeatCell: {
                range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
                cell: { userEnteredFormat: { textFormat: { bold: true } } },
                fields: "userEnteredFormat.textFormat.bold",
              },
            },
          ],
        },
      }).catch(() => undefined);
    } catch (err) {
      // Another request may have created it at the same moment.
      const refreshed = await getSheetIds(true);
      if (!refreshed.has(schema.title)) throw err;
    }
    await getSheetIds(true);
  }

  const headerRes = await sheetsRequest<{ values?: Cell[][] }>(`/values/${a1(schema.title, "1:1")}`);
  const existing = (headerRes.values?.[0] ?? []).map((h) => String(h).trim());
  const nonEmpty = existing.filter(Boolean);

  if (nonEmpty.length === 0) {
    await sheetsRequest(`/values/${a1(schema.title, `A1:${columnLetter(schema.headers.length)}1`)}?valueInputOption=RAW`, {
      method: "PUT",
      body: { values: [schema.headers] },
    });
  } else {
    const missing = schema.headers.filter((h) => !existing.includes(h));
    if (missing.length) {
      const start = existing.length + 1;
      const end = existing.length + missing.length;
      await sheetsRequest(
        `/values/${a1(schema.title, `${columnLetter(start)}1:${columnLetter(end)}1`)}?valueInputOption=RAW`,
        { method: "PUT", body: { values: [missing] } },
      );
    }
  }
  ensuredTables.add(schema.title);
}

/* ------------------------------------------------------------------ */
/* CRUD                                                                */
/* ------------------------------------------------------------------ */

export async function readTable(schema: TableSchema): Promise<Table> {
  await ensureTable(schema);
  const res = await sheetsRequest<{ values?: Cell[][] }>(
    `/values/${a1(schema.title)}?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER`,
  );
  const values = res.values ?? [];
  const headers = (values[0] ?? []).map((h) => String(h).trim());
  const rows: TableRow[] = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i] ?? [];
    const record: RawRecord = {};
    headers.forEach((h, j) => {
      if (h) record[h] = row[j] ?? "";
    });
    const id = String(record[schema.idColumn] ?? "").trim();
    if (!id) continue; // blank or hand-typed row without an ID
    rows.push({ rowNumber: i + 1, record });
  }
  return { headers, rows };
}

function toRow(headers: string[], record: RawRecord): Cell[] {
  return headers.map((h) => (h && record[h] !== undefined ? record[h] : ""));
}

export async function appendRecord(schema: TableSchema, headers: string[], record: RawRecord): Promise<void> {
  await sheetsRequest(
    `/values/${a1(schema.title, "A1")}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    { method: "POST", body: { values: [toRow(headers, record)] } },
  );
}

/** Re-reads a single row to confirm it still holds the expected ID before changing it. */
async function verifyRow(schema: TableSchema, headers: string[], rowNumber: number, id: string): Promise<void> {
  const idIndex = headers.indexOf(schema.idColumn);
  const col = columnLetter(idIndex + 1);
  const res = await sheetsRequest<{ values?: Cell[][] }>(
    `/values/${a1(schema.title, `${col}${rowNumber}:${col}${rowNumber}`)}?valueRenderOption=UNFORMATTED_VALUE`,
  );
  const found = String(res.values?.[0]?.[0] ?? "").trim();
  if (found !== id) {
    throw new AppError(409, "The spreadsheet changed while saving. Please refresh and try again.");
  }
}

export async function updateRecord(
  schema: TableSchema,
  headers: string[],
  row: TableRow,
  record: RawRecord,
): Promise<void> {
  const id = String(row.record[schema.idColumn]);
  await verifyRow(schema, headers, row.rowNumber, id);
  const merged = { ...row.record, ...record };
  const range = `A${row.rowNumber}:${columnLetter(headers.length)}${row.rowNumber}`;
  await sheetsRequest(`/values/${a1(schema.title, range)}?valueInputOption=RAW`, {
    method: "PUT",
    body: { values: [toRow(headers, merged)] },
  });
}

export async function deleteRecordRow(schema: TableSchema, headers: string[], row: TableRow): Promise<void> {
  const id = String(row.record[schema.idColumn]);
  await verifyRow(schema, headers, row.rowNumber, id);
  const sheetId = await getSheetId(schema.title);
  await sheetsRequest(":batchUpdate", {
    method: "POST",
    body: {
      requests: [
        {
          deleteDimension: {
            range: { sheetId, dimension: "ROWS", startIndex: row.rowNumber - 1, endIndex: row.rowNumber },
          },
        },
      ],
    },
  });
}

export function findRow(table: Table, schema: TableSchema, id: string): TableRow | undefined {
  return table.rows.find((r) => String(r.record[schema.idColumn]).trim() === id);
}
