# Pending Setup & Deployment Guide

This guide lists **everything you still need to do by hand** to get your Family Finance Tracker running, first on your laptop and then online with Vercel.

Work from top to bottom and tick each box ☐ → ☑ as you go. Plan on 30–45 minutes the first time.

> **Tip:** Keep a plain text file (e.g. `my-setup-notes.txt`, **outside** the project folder) to temporarily paste values you will need later: service account email, Sheet ID, and so on. Delete it when you're done.

---

## ✅ Part A — Already done in code (no action needed)

The application itself is fully built. You **don't** need to write or change any code.

| Feature | Status |
|---|---|
| Dashboard (income, given to family, remaining balance, transactions, charts, recent payments) | ✅ Done |
| Add / edit / delete monthly income, with duplicate-month protection | ✅ Done |
| Add / edit / delete family payments (Mummy, Papa, Brother) with filters, search and sort | ✅ Done |
| History page (year-wise and month-wise, person-wise totals, yearly balance) | ✅ Done |
| Reports & Export (Excel `.xlsx` and `.csv` for month, year, income and full report) | ✅ Done |
| 4-digit PIN login, first-time PIN setup, change PIN, logout, lockout after 5 wrong tries | ✅ Done |
| Google Sheets as the database (creates tabs and headers automatically) | ✅ Done |
| Mobile-first design with bottom navigation; desktop sidebar | ✅ Done |
| Production build passes, automated tests pass | ✅ Done |

## ☐ Part B — What YOU need to do (summary)

- [ ] **1.** Set up Google Cloud: create a project, enable the Sheets API, create a service account and download its key
- [ ] **2.** Create the Google Sheet and share it with the service account
- [ ] **3.** Set up the project on your laptop and run it
- [ ] **4.** Create your 4-digit PIN
- [ ] **5.** Deploy to Vercel
- [ ] **6.** Double-check the environment variables
- [ ] **7.** Run through the final testing checklist

Each step is explained in detail below.

---

## 1. Google Cloud Setup

Google Cloud is where you create a **"robot" account (a *service account*)** that your app uses to read and write your Google Sheet. It's free for this use.

### 1.1 Create a Google Cloud project

- [ ] Go to **https://console.cloud.google.com/** and sign in with your Google account.
- [ ] If asked, accept the Terms of Service (choose your country).
- [ ] At the top-left, click the **project selector** (it may say "Select a project").
- [ ] Click **NEW PROJECT**.
- [ ] Project name: `family-finance` (any name is fine). Leave "Location" as is.
- [ ] Click **CREATE** and wait about 30 seconds.
- [ ] Make sure the new project is selected in the project selector at the top.

```
┌──────────────────────────────────────────────────────────┐
│ ☰  Google Cloud   [ family-finance ▾ ]   🔍 Search        │  ← project selector
└──────────────────────────────────────────────────────────┘
```

### 1.2 Enable the Google Sheets API

- [ ] In the top search bar, type **Google Sheets API** and click the result (under "Marketplace" / "APIs").
- [ ] Click the blue **ENABLE** button.
- [ ] Wait until the page shows "API enabled" or a "MANAGE" button.

> You do **not** need to enable the Google Drive API.

### 1.3 Create a Service Account

- [ ] Open the menu ☰ → **IAM & Admin** → **Service Accounts**.
      (Or search "Service Accounts" in the top bar.)
- [ ] Click **+ CREATE SERVICE ACCOUNT**.
- [ ] Service account name: `family-finance-app`
- [ ] Click **CREATE AND CONTINUE**.
- [ ] "Grant this service account access to project" → **skip it** (leave empty) and click **CONTINUE**.
- [ ] Click **DONE**.

### 1.4 Generate and download the JSON key

- [ ] In the Service Accounts list, click the account you just created.
- [ ] Open the **KEYS** tab.
- [ ] Click **ADD KEY** → **Create new key**.
- [ ] Choose **JSON** and click **CREATE**.
- [ ] A `.json` file downloads automatically (e.g. `family-finance-123456-ab12cd34ef56.json`).

