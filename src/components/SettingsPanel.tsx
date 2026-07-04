/**
 * Settings configuration panel
 */

import { useState } from 'react';
import type { SettingsMap, SettingsKey } from '../types';

interface SettingsPanelProps {
  settings: SettingsMap;
  onUpdateSetting: (key: SettingsKey, value: string) => void;
  onResetData: () => void;
}

export function SettingsPanel({ settings, onUpdateSetting, onResetData }: SettingsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleGoalChange = (value: string) => {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 500 && num <= 10000) {
      onUpdateSetting('daily_goal_ml', value);
    }
  };

  const handleTimeChange = (key: 'wake_time' | 'sleep_time', value: string) => {
    onUpdateSetting(key, value);
  };

  const handleIntervalChange = (value: string) => {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 15 && num <= 180) {
      onUpdateSetting('min_interval_mins', value);
    }
  };

  const handleToggleReminder = () => {
    const newValue = settings.reminder_enabled === 'true' ? 'false' : 'true';
    onUpdateSetting('reminder_enabled', newValue);
  };

  const handleTimezoneChange = (value: string) => {
    onUpdateSetting('timezone_offset', value);
  };

  const handleReset = () => {
    onResetData();
    setShowResetConfirm(false);
  };

  return (
    <div className="w-full bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-6 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚙️</span>
          <span className="font-semibold text-slate-800">Settings</span>
        </div>
        <svg
          className={`w-5 h-5 text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Settings Content */}
      {isExpanded && (
        <div className="px-6 pb-6 space-y-6 border-t border-slate-100 pt-6">
          {/* Daily Goal */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Daily Goal (ml)
            </label>
            <input
              type="number"
              value={settings.daily_goal_ml}
              onChange={(e) => handleGoalChange(e.target.value)}
              min={500}
              max={10000}
              step={100}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            />
            <p className="text-xs text-slate-500 mt-1">Recommended: 2500-3500 ml</p>
          </div>

          {/* Wake & Sleep Times */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Wake Time
              </label>
              <input
                type="time"
                value={settings.wake_time}
                onChange={(e) => handleTimeChange('wake_time', e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Sleep Time
              </label>
              <input
                type="time"
                value={settings.sleep_time}
                onChange={(e) => handleTimeChange('sleep_time', e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
            </div>
          </div>

          {/* Reminder Interval */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Reminder Interval (minutes)
            </label>
            <input
              type="number"
              value={settings.min_interval_mins}
              onChange={(e) => handleIntervalChange(e.target.value)}
              min={15}
              max={180}
              step={5}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            />
            <p className="text-xs text-slate-500 mt-1">Minimum time between reminders</p>
          </div>

          {/* Timezone */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Timezone Offset (UTC)
            </label>
            <select
              value={settings.timezone_offset}
              onChange={(e) => handleTimezoneChange(e.target.value)}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            >
              <option value="-12:00">UTC-12:00</option>
              <option value="-11:00">UTC-11:00</option>
              <option value="-10:00">UTC-10:00</option>
              <option value="-09:00">UTC-09:00</option>
              <option value="-08:00">UTC-08:00 (PST)</option>
              <option value="-07:00">UTC-07:00 (MST)</option>
              <option value="-06:00">UTC-06:00 (CST)</option>
              <option value="-05:00">UTC-05:00 (EST)</option>
              <option value="-04:00">UTC-04:00</option>
              <option value="-03:00">UTC-03:00</option>
              <option value="-02:00">UTC-02:00</option>
              <option value="-01:00">UTC-01:00</option>
              <option value="+00:00">UTC+00:00 (GMT)</option>
              <option value="+01:00">UTC+01:00 (CET)</option>
              <option value="+02:00">UTC+02:00 (EET)</option>
              <option value="+03:00">UTC+03:00 (MSK)</option>
              <option value="+04:00">UTC+04:00</option>
              <option value="+05:00">UTC+05:00</option>
              <option value="+05:30">UTC+05:30 (IST)</option>
              <option value="+06:00">UTC+06:00</option>
              <option value="+07:00">UTC+07:00</option>
              <option value="+08:00">UTC+08:00 (CST)</option>
              <option value="+09:00">UTC+09:00 (JST)</option>
              <option value="+10:00">UTC+10:00 (AEST)</option>
              <option value="+11:00">UTC+11:00</option>
              <option value="+12:00">UTC+12:00 (NZST)</option>
            </select>
          </div>

          {/* Reminder Toggle */}
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
            <div>
              <span className="font-medium text-slate-700">Reminders Enabled</span>
              <p className="text-sm text-slate-500">
                {settings.reminder_enabled === 'true' ? 'Active' : 'Paused'}
              </p>
            </div>
            <button
              onClick={handleToggleReminder}
              className={`relative w-14 h-8 rounded-full transition-colors duration-200 ${
                settings.reminder_enabled === 'true' ? 'bg-emerald-500' : 'bg-slate-300'
              }`}
            >
              <span
                className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-200 ${
                  settings.reminder_enabled === 'true' ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Reset Data */}
          <div className="pt-4 border-t border-slate-100">
            {!showResetConfirm ? (
              <button
                onClick={() => setShowResetConfirm(true)}
                className="w-full py-3 text-red-500 hover:bg-red-50 rounded-xl transition-colors font-medium"
              >
                Reset All Data
              </button>
            ) : (
              <div className="flex gap-3">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReset}
                  className="flex-1 py-3 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors"
                >
                  Confirm Reset
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
