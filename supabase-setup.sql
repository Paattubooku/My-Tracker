-- ============================================
-- HydroFlow Database Setup
-- Run this in your Supabase SQL Editor
-- ============================================

-- 1. Water Intake Logs Table
CREATE TABLE IF NOT EXISTS water_logs (
    id SERIAL PRIMARY KEY,
    amount_ml INTEGER NOT NULL CHECK (amount_ml > 0 AND amount_ml <= 5000),
    logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    date DATE NOT NULL DEFAULT CURRENT_DATE
);

CREATE INDEX IF NOT EXISTS idx_water_logs_date ON water_logs(date);

-- 2. System Settings & State Table (Key-Value configuration store)
CREATE TABLE IF NOT EXISTS settings (
    key VARCHAR(64) PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed Default Settings
INSERT INTO settings (key, value) VALUES
    ('daily_goal_ml', '3000'),
    ('wake_time', '07:00'),
    ('sleep_time', '22:00'),
    ('min_interval_mins', '60'),
    ('reminder_enabled', 'true'),
    ('timezone_offset', '+05:30'),
    ('last_reminded_at', '1970-01-01T00:00:00.000Z')
ON CONFLICT (key) DO NOTHING;

-- 3. Reminder Dispatch Audit Log
CREATE TABLE IF NOT EXISTS reminder_logs (
    id SERIAL PRIMARY KEY,
    reminded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    urgency VARCHAR(16) NOT NULL,
    gap_ml INTEGER NOT NULL,
    suggested_ml INTEGER NOT NULL
);

-- ============================================
-- Row Level Security (RLS) - Single User Setup
-- ============================================

ALTER TABLE water_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on water_logs"
    ON water_logs FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow all operations on settings"
    ON settings FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow all operations on reminder_logs"
    ON reminder_logs FOR ALL
    USING (true)
    WITH CHECK (true);

-- ============================================
-- Verification Queries
-- ============================================

SELECT * FROM settings;
SELECT * FROM water_logs ORDER BY logged_at DESC LIMIT 10;
SELECT * FROM reminder_logs ORDER BY reminded_at DESC LIMIT 10;