> ⚠️ **This file is a password.** Keep it private. Don't email it, don't upload it to GitHub, and don't put it inside the project folder. You only need two values from it (next step).

> If you see the error *"Service account key creation is disabled"*, your Google account belongs to an organisation that blocks keys. Use a personal Gmail account instead.

### 1.5 Find the Service Account email and private key

Open the downloaded JSON file with Notepad (Windows) or TextEdit (Mac). It looks like this (shortened):

```json
{
  "type": "service_account",
  "project_id": "family-finance-123456",
  "private_key_id": "ab12cd34…",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkq…\n-----END PRIVATE KEY-----\n",
  "client_email": "family-finance-app@family-finance-123456.iam.gserviceaccount.com",
  …
}
```

- [ ] Copy the value of **`client_email`** → this is your **service account email** (`GOOGLE_SERVICE_ACCOUNT_EMAIL`).
- [ ] Copy the value of **`private_key`** → everything between the quotes, starting with `-----BEGIN PRIVATE KEY-----` and ending with `-----END PRIVATE KEY-----\n` (`GOOGLE_PRIVATE_KEY`).

> You can also see the service account email any time in **IAM & Admin → Service Accounts**, in the "Email" column.

---

## 2. Google Sheets Setup

### 2.1 Create a new spreadsheet

- [ ] Go to **https://sheets.google.com** and click **Blank spreadsheet** (the big ➕).
- [ ] Click "Untitled spreadsheet" at the top-left and rename it, e.g. **Family Finance Data**.

### 2.2 Create the Income and Transactions tabs

> **Shortcut:** the app creates these tabs and their headers **automatically** the first time you open it (when you create your PIN). You can skip 2.2 and 2.3 if you like; doing them by hand is optional.

If you want to create them yourself:

- [ ] At the bottom, right-click **Sheet1** → **Rename** → type `Income`.
- [ ] Click the **➕** at the bottom-left to add a sheet, rename it `Transactions`.

Names must match exactly: `Income` and `Transactions` (capital first letter, no spaces).

### 2.3 Add the column headers (optional, see shortcut above)

In row 1 of each tab, type one header per cell, starting at column A:

**Income tab** (A1 → G1):

```
income_id | month | year | amount | description | created_at | updated_at
```

**Transactions tab** (A1 → I1):

```
transaction_id | date | recipient | amount | description | reason | notes | created_at | updated_at
```

> The app also adds a third tab called **`Settings`** automatically. It stores your **encrypted PIN** (a hash, not the actual digits) and login-lockout information. **Don't delete it.**

### 2.4 Share the spreadsheet with the Service Account email

This is the step people most often forget.

- [ ] In your spreadsheet, click the green **Share** button (top-right).
- [ ] In "Add people and groups", paste the **service account email** from step 1.5
      (looks like `family-finance-app@family-finance-123456.iam.gserviceaccount.com`).
- [ ] Set the role to **Editor**.
- [ ] **Untick** "Notify people" (the robot has no inbox).
- [ ] Click **Share** (or **Send**). If Google warns that the address is outside your organisation, click **Share anyway**.

### 2.5 Get the Spreadsheet ID

Look at your browser's address bar while the sheet is open:

```
https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcdEFG/edit#gid=0
                                       └──────────────── Spreadsheet ID ────────────────┘
```

- [ ] Copy the long part **between `/d/` and `/edit`**. That's your `GOOGLE_SHEET_ID`.

---

## 3. Local Laptop Setup

### 3.1 Extract the project ZIP

- [ ] Right-click the ZIP → **Extract All…** (Windows) or double-click it (Mac).
- [ ] Put the extracted folder somewhere simple, e.g. `Documents\family-finance-tracker`.
      Avoid folders synced by OneDrive/Dropbox if possible (they can slow down `npm install`).

