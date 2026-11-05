# Family Finance Tracker

A private, mobile-first web app to record **monthly income** and **money given to family** (Mummy, Papa, Brother), see what remains each month, browse full history, and export Excel/CSV reports.

- **Frontend:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Lucide icons · Recharts
- **Backend:** Next.js Route Handlers (serverless on Vercel)
- **Database:** Google Sheets (via the Sheets REST API and a service account, server-side only)
- **Auth:** 4-digit PIN, scrypt-hashed, HMAC-signed HTTP-only session cookie
- **Exports:** ExcelJS (`.xlsx`) and UTF-8 CSV

> **Setting it up for the first time?** Follow **[PENDING_SETUP_AND_DEPLOYMENT_GUIDE.md](PENDING_SETUP_AND_DEPLOYMENT_GUIDE.md)**. It's a plain-English, step-by-step checklist. This README is the developer reference.

---

## Quick start

```bash
npm install
npm run dev                     # http://localhost:3000
```

On a laptop, the first screen is **Connect Google Sheets**. Upload the service-account key (`.json`) and paste your sheet link; the app verifies both with Google and writes them to `.env.local`, generating `SESSION_SECRET` if needed. Then it asks you to create a 4-digit PIN. It creates the `Income`, `Transactions` and `Settings` tabs (with headers) if they are missing. You can also fill in `.env.local` by hand from `.env.example`.

To use a different sheet later, change `GOOGLE_SHEET_ID` in `.env.local` (or in the Vercel environment variables) and restart. If the configured sheet can't be opened (wrong ID, or not shared), the setup screen lets you paste the correct link without logging in, because no PIN-protected data is reachable at that point.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server with hot reload |
| `npm run build` | Production build (includes the TypeScript check) |
| `npm start` | Runs the production build locally |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Unit tests for calculations & validation (`tests/`) |

Requires **Node.js 20.9 or newer** (Node 22 LTS recommended; see `.nvmrc`).

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | ✅ | `client_email` from the service-account JSON key |
| `GOOGLE_PRIVATE_KEY` | ✅ | `private_key` from the same JSON. Literal `\n` sequences or real newlines both work; surrounding quotes are stripped |
| `GOOGLE_SHEET_ID` | ✅ | The ID in `https://docs.google.com/spreadsheets/d/<ID>/edit` |
| `SESSION_SECRET` | ✅ | Random string, **at least 32 characters**, used to sign session cookies |
| `GOOGLE_TOKEN_URL`, `SHEETS_API_BASE_URL` | ❌ | Testing-only overrides for pointing the app at a mock Google API. **Leave unset.** |

If anything is missing, the login screen lists the missing variables instead of failing silently. None of these variables are prefixed with `NEXT_PUBLIC_`, so they never reach the browser bundle.

---

## Project structure

```
app/
  (app)/                 Signed-in area (shared AppShell: sidebar + bottom nav)
    page.tsx             Dashboard
    income/page.tsx      Add / edit / delete monthly income + history
    payments/page.tsx    Add payment + filterable transaction list
    history/page.tsx     Year-wise and month-wise history
    reports/page.tsx     Excel / CSV exports
    settings/page.tsx    Change PIN, refresh data, logout
  login/page.tsx         PIN setup / login screen (PIN pad)
  api/
    auth/{setup,login,logout,change-pin,session}/route.ts
    income/route.ts                GET, POST
    income/[id]/route.ts           PUT, DELETE
    transactions/route.ts          GET, POST
    transactions/[id]/route.ts     PUT, DELETE
    export/route.ts                GET ?type=&format=
  layout.tsx, globals.css, icon.svg, manifest.ts
components/              UI (forms, lists, charts, modal, toast, PIN pad, data provider)
lib/
  constants.ts           Recipients, months, limits
  types.ts               Shared TypeScript types
  calculations.ts        All business logic (pure functions, unit-tested)
  validation.ts          Input validation shared by client and server
  format.ts              ₹ formatting (Indian grouping), dates
  session.ts             HMAC-signed session tokens (Web Crypto)
  api-client.ts          Browser fetch helpers
  server/
    env.ts               Env var checks & private-key normalisation
    google.ts            Service-account JWT → OAuth token, Sheets REST calls with retries
    sheets.ts            Header-mapped table CRUD, write lock, row verification
    repo.ts              Income / Transactions / Settings repositories
    auth.ts              PIN hashing (scrypt), lockout, session cookies
    http.ts              Route wrapper (env check, auth, JSON errors)
    export.ts            Report builder, CSV + XLSX writers
proxy.ts                 Next.js 16 proxy (formerly "middleware"): auth gate + CSRF check
tests/                   Unit tests (node:test via tsx)
```

---

## Data model (Google Sheets)

**Income** — one row per month (duplicates for the same month & year are rejected)

| income_id | month | year | amount | description | created_at | updated_at |
|---|---|---|---|---|---|---|
| `inc_…` | 1–12 | 2026 | 50000 | text | ISO timestamp | ISO timestamp |

**Transactions**

| transaction_id | date | recipient | amount | description | reason | notes | created_at | updated_at |
|---|---|---|---|---|---|---|---|---|
| `txn_…` | `YYYY-MM-DD` | Mummy / Papa / Brother | 2500 | text | text | text | ISO | ISO |

