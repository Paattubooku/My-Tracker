-- ============================================================================
--  HydroFlow — Automatic Old Data Cleanup (Free Tier Storage Protection)
--  Run this ONCE in your Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ============================================================================
--
--  Deletes water_logs/reminder_logs older than 7 days. The app only ever
--  needs the last 7 days (today's total + 7-day stats/streaks), so this is
--  100% safe and never changes any existing behavior or calculation.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION hydroflow_delete_old_data()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM water_logs
  WHERE date < (CURRENT_DATE - INTERVAL '7 days');

  DELETE FROM reminder_logs
  WHERE reminded_at < (NOW() - INTERVAL '7 days');
END;
$$;

SELECT cron.unschedule('hydroflow-daily-cleanup')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'hydroflow-daily-cleanup'
);

SELECT cron.schedule(
  'hydroflow-daily-cleanup',
  '0 3 * * *',
  'SELECT hydroflow_delete_old_data();'
);

-- ============================================================================
--  VERIFICATION QUERIES
-- ============================================================================

SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname = 'hydroflow-daily-cleanup';

SELECT * FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'hydroflow-daily-cleanup')
ORDER BY start_time DESC
LIMIT 10;

-- SELECT hydroflow_delete_old_data();

SELECT
  (SELECT COUNT(*) FROM water_logs) AS water_logs_rows,
  (SELECT MIN(date) FROM water_logs) AS oldest_water_log_date,
  (SELECT COUNT(*) FROM reminder_logs) AS reminder_logs_rows,
  (SELECT MIN(reminded_at) FROM reminder_logs) AS oldest_reminder_log;
