/**
 * React hooks for hydration tracking
 */

import { useState, useEffect, useCallback } from 'react';
import type { WaterLog, SettingsMap, SettingsKey, ReminderCheckResponse } from '../types';
import * as db from '../lib/supabase';
import { checkReminder, getHydrationMetrics, getStats } from '../lib/reminderEngine';

export interface HydrationMetrics {
  todayTotalMl: number;
  dailyGoal: number;
  percentageComplete: number;
  expectedByNow: number;
  gapMl: number;
  isOnTrack: boolean;
}

export interface HydrationStats {
  currentStreakDays: number;
  bestStreakDays: number;
  sevenDayAverageMl: number;
  history7Days: Array<{ date: string; total_ml: number; goal_met: boolean }>;
}

export function useHydration() {
  const [todayLogs, setTodayLogs] = useState<WaterLog[]>([]);
  const [metrics, setMetrics] = useState<HydrationMetrics | null>(null);
  const [stats, setStats] = useState<HydrationStats | null>(null);
  const [settings, setSettings] = useState<SettingsMap | null>(null);
  const [reminderResult, setReminderResult] = useState<ReminderCheckResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<{ success: boolean; message: string } | null>(null);

  const refreshData = useCallback(async () => {
    try {
      const [connectionTest, logs, metricsData, statsData, settingsData] = await Promise.all([
        db.testConnection(),
        db.getTodayWaterLogs(),
        getHydrationMetrics(),
        getStats(),
        db.getAllSettings(),
      ]);

      setConnectionStatus(connectionTest);
      setTodayLogs(logs);
      setMetrics(metricsData);
      setStats(statsData);
      setSettings(settingsData);
    } catch (error) {
      console.error('Failed to refresh data:', error);
      setConnectionStatus({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Background safety-net cleanup: removes water_logs/reminder_logs older
  // than 7 days so the free-tier Supabase project never fills up. Throttled
  // to run at most once per calendar day (tracked via localStorage) and
  // wrapped in try/catch so a failure here can NEVER affect the rest of the
  // app — it does not touch loading state, error state, or any UI.
  // This is a client-side backup for the primary server-side pg_cron job
  // defined in supabase-cleanup.sql (which runs even if the app is never opened).
  useEffect(() => {
    const THROTTLE_KEY = 'hydroflow_last_cleanup_run';
    const todayStr = new Date().toISOString().split('T')[0];

    const lastRun = localStorage.getItem(THROTTLE_KEY);
    if (lastRun === todayStr) return; // already ran today, skip

    db.cleanupOldData()
      .then(() => {
        localStorage.setItem(THROTTLE_KEY, todayStr);
      })
      .catch((error) => {
        // Non-fatal: just log it. The next app load (or the server-side
        // cron job) will retry — this never surfaces to the user.
        console.error('Background cleanup skipped:', error);
      });
  }, []);

  const logWater = useCallback(async (amountMl: number) => {
    await db.addWaterLog(amountMl);
    await refreshData();
  }, [refreshData]);

  const undoLastLog = useCallback(async () => {
    const removed = await db.deleteLastWaterLog();
    if (removed) {
      await refreshData();
    }
    return removed;
  }, [refreshData]);

  const updateSetting = useCallback(async (key: SettingsKey, value: string) => {
    await db.updateSettings({ [key]: value });
    await refreshData();
  }, [refreshData]);

  const checkForReminder = useCallback(async () => {
    const result = await checkReminder();
    setReminderResult(result);
    return result;
  }, []);

  const resetData = useCallback(async () => {
    await db.resetAllData();
    await refreshData();
  }, [refreshData]);

  return {
    todayLogs,
    metrics,
    stats,
    settings,
    reminderResult,
    isLoading,
    connectionStatus,
    logWater,
    undoLastLog,
    updateSetting,
    checkForReminder,
    refreshData,
    resetData,
  };
}