### 3.2 Install Node.js (if needed)

- [ ] Open a terminal: **Windows:** press Start, type `PowerShell`, open it. **Mac:** open **Terminal**.
- [ ] Check whether Node.js is installed:

```bash
node -v
```

- [ ] If you see `v20.9.0` or higher (e.g. `v22.x.x`), you're fine. Otherwise download the **LTS** version from **https://nodejs.org**, install it with the default options, then **close and reopen** the terminal and run `node -v` again.

### 3.3 Open the project in VS Code

- [ ] Install VS Code from **https://code.visualstudio.com** if you don't have it.
- [ ] Open VS Code → **File → Open Folder…** → select the extracted project folder.
- [ ] Open the built-in terminal: **View → Terminal** (or press <kbd>Ctrl</kbd>+<kbd>`</kbd>).
      The terminal is already inside the project folder.

### 3.4 Install dependencies

```bash
npm install
```

- [ ] Wait until it finishes (1–3 minutes). Warnings (`npm warn …`) are normal. Only red `ERR!` lines are a problem.

### 3.5 Connect Google from inside the app (easiest)

You don't have to edit any file. Just start the app:

```bash
npm run dev
```

- [ ] Open **http://localhost:3000**. You'll see **"Connect Google Sheets"** with two steps:
  1. **Upload your service account key.** Click **Choose key file (.json)** and pick the JSON file from step 1.4. The app checks it with Google, then shows the service account email with a **Copy** button.
  2. **Connect your Google Sheet.** Share your sheet with that email as **Editor** (step 2.4), paste the sheet link from your browser's address bar, and click **Connect sheet**.
- [ ] The app creates the `Income`, `Transactions` and `Settings` tabs with the right columns, then shows **"Create your PIN"**.

Behind the scenes, the app saves everything into a file called `.env.local` in the project folder, including a random `SESSION_SECRET`. Keep that file private.

> **To use a different sheet later:** change the `GOOGLE_SHEET_ID` line in `.env.local` to the new sheet's ID, then restart `npm run dev`. If the new sheet can't be opened, the setup screen lets you paste the correct link.
>
> This in-app setup works on your laptop. On **Vercel**, the values are set as environment variables instead (section 5.4).

If you prefer, you can still fill in `.env.local` by hand instead (3.5b), then skip to 3.7.

### 3.5b Fill in `.env.local` by hand (alternative)

- [ ] Make a copy of `.env.example` named `.env.local`:

**Windows (PowerShell):**

```bash
copy .env.example .env.local
```

**Mac / Linux:**

```bash
cp .env.example .env.local
```

- [ ] Generate a session secret (copy the output):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

- [ ] Open `.env.local` in VS Code and fill it in. It should look like this (with **your** values):

```env
GOOGLE_SERVICE_ACCOUNT_EMAIL=family-finance-app@family-finance-123456.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkq...lots of characters...\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEET_ID=1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcdEFG
SESSION_SECRET=3f9c1e...64 random characters...a7b2
```

Rules for `GOOGLE_PRIVATE_KEY`:
- Keep it on **one line** with the `\n` characters exactly as they appear in the JSON file.
- Wrap it in **double quotes** `"…"`.

- [ ] Save the file (<kbd>Ctrl</kbd>+<kbd>S</kbd>).

### 3.6 Start the app

```bash
npm run dev
```

- [ ] Wait for `✓ Ready`, then open **http://localhost:3000** in your browser.

### 3.7 Verify that it works

- [ ] You see the **"Create your PIN"** screen. ✅ The app can talk to Google Sheets.
- [ ] If you see **"Connect Google Sheets"**, finish the two steps from 3.5. If step 2 shows a red message (sheet not found, or not shared), share the sheet with the email shown and paste the link again.
- [ ] If you see **"Setup needed"**, the screen lists exactly which variable is missing or what went wrong. See [Troubleshooting](#8-troubleshooting).
- [ ] After creating your PIN (next section), open your Google Sheet: the `Income`, `Transactions` and `Settings` tabs should now exist with headers.
- [ ] Add a test payment in the app and check that a new row appears in the `Transactions` tab.

To stop the app, click the terminal and press <kbd>Ctrl</kbd>+<kbd>C</kbd>.

> **Optional, to check everything is healthy:** run `npm test` (unit tests) and `npm run build` (production build). Both should finish without errors.

---

## 4. PIN Configuration

### 4.1 First-time PIN creation

- [ ] Open the app. You'll see **"Create your PIN"**.
- [ ] Tap 4 digits on the keypad, then enter the **same 4 digits again** to confirm.
- [ ] You're taken to the Dashboard and stay signed in on that device for 7 days.

> ⚠️ **Do this right after your first deployment.** Until a PIN exists, anyone who opens your app's URL could create one.

### 4.2 Logging in

- Open the app and enter your 4 digits.
- After **5 wrong attempts**, login is locked for **5 minutes**. That protects you if someone else guesses.
- You stay logged in for 7 days per device, until you tap **Logout** (Settings, or the sidebar on desktop).

### 4.3 Changing the PIN

- [ ] Go to **Settings → Change PIN**.
- [ ] Enter your current PIN, then the new PIN twice, and tap **Update PIN**.
- Every **other** device (e.g. your laptop if you changed it on your phone) is signed out automatically.

### 4.4 Forgot your PIN?

Nobody, including you, can read the PIN back (it's stored as a one-way hash). To reset it:

1. Open your Google Sheet and go to the **`Settings`** tab.
2. Find the row where column A is **`pin_hash`**.
3. Right-click the row number → **Delete row**.
4. Open the app (refresh the page). It shows **"Create your PIN"** again. Choose a new PIN.

Your income and payment data are **not affected**.

**Locked out after too many attempts and can't wait 5 minutes?** In the `Settings` tab, clear the value next to `locked_until` (select the cell in column B → press Delete).

---

## 5. Vercel Deployment

Vercel hosts the app online for free (Hobby plan), so you can use it on your phone from anywhere.

### 5.1 Put the code on GitHub

Vercel deploys from a GitHub repository.

- [ ] Create a free account at **https://github.com** if you don't have one.
- [ ] Click **➕ → New repository**. Name: `family-finance-tracker`. Choose **Private**. **Don't** tick "Add a README". Click **Create repository**.
- [ ] Upload the code. Pick **one** of these options:

**Option A, GitHub Desktop (easiest):** install **https://desktop.github.com**, then **File → Add local repository** → choose the project folder → "create a repository" → **Publish repository** (keep "Keep this code private" ticked).

**Option B, terminal** (needs Git from **https://git-scm.com**), run inside the project folder:

```bash
git init
```

```bash
git add .
```

```bash
git commit -m "Initial commit"
```

```bash
git branch -M main
```

```bash
git remote add origin https://github.com/YOUR-USERNAME/family-finance-tracker.git
```

```bash
git push -u origin main
```

- [ ] On GitHub, confirm that **`.env.local` is NOT in the file list**. (The project's `.gitignore` excludes it. Your secrets must never be on GitHub.)

> **Don't use GitHub's "Upload files" web page**: it ignores `.gitignore`, so it could upload `.env.local` or `node_modules`.

### 5.2 Create or sign in to Vercel

- [ ] Go to **https://vercel.com/signup** and choose **Continue with GitHub** (the Hobby plan is free).

### 5.3 Import the GitHub repository

- [ ] On the Vercel dashboard, click **Add New… → Project**.
- [ ] Find `family-finance-tracker` in the list and click **Import**.
      (If you don't see it, click **Adjust GitHub App Permissions** and allow access to that repository.)
- [ ] Framework Preset: **Next.js** (detected automatically). Leave Build Command, Output Directory and Install Command as they are.

### 5.4 Configure the environment variables

Before clicking Deploy, expand **Environment Variables** and add these 4 (Key → Value):

| Key | Value |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | the `client_email` |
| `GOOGLE_PRIVATE_KEY` | the `private_key`. Paste it **exactly as in `.env.local`** (with `\n`). The surrounding quotes are optional on Vercel |
| `GOOGLE_SHEET_ID` | your Spreadsheet ID |
| `SESSION_SECRET` | a long random string (you can reuse the one from `.env.local`, or generate a new one) |

> **Tip:** Vercel lets you paste your whole `.env.local` content at once into the first "Key" box. It splits it into variables automatically.

### 5.5 Deploy

- [ ] Click **Deploy** and wait 1–2 minutes until you see "Congratulations!".

### 5.6 Verify the live URL

- [ ] Click **Continue to Dashboard → Visit**. Your URL looks like `https://family-finance-tracker-xxxx.vercel.app`.
- [ ] You should see **Create your PIN** (or **Welcome back** if you already created one locally with the same Google Sheet. The PIN is shared, because it's stored in the sheet).
- [ ] **Create your PIN immediately.**
- [ ] On your phone, open the URL and use **Share → Add to Home Screen** (iPhone Safari) or **⋮ → Add to Home screen** (Android Chrome) for an app-like icon.

### 5.7 Updating the app later

Every time you push changes to the `main` branch on GitHub, Vercel redeploys automatically. If you change an environment variable on Vercel, go to **Deployments → ⋯ → Redeploy** for it to take effect.

---

## 6. Environment Variables

The app needs exactly **4** variables. They're the same locally and on Vercel.

| Variable | What it is | Where to get it | Example format |
|---|---|---|---|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | The robot account's email | JSON key → `client_email` (or Cloud Console → IAM & Admin → Service Accounts) | `name@project-id.iam.gserviceaccount.com` |
| `GOOGLE_PRIVATE_KEY` | The robot account's password | JSON key → `private_key` | `"-----BEGIN PRIVATE KEY-----\n…\n-----END PRIVATE KEY-----\n"` |
| `GOOGLE_SHEET_ID` | Which spreadsheet to use | Your sheet's URL, between `/d/` and `/edit` | `1AbC…xyz` (about 44 characters) |
| `SESSION_SECRET` | Signs your login cookie | Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` | 64 hex characters (minimum 32 characters) |

**Locally:** put them in `.env.local` in the project root (step 3.5), then restart `npm run dev` after any change.

**On Vercel:** Project → **Settings → Environment Variables**. Tick all environments (Production, Preview, Development). **Redeploy** after any change.

**Moving to another laptop:** copy the project (without `node_modules`), run `npm install`, and either copy your `.env.local` over through a private method (USB drive, password manager) **or** create a new one from `.env.example` with the same 4 values.

> 🔒 **Never** share these values, commit them to GitHub, or paste them in chats. The ZIP you received contains **no real secrets**, only `.env.example` with blanks.
> If you change `SESSION_SECRET`, everyone is simply logged out. Your PIN and data stay the same.

---

## 7. Final Testing Checklist

Do these on your **phone** using the live Vercel URL:

- [ ] **PIN login works.** Log out (Settings → Logout) and log back in. A wrong PIN shows "Incorrect PIN. X attempts left."
- [ ] **Monthly income can be added and edited.** Add income for the current month on **Income**. Try adding the same month again: you're told it already exists. Edit it with the ✏️ pencil.
- [ ] **Family payments can be added, edited and deleted.** On **Pay**, add a payment for each of Mummy, Papa and Brother. Edit one (✏️), then delete one (🗑, confirm).
- [ ] **Dashboard calculations are correct.** Check that *Remaining = Income − Given to family*, and that the per-person totals match your payments. Add a payment bigger than the remaining amount: the balance turns red and negative, with a warning.
- [ ] **Month switching works.** Use ‹ › on the Dashboard to switch months. All cards and charts change.
- [ ] **Historical records are available.** On **History**, pick the year, tap a month to expand it, and check the yearly totals.
- [ ] **CSV and Excel exports work.** On **Reports**, download each export and open it in Excel or Google Sheets. Check the summary values.
- [ ] **Mobile responsiveness works.** No sideways scrolling on any page. Buttons are easy to tap, and the bottom navigation is always visible.
- [ ] **Google Sheets saves and retrieves data correctly.** Open your Google Sheet: each income and payment appears as a row. Change an amount directly in the sheet, then tap ⟳ on the Dashboard (or Settings → Refresh): the app shows the new value.
- [ ] **Change PIN works.** Settings → Change PIN, then log out and log in with the new PIN.

---

## 8. Troubleshooting

| Problem / message | Cause | Fix |
|---|---|---|
| **"Permission denied by Google Sheets. Share the spreadsheet with the service account email…"** | The sheet isn't shared with the robot, or the Sheets API is disabled | Do step **2.4** (share as **Editor**) and step **1.2**. Wait 1 minute and retry |
| **"Spreadsheet not found. Check GOOGLE_SHEET_ID."** | Wrong ID, or you copied the whole URL | Copy only the part between `/d/` and `/edit` (step 2.5) |
| **"Google rejected the service account credentials…"** / **"GOOGLE_PRIVATE_KEY looks invalid"** | The private key or email was copied incompletely, or the key was deleted in Google Cloud | Re-copy `client_email` and the **entire** `private_key` (including `-----BEGIN…` and `-----END PRIVATE KEY-----\n`). If the key was deleted, create a new key (step 1.4) |
| **"Setup needed — These environment variables are missing"** | `.env.local` is missing or misnamed, or the Vercel variables aren't set | Locally: the file must be named exactly `.env.local` and sit in the project root. Restart `npm run dev`. On Vercel: add the variables (step 5.4), then **Redeploy** |
| **"SESSION_SECRET (must be at least 32 characters)"** | Secret too short | Generate one with the command in section 6 |
| **Vercel build fails** | Usually a typo in the code or an old Node version | Open the failed deployment → **Build Logs**. Under Project → Settings → General → **Node.js Version**, choose **22.x** and redeploy. Run `npm run build` locally to see the same error |
| **The app works locally but not on Vercel** | The variables were only added locally | Add all 4 on Vercel and **Redeploy** |
| **"Could not reach Google…"** / network errors | Internet connection or temporary Google outage | Check your connection and tap **Try again** |
| **"Google Sheets is busy (rate limit)"** | Too many requests in a minute (rare for one person) | Wait a minute and retry |
| **"The spreadsheet changed while saving. Please refresh and try again."** | The sheet was edited (rows added or removed) at the same moment | Tap refresh ⟳ and repeat the action |
| **A row I typed directly in the sheet doesn't show up** | Rows need an ID in the first column and a valid date/amount/recipient | Prefer adding records through the app. If you type rows by hand, give them any unique ID (e.g. `manual_1`) |
| **"Incorrect PIN"** but you're sure it's right | Typo, or the PIN was changed on another device | Try again carefully. After 5 tries, wait 5 minutes. To reset, see **4.4 Forgot your PIN** |
| **"Too many wrong attempts. Try again in X minutes"** | Lockout protection | Wait, or clear `locked_until` in the `Settings` tab (4.4) |
| **Logged out unexpectedly** | The PIN was changed on another device, `SESSION_SECRET` changed, or the 7-day session expired | Simply log in again |
| **`npm install` fails** | Old Node.js, or the folder is inside a syncing folder | Install Node.js LTS (step 3.2), move the folder outside OneDrive/Dropbox, delete `node_modules`, and run `npm install` again |
| **`npm run dev` says port 3000 is in use** | Another app is using port 3000 | Run `npm run dev -- -p 3001` and open http://localhost:3001 |

Still stuck? Open the browser's developer console (F12 → Console) and the terminal running `npm run dev` (or Vercel → Deployments → **Logs**). Error messages there name the exact problem.
