/**
 * Core Reminder Engine
 *
 * Implements the 10-step deterministic sequence for determining
 * when and how urgently to remind the user to drink water.
 */

import type {
  ReminderCheckResponse,
  ReminderCheckRemindResponse,
  ReminderCheckSuppressResponse,
  UrgencyLevel,
} from '../types';
import { URGENCY_MESSAGES } from '../types';
import {
  getCurrentUTC,
  toLocalTime,
  isWithinWakingHours,
  calculateElapsedMinutes,
  calculateTotalWakingMinutes,
  minutesBetween,
} from './timeUtils';
import {
  getAllSettings,
  getTodayWaterLogs,
  getDailyStatsForDays,
  addReminderLog,
  updateSettings,
} from './supabase';

/**
 * Calculate the expected intake based on elapsed waking hours
 */
function calculateExpectedIntake(
  elapsedMinutes: number,
  totalWakingMinutes: number,
  dailyGoal: number
): number {
  if (totalWakingMinutes <= 0) {
    return 0;
  }

  const progress = Math.min(elapsedMinutes / totalWakingMinutes, 1);
  return Math.round(progress * dailyGoal);
}

/**
 * Classify urgency based on hydration gap
 */
function classifyUrgency(gapMl: number): UrgencyLevel {
  if (gapMl > 500) {
    return 'high';
  } else if (gapMl > 200) {
    return 'medium';
  }
  return 'low';
}

/**
 * Generate notification message from urgency level
 */
function generateMessage(
  urgency: UrgencyLevel,
  gapMl: number,
  suggestedMl: number
): { title: string; message: string } {
  const template = URGENCY_MESSAGES[urgency];

  const message = template.bodyTemplate
    .replace('{gap_ml}', gapMl.toString())
    .replace('{suggested_ml}', suggestedMl.toString());

  return {
    title: template.title,
    message,
  };
}

/**
 * Calculate suggested amount (rounded to nearest 50, max 500)
 */
function calculateSuggestedAmount(gapMl: number): number {
  const rounded = Math.round(gapMl / 50) * 50;
  return Math.min(Math.max(rounded, 50), 500);
}

/**
 * Main reminder check function
 * Implements the 10-step execution sequence
 */
export async function checkReminder(): Promise<ReminderCheckResponse> {
  const nowUTC = getCurrentUTC();

  // Step 1: Fetch State
  const settings = await getAllSettings();
  const todayLogs = await getTodayWaterLogs();
  const todayTotalMl = todayLogs.reduce((sum, log) => sum + log.amount_ml, 0);

  const dailyGoal = parseInt(settings.daily_goal_ml, 10);
  const wakeTime = settings.wake_time;
  const sleepTime = settings.sleep_time;
  const minIntervalMins = parseInt(settings.min_interval_mins, 10);
  const reminderEnabled = settings.reminder_enabled === 'true';
  const timezoneOffset = settings.timezone_offset;
  const lastRemindedAt = new Date(settings.last_reminded_at);

  // Step 2: Global Kill-Switch Check
  if (!reminderEnabled) {
    return createSuppressResponse('disabled');
  }

  // Step 3: Sleep Boundary Evaluation
  const localTime = toLocalTime(nowUTC, timezoneOffset);

  if (!isWithinWakingHours(localTime, wakeTime, sleepTime)) {
    return createSuppressResponse('sleeping');
  }

  // Step 4: Goal Completion Check
  if (todayTotalMl >= dailyGoal) {
    return createSuppressResponse('goal_reached');
  }

  // Step 5: Cooldown Lock Evaluation
  const minutesSinceLastReminder = minutesBetween(nowUTC, lastRemindedAt);

  if (minutesSinceLastReminder < minIntervalMins) {
    const nextCheckMins = Math.ceil(minIntervalMins - minutesSinceLastReminder);
    return createSuppressResponse('cooldown_active', nextCheckMins);
  }

  // Step 6: Expected Hydration Curve Calculation
  const totalWakingMinutes = calculateTotalWakingMinutes(wakeTime, sleepTime);
  const elapsedMinutes = calculateElapsedMinutes(localTime, wakeTime);
  const expectedIntake = calculateExpectedIntake(elapsedMinutes, totalWakingMinutes, dailyGoal);

  // Step 7: Hydration Gap Derivation
  const gapMl = expectedIntake - todayTotalMl;

  if (gapMl <= 0) {
    return createSuppressResponse('on_track');
  }

  // Step 8: Urgency Classification
  const urgency = classifyUrgency(gapMl);

  // Step 9: Dynamic Message & Action Generation
  const suggestedAmountMl = calculateSuggestedAmount(gapMl);
  const { title, message } = generateMessage(urgency, gapMl, suggestedAmountMl);

  // Step 10: State Commitment
  await updateSettings({
    last_reminded_at: nowUTC.toISOString(),
  });

  await addReminderLog({
    reminded_at: nowUTC.toISOString(),
    urgency,
    gap_ml: gapMl,
    suggested_ml: suggestedAmountMl,
  });

  const percentageComplete = Math.round((todayTotalMl / dailyGoal) * 1000) / 10;

  const response: ReminderCheckRemindResponse = {
    remind: true,
    reason: 'behind_schedule',
    urgency,
    title,
    message,
    suggested_amount_ml: suggestedAmountMl,
    metrics: {
      today_total_ml: todayTotalMl,
      expected_by_now_ml: expectedIntake,
      gap_ml: gapMl,
      daily_goal_ml: dailyGoal,
      percentage_complete: percentageComplete,
    },
  };

  return response;
}