**Settings** (key/value, created automatically). It holds `pin_hash`, `failed_attempts` and `locked_until`. The spec asked for two data tabs; this third tab exists because Vercel has no persistent disk and the PIN hash has to live somewhere you control.

Design notes:
- **Columns are matched by header name**, so you can reorder columns or add your own extra columns in the sheet.
- **Records are found by ID, never by row number.** Before every update or delete, the row is looked up fresh and its ID re-read to make sure it still matches. If it doesn't, the request fails with "please refresh".
- Writes use `valueInputOption=RAW`. Amounts are stored as real numbers, dates as `YYYY-MM-DD` text, and text starting with `=` is never treated as a formula.
- The parser accepts rows typed by hand: serial dates, `DD/MM/YYYY`, `1,500`, lowercase or alias names (`mother`, `bhai`, …). Rows without an ID are ignored.
- Read-modify-write operations are serialised with an in-process lock, which prevents duplicate income and wrong-row deletes from double taps. Across serverless instances, the ID verification above is the safety net.
- Google `429`/`5xx` errors are retried with exponential backoff. `403`/`404`/credential errors return clear, actionable messages.

---

## Business logic

All figures come from `lib/calculations.ts` and are computed from live sheet data:

```
Monthly Income        = income record for the selected month & year (0 if none)
<Person> Total        = sum of that person's payments dated in the selected month & year
Total Family Payments = Mummy + Papa + Brother
Remaining Balance     = Monthly Income − Total Family Payments   (may be negative → warning)
```

Sums are done in integer paise to avoid floating-point drift. Payments larger than income are allowed. After every add, edit or delete, the client re-fetches from Google Sheets, so all figures are recalculated from the source of truth.

---

## API

All endpoints return `{ "data": … }` on success or `{ "error": "message", "fields": { … } }` on failure. Everything except `auth/setup`, `auth/login`, `auth/session` and `auth/logout` requires a valid session cookie.

| Method | Path | Notes |
|---|---|---|
| GET | `/api/auth/session` | `{ configured, authenticated, missingEnv?, error? }` |
| POST | `/api/auth/setup` | `{ pin, confirmPin }`. Only works while no PIN exists |
| POST | `/api/auth/login` | `{ pin }`. Locks for 5 minutes after 5 wrong attempts |
| POST | `/api/auth/logout` | Clears the cookie |
| POST | `/api/auth/change-pin` | `{ currentPin, newPin, confirmPin }`. Signs out other devices |
| GET | `/api/income?year=` | Newest first |
| POST | `/api/income` | `{ month, year, amount, description? }`. 409 if the month already exists |
| PUT / DELETE | `/api/income/:id` | |
| GET | `/api/transactions?year=&month=&recipient=&q=&sort=` | `sort`: `date_desc` · `date_asc` · `amount_desc` · `amount_asc` |
| POST | `/api/transactions` | `{ recipient, amount, date, description?, reason?, notes? }` |
| PUT / DELETE | `/api/transactions/:id` | |
| GET | `/api/export?type=month|year|income|full&format=xlsx|csv&year=&month=` | File download |
| POST | `/api/sheet/connect` | `{ url }`. Verifies access, creates tabs/headers, saves `GOOGLE_SHEET_ID` to `.env.local`. Login required, except during first-run setup or when the configured sheet can't be opened. Not available on Vercel |
| POST | `/api/setup/credentials` | `{ keyJson }`. First run only: verifies the service-account key with Google, then saves it to `.env.local`. Not available on Vercel |

---

## Security

- The PIN is hashed with **scrypt** (random 16-byte salt) and never stored in plain text.
- Sessions are `HttpOnly`, `SameSite=Lax` and `Secure` (in production) cookies, signed with HMAC-SHA256 using `SESSION_SECRET`, and valid for 7 days. Each token embeds a fingerprint of the current PIN hash, so changing the PIN invalidates every other session.
- `proxy.ts` blocks unauthenticated page/API access and cross-origin state-changing requests (CSRF). Every API route also performs the full server-side check.
- Brute-force protection: 5 wrong PINs lock login for 5 minutes. The counter is stored in the sheet, so it works across serverless instances.
- Google credentials are only read in server code (`lib/server/*`). Security headers include `X-Frame-Options: DENY`, `nosniff` and a strict referrer policy.
- CSV exports escape cells beginning with `= + - @` to prevent spreadsheet formula injection.
- **First-run note:** until a PIN is created, anyone who opens the URL can create it. Set your PIN right after your first deploy.

---

## Testing

- `npm test` runs the unit tests for monthly/yearly/all-time calculations, month isolation, negative balances, paise rounding, filters and validation.
- During development, the full API (auth, PIN lockout, CRUD, duplicate prevention, concurrency, hand-typed rows, Google 403 handling, every CSV/XLSX export) was tested end-to-end against a mock of the Google token + Sheets REST endpoints, plus manual UI checks at 360 / 375 / 390 / 430 px and desktop.

## Deployment

Vercel needs no special config: import the repo, add the 4 environment variables, and deploy. See the guide for click-by-click steps.
