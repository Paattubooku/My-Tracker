# HydroFlow — Complete Application Documentation

**A personal, single-user web app combining a Smart Water Tracker and an SMS-based Expense Tracker — both running entirely client-side against Supabase, with no backend server anywhere in the project.**

---

## Table of Contents

1. [High-Level Overview](#1-high-level-overview)
2. [Architecture](#2-architecture)
3. [Tech Stack](#3-tech-stack)
4. [Project Structure](#4-project-structure)
5. [Initial Setup (Do This First)](#5-initial-setup-do-this-first)
6. [Feature 1: Water Tracker](#6-feature-1-water-tracker)
7. [Feature 2: Expense Tracker](#7-feature-2-expense-tracker)
8. [Database Schema Reference](#8-database-schema-reference)
9. [iPhone Integration (Scriptable Widget + Automation)](#9-iphone-integration-scriptable-widget--automation)
10. [Running Locally](#10-running-locally)
11. [Deploying](#11-deploying)
12. [Data Retention & Cleanup](#12-data-retention--cleanup)
13. [Troubleshooting](#13-troubleshooting)
14. [Extending the App](#14-extending-the-app)

---

## 1. High-Level Overview

HydroFlow is a **single-page React application** with two independent features, switchable via a top navigation bar:

| Feature | Purpose |
|---|---|
| 💧 **Water Tracker** | Log daily water intake, track progress against a goal, get intelligent hydration reminders based on time-of-day pacing, view streaks and 7-day history |
| 💳 **Expense Tracker** | Automatically parse ICICI Bank SMS transaction alerts (forwarded from your iPhone), classify them as real debits/credits vs. noise, categorize spending, and visualize analytics |

**Critical architectural fact:** there is **no backend server, no API routes, no webhooks, and no `/api` folder** anywhere in this project. Every single feature — both trackers — works by having the **React app running in your browser talk directly to Supabase** using the public "anon" key. This is deliberate and consistent across the whole app.

---

## 2. Architecture

### 2.1 The "No Backend" Model

```
┌─────────────────────┐        ┌──────────────────────────┐
│   React App          │        │       Supabase            │
│   (runs in browser)  │◄──────►│   (PostgreSQL + REST API) │
│                       │ anon   │                            │
│  - Water Tracker      │  key   │  Tables:                  │
│  - Expense Tracker    │        │   water_logs, settings,   │
│  - SMS Parser         │        │   reminder_logs,          │
│                       │        │   expense_inbox, expenses,│
└─────────────────────┘        │   expense_skipped_messages│
                                 └──────────────────────────┘
         ▲
         │ (also talks directly to Supabase, same anon key)
         │
┌─────────────────────┐
│  iPhone Scriptable    │   Reads water_logs + settings to render
│  Widget               │   a home-screen progress ring
└─────────────────────┘

┌─────────────────────┐
│  iPhone Shortcuts     │   Automation: "When I receive a message"
│  Automation            │   from ICICI Bank → POST the raw SMS text
│                       │   directly into Supabase's expense_inbox table
└─────────────────────┘
```

Every read and write — logging water, updating settings, checking the reminder engine, processing SMS messages, adding/deleting expenses — happens as a direct call from client-side TypeScript code to the Supabase JavaScript SDK (`@supabase/supabase-js`). There is no intermediate server to deploy, configure, or debug.

**Security model:** Since there's no backend to hide secrets behind, security is enforced by **Supabase Row Level Security (RLS) policies**, not by a secret key. All tables use "allow all" policies scoped to the anon role — this is appropriate because this is a **personal, single-user app** with no public users and no login system. Anyone who has your Supabase anon key and URL could read/write your data, so keep your deployed app's URL private and don't share your `.env` file.

### 2.2 Why This Design?

Earlier iterations of the Expense Tracker used Vercel serverless functions (an `/api` folder, a webhook, a service-role key). This was **removed entirely** after repeated deployment failures (`FUNCTION_INVOCATION_FAILED`, module-resolution crashes). The final design mirrors the Water Tracker's already-proven direct-to-Supabase pattern, eliminating that whole class of problems — there's simply no server left to misconfigure or crash.

---

## 3. Tech Stack

| Layer | Technology |
|---|---|
| Frontend framework | React 19 + TypeScript (strict mode) |
| Build tool | Vite 7 (with `vite-plugin-singlefile` — the entire app builds to one self-contained `dist/index.html`) |
| Styling | Tailwind CSS 4 |
| Database | Supabase (hosted PostgreSQL) |
| Database access | `@supabase/supabase-js` — direct client-side calls, anon key only |
| Scheduled cleanup | Supabase `pg_cron` extension (runs entirely inside the database, no external cron service) |
| Optional AI fallback | Google Gemini 2.0 Flash (called directly from the browser for expense SMS parsing edge cases) |
| iOS integration | Scriptable app (home screen widget) + iOS Shortcuts app (Automation) |

No Node.js server, no Express, no Next.js API routes, no Vercel Functions.

---

## 4. Project Structure

```
├── src/
│   ├── App.tsx                        # Root shell — top nav + page switcher
│   ├── main.tsx                       # React entry point
│   ├── index.css                      # Tailwind import
│   ├── vite-env.d.ts                  # Env var TypeScript declarations
│   │
│   ├── pages/
│   │   ├── HydrationPage.tsx          # Full Water Tracker page (all UI)
│   │   └── ExpensesPage.tsx           # Full Expense Tracker page (tab shell)
│   │
│   ├── types/
│   │   ├── index.ts                   # Water Tracker types + default settings
│   │   └── expense.ts                 # Expense Tracker types + category metadata
│   │
│   ├── lib/
│   │   ├── supabase.ts                # Water Tracker: Supabase client + all DB queries
│   │   ├── timeUtils.ts               # Timezone/date helper functions
│   │   ├── reminderEngine.ts          # 10-step hydration reminder algorithm
│   │   ├── expenses.ts                # Expense Tracker: Supabase client + all DB queries
│   │   └── expenseParser.ts           # SMS classification pipeline (regex + Gemini)
│   │
│   ├── hooks/
│   │   ├── useHydration.ts            # Water Tracker state management
│   │   ├── useExpenseData.ts          # Expense Tracker: fetch + auto-process inbox
│   │   ├── useExpenseFilters.ts       # Client-side transaction filtering
│   │   └── useExpenseAnalytics.ts     # Client-side analytics computation
│   │
│   ├── components/
│   │   ├── TopNav.tsx                 # App-level Hydration/Expenses switcher
│   │   ├── ProgressCircle.tsx         # Water Tracker: circular progress ring
│   │   ├── QuickAddButtons.tsx        # Water Tracker: quick-log buttons
│   │   ├── TodayLogs.tsx              # Water Tracker: today's log list
│   │   ├── StatsCard.tsx              # Water Tracker: streaks + 7-day history
│   │   ├── ReminderNotification.tsx   # Water Tracker: reminder engine tester
│   │   ├── SettingsPanel.tsx          # Water Tracker: settings editor
│   │   ├── ApiInfoPanel.tsx           # Water Tracker: API endpoint reference (docs only)
│   │   ├── ApiPlayground.tsx          # Water Tracker: live endpoint tester
│   │   └── expenses/
│   │       ├── OverviewTab.tsx        # Expense Tracker: dashboard/summary tab
│   │       ├── TransactionsTab.tsx    # Expense Tracker: filterable transaction list
│   │       ├── AnalyticsTab.tsx       # Expense Tracker: charts and breakdowns
│   │       ├── ParserLabTab.tsx       # Expense Tracker: inbox processor + SMS tester
│   │       ├── AddExpenseForm.tsx     # Expense Tracker: manual entry form
│   │       ├── CategoryBadge.tsx      # Shared: category icon component
│   │       ├── StatCard.tsx           # Shared: stat tile component
│   │       └── EmptyState.tsx         # Shared: empty-list placeholder
│   │
│   └── utils/
│       └── cn.ts                      # Tailwind class-merging utility
│
├── scriptable/
│   └── HydroFlow-Widget.js            # iOS home screen widget script
│
├── supabase-setup.sql                 # Water Tracker: table + RLS setup
├── supabase-expenses-setup.sql        # Expense Tracker: table + RLS + cleanup cron setup
├── supabase-cleanup.sql               # Water Tracker: 7-day auto-cleanup cron setup
│
├── .env / .env.example                # Environment variables (Supabase + optional Gemini)
├── index.html, vite.config.ts, tsconfig.json, package.json
```

---

## 5. Initial Setup (Do This First)

### 5.1 Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a free project.
2. Once created, go to **Settings → API** and copy:
   - **Project URL**
   - **anon public key**

### 5.2 Run the Database Setup Scripts

Open the Supabase **SQL Editor** and run these files **in order**, pasting each one's full contents and clicking Run:

1. `supabase-setup.sql` — creates the Water Tracker tables (`water_logs`, `settings`, `reminder_logs`)
2. `supabase-cleanup.sql` — sets up the Water Tracker's 7-day auto-cleanup scheduled job
3. `supabase-expenses-setup.sql` — creates the Expense Tracker tables (`expense_inbox`, `expenses`, `expense_skipped_messages`) and its 1-year auto-cleanup job

All three scripts are **idempotent** — safe to re-run any time without losing data (they use `IF NOT EXISTS` / `ON CONFLICT DO NOTHING` everywhere).

### 5.3 Configure Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key

# Optional — only needed for the Expense Tracker's Gemini fallback (see section 7.4)
VITE_GEMINI_API_KEY=
```

> ⚠️ All variables **must** be prefixed with `VITE_` — Vite only exposes prefixed variables to the browser bundle. This is standard for this app since there is no backend to keep unprefixed secrets on.

### 5.4 Install Dependencies & Run

```bash
npm install
npm run dev
```

Open the printed local URL. You should see the app load with a "Supabase Connected" banner in the Water Tracker.

---

## 6. Feature 1: Water Tracker

### 6.1 What It Does

Tracks how much water you drink each day against a configurable daily goal, and calculates whether you're "on pace" based on the time of day, your wake/sleep hours, and how much you've already logged. It also runs a rule-based reminder engine that can be polled (manually in-app, or externally e.g. from an iOS Shortcut) to decide if you should be nudged to drink water right now.

### 6.2 UI Walkthrough (`src/pages/HydrationPage.tsx`)

| Section | Component | What it shows |
|---|---|---|
| Connection banner | inline in `HydrationPage` | 🟢/🔴 whether Supabase is reachable |
| Progress ring | `ProgressCircle.tsx` | Circular SVG showing `today's total / daily goal`, color-coded by percentage (orange → violet → blue → cyan → emerald as you approach 100%) |
| Quick add | `QuickAddButtons.tsx` | One-tap buttons for 100ml, 150ml, 200ml, 250ml, 350ml, 500ml — logs instantly to Supabase |
| Behind-schedule banner | inline | Appears only if you're behind pace, tells you exactly how many ml to catch up |
| Today's log | `TodayLogs.tsx` | List of every log entry today with timestamps; "Undo Last" button removes the most recent one |
| Reminder Engine | `ReminderNotification.tsx` | "Check Now" button manually runs the 10-step reminder algorithm and shows the full JSON result |
| Stats | `StatsCard.tsx` | Current streak, best streak (within the last 7 days), 7-day average intake, and a 7-day history bar chart |
| API Info | `ApiInfoPanel.tsx` | Documentation-only reference table of the conceptual "endpoints" this app's logic maps to (there are no real HTTP endpoints — this is descriptive) |
| API Playground | `ApiPlayground.tsx` | Lets you manually trigger each underlying data function (log water, get today, get stats, etc.) and see the raw result, useful for debugging |
| Settings | `SettingsPanel.tsx` | Edit daily goal, wake/sleep time, reminder interval, timezone offset, enable/disable reminders, reset all data |

### 6.3 Data Model

Three tables, defined in `supabase-setup.sql`:

**`water_logs`** — every individual log entry
| Column | Type | Notes |
|---|---|---|
| `id` | SERIAL PK | |
| `amount_ml` | INTEGER | 1–5000, enforced by a CHECK constraint |
| `logged_at` | TIMESTAMPTZ | Exact UTC timestamp of the log |
| `date` | DATE | The calendar date (UTC) this log counts toward |

**`settings`** — a key/value config store, seeded with defaults on first run
| Key | Default | Meaning |
|---|---|---|
| `daily_goal_ml` | `3000` | Your daily water target in ml |
| `wake_time` | `07:00` | Local wake-up time (HH:MM) |
| `sleep_time` | `22:00` | Local bedtime (HH:MM) |
| `min_interval_mins` | `60` | Minimum minutes between reminders |
| `reminder_enabled` | `true` | Global on/off switch |
| `timezone_offset` | `+05:30` | Your UTC offset, e.g. IST |
| `last_reminded_at` | epoch | Internal — tracks cooldown state |

**`reminder_logs`** — an audit trail of every reminder that was actually triggered (urgency level, gap, suggested amount, timestamp).

All three tables use "allow all" RLS policies (see section 2.1).

### 6.4 The Reminder Engine — 10-Step Algorithm

Located in `src/lib/reminderEngine.ts`, function `checkReminder()`. This is the core piece of "intelligence" in the Water Tracker. Every time it's invoked, it runs through these steps **in order**, stopping and returning early ("suppressed") the moment any condition fails:

1. **Fetch state** — load all settings + today's water logs from Supabase.
2. **Kill-switch check** — if `reminder_enabled` is `false`, stop immediately → reason `"disabled"`.
3. **Sleep boundary check** — convert current UTC time to your local time using `timezone_offset`; if it's outside `[wake_time, sleep_time)`, stop → reason `"sleeping"`.
4. **Goal completion check** — if today's total already meets/exceeds the daily goal, stop → reason `"goal_reached"`.
5. **Cooldown check** — if less than `min_interval_mins` have passed since `last_reminded_at`, stop → reason `"cooldown_active"` (includes `next_check_advisable_mins`).
6. **Expected intake calculation** — computes how much water you *should* have drunk by now, based on a **linear pacing model**:
   ```
   elapsed_minutes = now - wake_time
   total_waking_minutes = sleep_time - wake_time
   expected_ml = (elapsed_minutes / total_waking_minutes) × daily_goal_ml
   ```
7. **Gap calculation** — `gap = expected_ml - actual_ml_so_far`. If `gap <= 0` (you're ahead of or on pace), stop → reason `"on_track"`.
8. **Urgency classification** — based on the gap size:
   - `low`: gap ≤ 200ml
   - `medium`: 200ml < gap ≤ 500ml
   - `high`: gap > 500ml
9. **Message generation** — picks a title + templated body message for the urgency level (see `URGENCY_MESSAGES` in `src/types/index.ts`), and calculates a `suggested_amount_ml` (the gap rounded to the nearest 50ml, clamped between 50–500ml).
10. **State commitment** — updates `last_reminded_at` to now, and inserts a row into `reminder_logs`, then returns the full reminder payload with `remind: true`.

**Why this matters:** this isn't a fixed-interval reminder ("nudge every hour") — it's pace-aware. If you drink a lot of water early in the day, reminders naturally stop until your pace falls behind again. If you're consistently ahead, you may get zero reminders all day.

### 6.5 Streaks & Stats Calculation

`getStats()` in `reminderEngine.ts` computes, over the last 7 days:
- **Current streak** — consecutive days (counting backward from today) where the daily goal was met. Today is allowed to be incomplete without breaking the streak (since the day isn't over yet).
- **Best streak** — the longest such run within the 7-day window.
- **7-day average** — mean daily total across the window.

### 6.6 Manual Actions Available

| Action | Where | Effect |
|---|---|---|
| Log water | Quick-add buttons | Inserts a `water_logs` row for right now |
| Undo last | Today's Log | Deletes the most recent log for today |
| Check reminder | Reminder Engine card | Runs `checkReminder()` and displays the result |
| Edit settings | Settings panel | Updates the `settings` table |
| Reset all data | Settings panel (confirm required) | Deletes all rows from `water_logs` and `reminder_logs` |

---

## 7. Feature 2: Expense Tracker

### 7.1 What It Does

Automatically ingests SMS transaction alerts from ICICI Bank (forwarded by your iPhone), figures out which ones represent **real money movement** (vs. bill reminders, failed autopay notices, statement alerts, or promotional noise), extracts the amount/payee/date/reference number, categorizes the spend, and stores it — giving you a running, automatically-maintained expense ledger with zero manual data entry (plus a manual-entry option for anything your bank doesn't text you about, like cash spends).

### 7.2 The Inbox Pattern — How Messages Get In

There is no webhook. Instead:

1. Your **iPhone Shortcuts Automation** (triggered by "When I receive a message" from ICICI Bank) sends a direct `POST` request to Supabase's REST API, inserting the raw SMS text as a new row in the `expense_inbox` table.
2. Every time you **open the Expense Tracker tab** (or manually click "Process Inbox Now"), the React app:
   - Reads all pending rows from `expense_inbox` (oldest first)
   - Classifies each one using the parser pipeline (see 7.3)
   - Writes the result into either `expenses` (real transactions) or `expense_skipped_messages` (everything else)
   - Deletes the row from `expense_inbox` **only after** it's been successfully recorded

This means the inbox acts as a durable queue: if classification fails for any reason (e.g. a Gemini network error), that message is **left in the inbox** and automatically retried the next time you open the app — nothing is silently lost.

### 7.3 The SMS Classification Pipeline (`src/lib/expenseParser.ts`)

This runs entirely in your browser (no network calls except an optional Gemini request). It's a three-stage, cheapest-first pipeline:

#### Stage A — Reject Rules (instant, free)
Checks the message against known **non-transactional** patterns and immediately classifies it, without ever considering it a transaction:

| Rule name | Matches | Classified as |
|---|---|---|
| `bill_reminder_auto_debit` | "will be auto-debited on" / "will auto-deduct on" | `bill_reminder` |
| `bill_reminder_please_ignore` | "amount will be debited from" + "please ignore if paid" | `bill_reminder` |
| `failed_autopay_cbs_rejection` | "not debited" + "cbs rejection" | `failed_autopay` |
| `statement_notice` | "statement is sent to" | `statement_notice` |
| `fee_change_noise` | "revised" + "fee" + "updated" | `noise` |
| `generic_promo_noise` | "for details, visit" without "debited"/"credited" | `noise` |

#### Stage B — Extraction Rules (instant, free)
An ordered list of regex patterns matched against the message, each with its own extractor function. The **first matching rule wins**:

| Rule name | Message shape | Result |
|---|---|---|
| `upi_debit` | `Acct XX219 debited for Rs 40.00 on 01-Jun-26; HOT N SPICY credited. UPI:651870302957` | debit, extracts amount/date/payee/UPI ref |
| `upi_credit` | `Acct XX219 is credited with Rs 16.80 on 01-Jun-26 from supermoney. UPI:615210447014` | credit |
| `imps_credit` | `Account XX219 is credited with Rs 10,000.00 ... IMPS Ref. no. 615313747552` | credit |
| `cardless_atm_withdrawal` | `Rs. 2,000.00 cardless withdrawal at ICICI Bank ATM on 10-Jun-26. Info: CCW*...` | debit, payee forced to "ATM Cash Withdrawal" |
| `credit_card_spend` | `INR 1,237.82 spent using ICICI Bank Card XX8006 on 12-Jun-26 on ICICI BILL PAY` | debit (uses a synthetic reference — see below) |
| `bill_autodebit_paid` | `ACT Fibernet bill of Rs 1237.82 for ... paid on 12-06-2026 ... Txn ID: IC3161630000001U8AK6` | debit |
| `credit_card_autopay_confirmation` | `thank you for your payment of INR 1,237.82 towards ICICI Bank Credit Card ... through Auto Debit ...` | debit (synthetic reference) |

Dates are normalized from either `DD-MMM-YY` (e.g. `01-Jun-26`) or `DD-MM-YYYY` (e.g. `12-06-2026`) into `YYYY-MM-DD`.

#### Stage C — Gemini Fallback (optional, only if configured)
If **neither** Stage A nor Stage B matched, and `VITE_GEMINI_API_KEY` is set, the message is sent directly from the browser to **Gemini 2.0 Flash** with a strict prompt instructing it to return only:
```json
{"classification": "actual_debit" | "actual_credit" | "not_a_transaction", "amount": number|null, "payee": string|null, "category": string|null, "txn_date": string|null, "upi_ref": string|null}
```
If Gemini errors out (network failure, malformed response), a `ClassificationError` is thrown — the message is **not** guessed at, and stays in the inbox for retry.

If no Gemini key is configured and nothing matched, the message is classified as `noise` (Stage: `unmatched_default`) rather than throwing, since there's no fallback to retry with.

### 7.4 Categories

Every real transaction gets a best-effort category assigned by keyword matching (`inferCategory()` in `expenseParser.ts`), purely for dashboard organization — it never affects whether something is classified as a transaction:

| Category | Icon | Trigger keywords |
|---|---|---|
| `food` | 🍔 | swiggy, zomato, juice, spicy, hotel, restaurant, food, snacks, etc. |
| `bills` | 🧾 | fibernet, pdcl, electricity, bill pay, broadband, dth, recharge |
| `cash` | 🏧 | cardless withdrawal, atm |
| `card` | 💳 | credit card, "card xx####", spent using |
| `shopping` | 🛍️ | mart, store, shop, retail |
| `transfer` | 💸 | default fallback for unrecognized person-to-person UPI debits |
| `income` | 💰 | automatically assigned to every credit |
| `other` | 📦 | fallback |

### 7.5 Deduplication

Every transaction is inserted with `upi_ref` as its unique key (`CREATE UNIQUE INDEX ... WHERE upi_ref IS NOT NULL` in the schema). The insert uses `upsert(..., { onConflict: 'upi_ref', ignoreDuplicates: true })`, so:
- If the exact same UPI/IMPS/Txn reference is seen again (e.g. the automation fires twice for the same SMS), it's silently ignored — no duplicate row, no double-counted spend.
- For message types with **no natural reference number** (credit card spend alerts, autopay confirmations), a **synthetic reference** is generated by hashing the raw message text (`stableHash()` — a dependency-free FNV-1a + secondary mix hash, deliberately not using Node's `crypto` module since this runs in the browser). This means an identical resend of the same exact SMS still dedups correctly.

### 7.6 UI Walkthrough (`src/pages/ExpensesPage.tsx`)

The Expense Tracker is a **tabbed full-page experience**:

#### 📊 Overview Tab (`OverviewTab.tsx`)
- Stat cards: Today's spend, This Month's spend, This Month's income received
- Month-over-month comparison callout (e.g. "12% higher than last month")
- 14-day mini bar chart of daily spend
- Recent transactions list (last 5) with a "View All →" shortcut
- **Add Expense Manually** form (`AddExpenseForm.tsx`) — for cash spends or anything with no SMS

#### 📋 Transactions Tab (`TransactionsTab.tsx`)
- Filter chips: All / Spent / Received
- Category filter chips (all 8 categories)
- Search box (matches on payee name)
- Paginated list (loads 15 at a time, "Load More" button)
- Each row shows category icon, payee, date, category label, UPI reference (if present), and amount
- **Delete button** per row (with a Confirm/Cancel inline step) — writes a direct `DELETE` to Supabase

#### 📈 Analytics Tab (`AnalyticsTab.tsx`)
- Range selector: 7D / 30D / 90D / This Month / All Time
- Total spent + average transaction size for the selected range
- Daily spend trend chart (capped at 90 days for readability even in "All Time" mode)
- Category breakdown with percentage bars — **click any category to jump into the Transactions tab pre-filtered to it**
- Day-of-week spending pattern (highlights today's weekday)
- Top 8 payees ranked bar chart

All analytics are computed **client-side** in `useExpenseAnalytics.ts` from the already-fetched expense list — switching ranges is instant, no new network requests.

#### 🧬 Parser Lab Tab (`ParserLabTab.tsx`)
A developer/debugging tool with three parts:
1. **Inbox status** — shows how many messages are pending, with a "Process Inbox Now" button that runs `processInbox()` and displays a detailed breakdown (debits logged, credits logged, duplicates ignored, non-transactional skipped, and any left-in-inbox errors).
2. **Add to inbox manually** — paste any SMS text and insert it directly into `expense_inbox`, simulating what the iPhone Automation would do. Useful for testing without waiting for a real bank SMS.
3. **Dry-run tester** — paste an SMS and click "Test Parse" to see exactly how the pipeline would classify it (which stage, which rule, extracted fields) **without writing anything to the database**. Includes 7 built-in sample messages covering every rule.

### 7.7 Data Model Summary

Three tables, defined in `supabase-expenses-setup.sql`:

**`expense_inbox`** — raw, unprocessed SMS text (the "queue")
| Column | Type |
|---|---|
| `id` | SERIAL PK |
| `raw_message` | TEXT |
| `received_at` | TIMESTAMPTZ |

**`expenses`** — final, classified transactions
| Column | Type | Notes |
|---|---|---|
| `id` | SERIAL PK | |
| `amount` | NUMERIC(12,2) | Must be > 0 |
| `payee` | TEXT | Nullable |
| `category` | VARCHAR(32) | One of the 8 categories |
| `txn_date` | DATE | |
| `upi_ref` | TEXT | Unique (partial index, NULLs allowed) |
| `raw_message` | TEXT | Original SMS, kept for audit |
| `type` | VARCHAR(10) | `debit` or `credit` |
| `source` | VARCHAR(20) | `regex` or `gemini` |
| `created_at` | TIMESTAMPTZ | |

**`expense_skipped_messages`** — everything classified as non-transactional
| Column | Type |
|---|---|
| `id` | SERIAL PK |
| `raw_message` | TEXT |
| `classification` | VARCHAR(30) (`bill_reminder` / `failed_autopay` / `statement_notice` / `noise` / `stale_unprocessed`) |
| `source` | VARCHAR(20) |
| `received_at` | TIMESTAMPTZ |

All three tables use "allow all" RLS policies — same trust model as the Water Tracker.

---

## 8. Database Schema Reference

Run these three SQL files, in order, in the Supabase SQL Editor:

| File | Creates | Also sets up |
|---|---|---|
| `supabase-setup.sql` | `water_logs`, `settings`, `reminder_logs` | RLS policies |
| `supabase-cleanup.sql` | — | `pg_cron` job: deletes `water_logs`/`reminder_logs` rows older than **7 days**, daily at 03:00 UTC |
| `supabase-expenses-setup.sql` | `expense_inbox`, `expenses`, `expense_skipped_messages` | RLS policies + `pg_cron` job: archives stale inbox items (>7 days unprocessed) and deletes `expenses`/`expense_skipped_messages` older than **1 year**, daily at 03:30 UTC |

All scripts include verification `SELECT` queries at the bottom you can run to sanity-check the setup (e.g. confirming the cron job is registered and active).

---

## 9. iPhone Integration (Scriptable Widget + Automation)

### 9.1 Home Screen Widget (`scriptable/HydroFlow-Widget.js`)

A widget script for the **Scriptable** app that renders your live hydration progress as a circular ring directly on your iOS home screen, in Small, Medium, and Large sizes.

**How it works:**
- Reads `settings` and today's `water_logs` directly from Supabase's REST API using your anon key (same read-only pattern as the web app)
- Draws the ring using Scriptable's native `DrawContext` API (background track + progress arc with rounded caps, built manually since Scriptable has no built-in arc-drawing primitive)
- Caches the last successful result locally so the widget still shows meaningful data if a refresh times out or the network is briefly unavailable
- Refreshes roughly every 30 minutes (iOS controls the exact timing)

**Setup:**
1. Install the **Scriptable** app from the App Store
2. Create a new script, paste in the contents of `scriptable/HydroFlow-Widget.js`
3. Fill in the `CONFIGURATION` block at the top with your `SUPABASE_URL` and `SUPABASE_ANON_KEY`
4. Tap ▶ to preview, then add it to your home screen as a Scriptable widget (choose Small/Medium/Large)

### 9.2 Expense Tracker iPhone Automation

Since there's no webhook, the automation writes **directly to Supabase**:

1. Open the **Shortcuts** app → **Automation** tab → **+** → **Create Personal Automation**
2. Choose **"Message"** as the trigger → set **"When I receive a message"** with sender containing your bank's SMS name (e.g. "ICICI Bank")
3. Add action: **"Get Contents of URL"**
   - **URL:** `https://YOUR_PROJECT.supabase.co/rest/v1/expense_inbox`
   - **Method:** `POST`
   - **Headers:**
     - `apikey`: your Supabase anon key
     - `Authorization`: `Bearer YOUR_ANON_KEY`
     - `Content-Type`: `application/json`
   - **Request Body (JSON):** `{"raw_message": <Shortcut Input / Message Content>}`
4. Turn off "Ask Before Running" so it fires silently
5. Done — no secret header, no custom backend URL required

The next time you open the Expense Tracker tab in the app (or tap "Process Inbox Now" in Parser Lab), the message will be classified and logged automatically.

---

## 10. Running Locally

```bash
npm install       # install dependencies
npm run dev       # start the Vite dev server
npm run build     # produce a production build in dist/ (single self-contained index.html)
npm run preview   # preview the production build locally
```

No environment-specific build steps are needed — the same `.env` values work for both `npm run dev` and `npm run build`.

---

## 11. Deploying

Since this is a pure static site (Vite + React, no backend), it can be deployed to **any static hosting provider** — Vercel, Netlify, Cloudflare Pages, GitHub Pages, etc. There is no `/api` folder and no serverless function configuration required.

**General steps for any provider:**
1. Set the build command to `npm run build`
2. Set the output directory to `dist`
3. Add the environment variables from your `.env` file (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and optionally `VITE_GEMINI_API_KEY`) in the hosting provider's dashboard
4. Deploy

Because `vite-plugin-singlefile` is used, the entire app (JS + CSS) is inlined into one `dist/index.html` file — there are no separate asset files to worry about serving correctly.

---

## 12. Data Retention & Cleanup

To stay within Supabase's free-tier storage limits, both features have automatic server-side cleanup running via `pg_cron` **inside the database itself** — this runs even if you never open the app:

| Job name | Schedule | What it deletes |
|---|---|---|
| `hydroflow-daily-cleanup` | Daily, 03:00 UTC | `water_logs` and `reminder_logs` rows older than **7 days** |
| `hydroflow-expenses-cleanup` | Daily, 03:30 UTC | Archives `expense_inbox` rows unprocessed for >7 days into `expense_skipped_messages` (as `stale_unprocessed`), then deletes `expenses` and `expense_skipped_messages` rows older than **1 year** |

You can verify these jobs are active anytime by running the verification queries at the bottom of `supabase-cleanup.sql` / `supabase-expenses-setup.sql` in the Supabase SQL Editor.

---

## 13. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| "Supabase Not Configured" banner | `.env` still has placeholder values | Fill in real `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` and restart the dev server |
| Water logs not saving | RLS policies not applied | Re-run `supabase-setup.sql` |
| Reminder engine always says "sleeping" | Wrong `timezone_offset` | Check Settings panel — must be `+HH:MM` or `-HH:MM` format matching your local timezone |
| Expense inbox count never decreases | Inbox processing only runs when the Expenses tab loads/refreshes | Open the 💳 Expenses tab, or click "Process Inbox Now" in Parser Lab |
| SMS not being classified correctly | Message format not covered by regex rules | Use the Parser Lab's dry-run tester to see exactly which stage handled it; if `unmatched_default`, either add a new rule to `expenseParser.ts` or configure `VITE_GEMINI_API_KEY` |
| Gemini fallback not working | `VITE_GEMINI_API_KEY` not set, or invalid | Get a free key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey) and add it to `.env`, then rebuild |
| Widget shows stale data | Network timeout on iOS | The widget caches last-known-good data automatically; wait for the next ~30 min refresh cycle |
| Duplicate transactions appearing | Should not happen — `upi_ref` has a unique constraint | Verify the unique index exists: re-run `supabase-expenses-setup.sql` |

---

## 14. Extending the App

Because everything is client-side, extending either feature just means writing more TypeScript that calls `@supabase/supabase-js` directly — no server deployment step required.

**To add a new expense parsing rule:** add an entry to `TRANSACTION_RULES` (for real transactions) or `REJECT_RULES` (for non-transactional patterns) in `src/lib/expenseParser.ts`, then verify it with the Parser Lab's dry-run tester before relying on it.

**To add a new water tracker setting:** add the key to `SettingsKey` in `src/types/index.ts`, add a default value to `DEFAULT_SETTINGS`, seed it in `supabase-setup.sql`, and add a UI control in `SettingsPanel.tsx`.

**To add a new expense category:** add it to `ExpenseCategory` in `src/lib/expenseParser.ts` AND `src/types/expense.ts`, add its metadata (icon/label/color) to `CATEGORY_META`, and add matching keywords to `CATEGORY_KEYWORDS` in `expenseParser.ts`.