/**
 * Helper to create suppress responses
 */
function createSuppressResponse(
  reason: ReminderCheckSuppressResponse['reason'],
  nextCheckMins?: number
): ReminderCheckSuppressResponse {
  const response: ReminderCheckSuppressResponse = {
    remind: false,
    reason,
  };

  if (nextCheckMins !== undefined) {
    response.next_check_advisable_mins = nextCheckMins;
  }

  return response;
}

/**
 * Get hydration metrics for display
 */
export async function getHydrationMetrics(): Promise<{
  todayTotalMl: number;
  dailyGoal: number;
  percentageComplete: number;
  expectedByNow: number;
  gapMl: number;
  isOnTrack: boolean;
}> {
  const nowUTC = getCurrentUTC();
  const settings = await getAllSettings();
  const todayLogs = await getTodayWaterLogs();

  const todayTotalMl = todayLogs.reduce((sum, log) => sum + log.amount_ml, 0);
  const dailyGoal = parseInt(settings.daily_goal_ml, 10);
  const wakeTime = settings.wake_time;
  const sleepTime = settings.sleep_time;
  const timezoneOffset = settings.timezone_offset;

  const localTime = toLocalTime(nowUTC, timezoneOffset);
  const totalWakingMinutes = calculateTotalWakingMinutes(wakeTime, sleepTime);
  const elapsedMinutes = calculateElapsedMinutes(localTime, wakeTime);

  const expectedByNow = calculateExpectedIntake(elapsedMinutes, totalWakingMinutes, dailyGoal);
  const gapMl = Math.max(expectedByNow - todayTotalMl, 0);
  const percentageComplete = Math.round((todayTotalMl / dailyGoal) * 1000) / 10;

  return {
    todayTotalMl,
    dailyGoal,
    percentageComplete,
    expectedByNow,
    gapMl,
    isOnTrack: gapMl === 0,
  };
}

/**
 * Calculate stats for streak and history
 */
export async function getStats(): Promise<{
  currentStreakDays: number;
  bestStreakDays: number;
  sevenDayAverageMl: number;
  history7Days: Array<{ date: string; total_ml: number; goal_met: boolean }>;
}> {
  const settings = await getAllSettings();
  const dailyGoal = parseInt(settings.daily_goal_ml, 10);

  // Pull real data from Supabase (reads from water_logs for last 7 days)
  const history7Days = await getDailyStatsForDays(7);

  const sevenDayAverageMl = Math.round(
    history7Days.reduce((sum, day) => sum + day.total_ml, 0) / 7
  );

  // Calculate current streak — count backwards from today, but tolerate
  // today not being complete yet.
  let currentStreakDays = 0;
  for (let i = 0; i < history7Days.length; i++) {
    const day = history7Days[history7Days.length - 1 - i];
    const isToday = i === 0;

    if (day.total_ml >= dailyGoal) {
      currentStreakDays++;
    } else if (!isToday) {
      // Not today and goal not met → streak broken
      break;
    }
  }

  // Calculate best streak within the 7-day window
  let bestStreakDays = 0;
  let tempStreak = 0;
  for (const day of history7Days) {
    if (day.total_ml >= dailyGoal) {
      tempStreak++;
      bestStreakDays = Math.max(bestStreakDays, tempStreak);
    } else {
      tempStreak = 0;
    }
  }

  return {
    currentStreakDays,
    bestStreakDays,
    sevenDayAverageMl,
    history7Days,
  };
}
