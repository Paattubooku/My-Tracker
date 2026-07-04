// Database Models
export interface WaterLog {
  id: number;
  amount_ml: number;
  logged_at: string; // ISO 8601 UTC
  date: string; // YYYY-MM-DD format
}

export interface Setting {
  key: string;
  value: string;
  updated_at: string;
}

export interface ReminderLog {
  id: number;
  reminded_at: string;
  urgency: UrgencyLevel;
  gap_ml: number;
  suggested_ml: number;
}

// Enums
export type UrgencyLevel = 'low' | 'medium' | 'high';

export type ReminderReason =
  | 'disabled'
  | 'sleeping'
  | 'goal_reached'
  | 'cooldown_active'
  | 'on_track'
  | 'behind_schedule';

// Settings Keys Type
export type SettingsKey =
  | 'daily_goal_ml'
  | 'wake_time'
  | 'sleep_time'
  | 'min_interval_mins'
  | 'reminder_enabled'
  | 'timezone_offset'
  | 'last_reminded_at';

export type SettingsMap = {
  [key in SettingsKey]: string;
};

// API Request Types
export interface LogWaterRequest {
  amount_ml: number;
}

export interface UpdateSettingsRequest {
  daily_goal_ml?: string;
  wake_time?: string;
  sleep_time?: string;
  min_interval_mins?: string;
  reminder_enabled?: string;
  timezone_offset?: string;
}

// API Response Types
export interface LogWaterResponse {
  success: boolean;
  logged_ml: number;
  today_total_ml: number;
  daily_goal_ml: number;
  percentage_complete: number;
  remaining_ml: number;
}

export interface TodayStatsResponse {
  date: string;
  today_total_ml: number;
  daily_goal_ml: number;
  percentage_complete: number;
  remaining_ml: number;
  log_count: number;
  logs: Array<{
    id: number;
    amount_ml: number;
    logged_at: string;
  }>;
}

export interface DeleteLastResponse {
  success: boolean;
  removed_log: {
    id: number;
    amount_ml: number;
  } | null;
  new_today_total_ml: number;
}

export interface HistoryDay {
  date: string;
  total_ml: number;
  goal_met: boolean;
}

export interface WaterStatsResponse {
  current_streak_days: number;
  best_streak_days: number;
  seven_day_average_ml: number;
  history_7_days: HistoryDay[];
}

export interface ReminderCheckRemindResponse {
  remind: true;
  reason: 'behind_schedule';
  urgency: UrgencyLevel;
  title: string;
  message: string;
  suggested_amount_ml: number;
  metrics: {
    today_total_ml: number;
    expected_by_now_ml: number;
    gap_ml: number;
    daily_goal_ml: number;
    percentage_complete: number;
  };
}

export interface ReminderCheckSuppressResponse {
  remind: false;
  reason: Exclude<ReminderReason, 'behind_schedule'>;
  next_check_advisable_mins?: number;
}

export type ReminderCheckResponse = ReminderCheckRemindResponse | ReminderCheckSuppressResponse;

export interface GetSettingsResponse {
  settings: SettingsMap;
}

// Urgency Message Matrix
export interface UrgencyMessage {
  title: string;
  bodyTemplate: string;
}

export const URGENCY_MESSAGES: Record<UrgencyLevel, UrgencyMessage> = {
  low: {
    title: '💧 Gentle Hydration Nudge',
    bodyTemplate: "You're slightly behind schedule. A quick sip of ~{suggested_ml}ml keeps your streak alive!",
  },
  medium: {
    title: '🚰 Time for Water',
    bodyTemplate: 'You are {gap_ml}ml behind your hydration target. Drink a full glass (~{suggested_ml}ml) right now.',
  },
  high: {
    title: '🔴 Hydration Alert',
    bodyTemplate: 'Severe deficit detected! You are {gap_ml}ml behind schedule. Immediate hydration required.',
  },
};

// Default Settings
export const DEFAULT_SETTINGS: SettingsMap = {
  daily_goal_ml: '3000',
  wake_time: '07:00',
  sleep_time: '22:00',
  min_interval_mins: '60',
  reminder_enabled: 'true',
  timezone_offset: '+05:30',
  last_reminded_at: '1970-01-01T00:00:00.000Z',
};
