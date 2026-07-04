/**
 * Supabase client wrapper
 * Uses @supabase/supabase-js for PostgreSQL database access
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { WaterLog, ReminderLog, SettingsMap, SettingsKey } from '../types';
import { DEFAULT_SETTINGS } from '../types';

// Environment variables
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Lazy client initialization - only create once
let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!_client) {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY ||
        SUPABASE_URL.includes('your-project-ref') ||
        SUPABASE_ANON_KEY.includes('your-anon')) {
      throw new Error(
        'Supabase not configured. Please add your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to the .env file. ' +
        'Copy .env.example to .env and fill in your Supabase credentials.'
      );
    }
    _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return _client;
}

export { getClient as getSupabaseClient };

// ===== Water Logs Operations =====

export async function getWaterLogs(date?: string): Promise<WaterLog[]> {
  const supabase = getClient();
  let query = supabase
    .from('water_logs')
    .select('*')
    .order('logged_at', { ascending: false });

  if (date) {
    query = query.eq('date', date);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch water logs: ${error.message}`);
  }

  return (data || []) as WaterLog[];
}

export async function getTodayWaterLogs(): Promise<WaterLog[]> {
  const today = new Date().toISOString().split('T')[0];
  return getWaterLogs(today);
}

export async function addWaterLog(amount_ml: number): Promise<WaterLog> {
  const supabase = getClient();
  const now = new Date();

  const { data, error } = await supabase
    .from('water_logs')
    .insert({
      amount_ml,
      logged_at: now.toISOString(),
      date: now.toISOString().split('T')[0],
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to add water log: ${error.message}`);
  }

  return data as WaterLog;
}

export async function deleteLastWaterLog(): Promise<WaterLog | null> {
  const supabase = getClient();
  const today = new Date().toISOString().split('T')[0];

  // Get the last log for today
  const { data: logs, error: fetchError } = await supabase
    .from('water_logs')
    .select('*')
    .eq('date', today)
    .order('logged_at', { ascending: false })
    .limit(1);

  if (fetchError) {
    throw new Error(`Failed to fetch last log: ${fetchError.message}`);
  }

  if (!logs || logs.length === 0) {
    return null;
  }

  const lastLog = logs[0];

  // Delete it
  const { error: deleteError } = await supabase
    .from('water_logs')
    .delete()
    .eq('id', lastLog.id);

  if (deleteError) {
    throw new Error(`Failed to delete log: ${deleteError.message}`);
  }

  return lastLog as WaterLog;
}

// ===== Settings Operations =====

export async function getAllSettings(): Promise<SettingsMap> {
  const supabase = getClient();

  const { data, error } = await supabase
    .from('settings')
    .select('key, value');

  if (error) {
    throw new Error(`Failed to fetch settings: ${error.message}`);
  }

  // Start with defaults
  const settings: SettingsMap = { ...DEFAULT_SETTINGS };

  // Override with database values
  if (data) {
    for (const row of data) {
      settings[row.key as SettingsKey] = row.value;
    }
  }

  return settings;
}

export async function getSetting(key: SettingsKey): Promise<string> {
  const supabase = getClient();

  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', key)
    .single();

  if (error) {
    // If not found, return default
    if (error.code === 'PGRST116') {
      return DEFAULT_SETTINGS[key];
    }
    throw new Error(`Failed to fetch setting ${key}: ${error.message}`);
  }

  return data.value;
}

export async function updateSettings(updates: Partial<SettingsMap>): Promise<SettingsMap> {
  const supabase = getClient();

  // Update each setting
  for (const [key, value] of Object.entries(updates)) {
    const { error } = await supabase
      .from('settings')
      .upsert({
        key,
        value,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'key',
      });

    if (error) {
      throw new Error(`Failed to update setting ${key}: ${error.message}`);
    }
  }

  // Return updated settings
  return getAllSettings();
}

// ===== Reminder Logs Operations =====

export async function addReminderLog(log: Omit<ReminderLog, 'id'>): Promise<ReminderLog> {
  const supabase = getClient();

  const { data, error } = await supabase
    .from('reminder_logs')
    .insert(log)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to add reminder log: ${error.message}`);
  }

  return data as ReminderLog;
}

export async function getReminderLogs(): Promise<ReminderLog[]> {
  const supabase = getClient();

  const { data, error } = await supabase
    .from('reminder_logs')
    .select('*')
    .order('reminded_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch reminder logs: ${error.message}`);
  }

  return (data || []) as ReminderLog[];
}

// ===== Stats Queries =====

export async function getDailyStatsForDays(days: number): Promise<Array<{ date: string; total_ml: number; goal_met: boolean }>> {
  const supabase = getClient();
  const settings = await getAllSettings();
  const dailyGoal = parseInt(settings.daily_goal_ml, 10);

  const { data, error } = await supabase
    .from('water_logs')
    .select('date, amount_ml')
    .gte('date', getPastDateString(days - 1));

  if (error) {
    throw new Error(`Failed to fetch stats: ${error.message}`);
  }

  // Group by date
  const dateMap: Record<string, number> = {};
  if (data) {
    for (const log of data) {
      dateMap[log.date] = (dateMap[log.date] || 0) + log.amount_ml;
    }
  }

  // Build result for requested days
  const result: Array<{ date: string; total_ml: number; goal_met: boolean }> = [];
  for (let i = days - 1; i >= 0; i--) {
    const dateStr = getPastDateString(i);
    const total = dateMap[dateStr] || 0;
    result.push({
      date: dateStr,
      total_ml: total,
      goal_met: total >= dailyGoal,
    });
  }

  return result;
}

// Helper: Get date string N days ago
function getPastDateString(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().split('T')[0];
}

// ===== Database Health Check =====

export async function testConnection(): Promise<{ success: boolean; message: string }> {
  try {
    const supabase = getClient();
    const { error } = await supabase
      .from('settings')
      .select('count')
      .limit(1);

    if (error) {
      return { success: false, message: error.message };
    }

    return { success: true, message: 'Connected successfully' };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Unknown connection error',
    };
  }
}

// ===== Reset (no-op for Supabase) =====

export async function resetAllData(): Promise<void> {
  const supabase = getClient();

  // Delete all data from tables
  const { error: waterError } = await supabase
    .from('water_logs')
    .delete()
    .gte('id', 0);

  const { error: reminderError } = await supabase
    .from('reminder_logs')
    .delete()
    .gte('id', 0);

  if (waterError || reminderError) {
    throw new Error('Failed to reset data');
  }
}

// ===== Old Data Cleanup (Free Tier Storage Protection) =====
//
// This is a CLIENT-SIDE SAFETY NET that complements the server-side pg_cron
// job defined in `supabase-cleanup.sql`. The app only ever needs the last
// 7 days of water_logs/reminder_logs (see getDailyStatsForDays(7) above and
// the reminder engine, which only reads the `last_reminded_at` setting).
// Deleting anything older than 7 days is therefore always safe and never
// changes any existing feature, calculation, or displayed value.
//
// This function is purely additive and is only invoked from a throttled,
// best-effort background call (see src/hooks/useHydration.ts) so it never
// blocks or affects normal app usage.
const RETENTION_DAYS = 7;

export async function cleanupOldData(): Promise<{ deletedWaterLogs: number; deletedReminderLogs: number }> {
  const supabase = getClient();
  const cutoffDate = getPastDateString(RETENTION_DAYS);
  const cutoffTimestamp = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: deletedWater, error: waterError } = await supabase
    .from('water_logs')
    .delete()
    .lt('date', cutoffDate)
    .select('id');

  if (waterError) {
    throw new Error(`Failed to clean up old water logs: ${waterError.message}`);
  }

  const { data: deletedReminders, error: reminderError } = await supabase
    .from('reminder_logs')
    .delete()
    .lt('reminded_at', cutoffTimestamp)
    .select('id');

  if (reminderError) {
    throw new Error(`Failed to clean up old reminder logs: ${reminderError.message}`);
  }

  return {
    deletedWaterLogs: deletedWater ? deletedWater.length : 0,
    deletedReminderLogs: deletedReminders ? deletedReminders.length : 0,
  };
}
