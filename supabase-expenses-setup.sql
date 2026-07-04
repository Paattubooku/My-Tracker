-- ============================================================================
--  HydroFlow — Expense Tracker (ICICI Bank SMS Auto-Logger) — v4 Schema
--  Run this ONCE in your Supabase SQL Editor (Dashboard → SQL Editor → New query)
--
--  ARCHITECTURE CHANGE (v4): No more Vercel serverless functions, no
--  webhooks, no service_role key, no server-side Gemini calls. This now
--  works EXACTLY like the Water Tracker:
--    • Your iPhone Automation posts the raw SMS text DIRECTLY to Supabase's
--      REST API using the anon key (same pattern the Scriptable widget
--      already uses to READ water_logs — this just adds a WRITE).
--    • The React app classifies pending messages CLIENT-SIDE (in the
--      browser) using the anon key, exactly like every other read/write
--      in this app (see src/lib/supabase.ts).
--  This eliminates the entire class of "FUNCTION_INVOCATION_FAILED" /
--  build-config / module-resolution problems that come with running your
--  own backend — there simply isn't one anymore for this feature.
--
--  Safe to re-run at any time (idempotent via IF NOT EXISTS / ADD COLUMN IF
--  NOT EXISTS everywhere).
--
--  This is a completely isolated feature. It never touches water_logs,
--  settings, or reminder_logs from the Water Tracker.
-- ============================================================================

-- 1) Inbox — the iPhone Automation writes raw SMS text here directly.
--    The app reads+classifies pending rows, then deletes them once handled.
CREATE TABLE IF NOT EXISTS expense_inbox (
    id SERIAL PRIMARY KEY,
    raw_message TEXT NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expense_inbox_received_at ON expense_inbox(received_at);

-- 2) Expenses table — final classified transactions.
CREATE TABLE IF NOT EXISTS expenses (
    id SERIAL PRIMARY KEY,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    payee TEXT,
    category VARCHAR(32) NOT NULL DEFAULT 'other',
    txn_date DATE NOT NULL,
    upi_ref TEXT,
    raw_message TEXT NOT NULL,
    type VARCHAR(10) NOT NULL CHECK (type IN ('debit', 'credit')),
    source VARCHAR(20) NOT NULL DEFAULT 'regex',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Upgrade path for anyone who ran an older version of this file
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS category VARCHAR(32) NOT NULL DEFAULT 'other';

-- Dedup safeguard: the SAME upi_ref can never be inserted twice.
CREATE UNIQUE INDEX IF NOT EXISTS idx_expenses_upi_ref_unique
  ON expenses (upi_ref)
  WHERE upi_ref IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_expenses_txn_date ON expenses(txn_date);
CREATE INDEX IF NOT EXISTS idx_expenses_type ON expenses(type);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);

-- 3) Non-transactional messages (bill reminders, failed autopay, statement
--    notices, noise). Kept separately for the app's "Parser Lab" tab —
--    never counted as spend.
CREATE TABLE IF NOT EXISTS expense_skipped_messages (
    id SERIAL PRIMARY KEY,
    raw_message TEXT NOT NULL,
    classification VARCHAR(30) NOT NULL,
    source VARCHAR(20) NOT NULL DEFAULT 'regex',
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expense_skipped_received_at ON expense_skipped_messages(received_at);

-- ============================================================================
--  Row Level Security — matches the Water Tracker's model EXACTLY.
--  water_logs/settings/reminder_logs all use "allow all" policies for the
--  anon key (see supabase-setup.sql) because this is a personal, single-
--  user app with no login system. The expense tables now follow the same
--  model: the anon key can read AND write directly, no separate secret key.
-- ============================================================================

ALTER TABLE expense_inbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_skipped_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on expense_inbox" ON expense_inbox;
CREATE POLICY "Allow all operations on expense_inbox"
    ON expense_inbox FOR ALL
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow read-only access to expenses" ON expenses;
DROP POLICY IF EXISTS "Allow all operations on expenses" ON expenses;
CREATE POLICY "Allow all operations on expenses"
    ON expenses FOR ALL
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow read-only access to expense_skipped_messages" ON expense_skipped_messages;
DROP POLICY IF EXISTS "Allow all operations on expense_skipped_messages" ON expense_skipped_messages;
CREATE POLICY "Allow all operations on expense_skipped_messages"
    ON expense_skipped_messages FOR ALL
    USING (true)
    WITH CHECK (true);

-- ============================================================================
--  Automatic Cleanup — mirrors the Water Tracker's cleanup pattern.
--   • expenses / expense_skipped_messages older than 1 year are deleted.
--   • expense_inbox rows older than 7 days that somehow never got
--     processed (e.g. the app wasn't opened, or classification kept
--     erroring) are moved into expense_skipped_messages as
--     'stale_unprocessed' so nothing pending grows the inbox forever.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION hydroflow_delete_old_expenses()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Archive stale inbox items (>7 days old) instead of silently losing them.
  INSERT INTO expense_skipped_messages (raw_message, classification, source, received_at)
  SELECT raw_message, 'stale_unprocessed', 'regex', received_at
  FROM expense_inbox
  WHERE received_at < (NOW() - INTERVAL '7 days');

  DELETE FROM expense_inbox
  WHERE received_at < (NOW() - INTERVAL '7 days');

  DELETE FROM expenses
  WHERE txn_date < (CURRENT_DATE - INTERVAL '1 year');

  DELETE FROM expense_skipped_messages
  WHERE received_at < (NOW() - INTERVAL '1 year');
END;
$$;

SELECT cron.unschedule('hydroflow-expenses-cleanup')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'hydroflow-expenses-cleanup'
);

SELECT cron.schedule(
  'hydroflow-expenses-cleanup',
  '30 3 * * *',   -- daily at 03:30 UTC, offset from the 03:00 water-tracker cleanup job
  'SELECT hydroflow_delete_old_expenses();'
);

-- ============================================================================
--  VERIFICATION QUERIES
-- ============================================================================

SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname = 'hydroflow-expenses-cleanup';

SELECT * FROM expense_inbox ORDER BY received_at DESC LIMIT 20;

SELECT * FROM expenses ORDER BY txn_date DESC, id DESC LIMIT 20;

SELECT category, COUNT(*) AS txn_count, SUM(amount) AS total
FROM expenses
WHERE type = 'debit'
GROUP BY category
ORDER BY total DESC;

SELECT * FROM expense_skipped_messages ORDER BY received_at DESC LIMIT 20;

-- SELECT hydroflow_delete_old_expenses();

SELECT
  (SELECT COUNT(*) FROM expense_inbox) AS inbox_pending_rows,
  (SELECT COUNT(*) FROM expenses) AS expenses_rows,
  (SELECT MIN(txn_date) FROM expenses) AS oldest_expense_date,
  (SELECT COUNT(*) FROM expense_skipped_messages) AS skipped_rows;
