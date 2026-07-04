/**
 * API Playground — Test every PRD endpoint live against Supabase
 */

import { useState } from 'react';
import * as db from '../lib/supabase';
import { checkReminder } from '../lib/reminderEngine';
import type { SettingsKey } from '../types';

interface TestResult {
  endpoint: string;
  status: 'success' | 'error';
  statusCode: number;
  durationMs: number;
  response: unknown;
  error?: string;
}

interface EndpointDef {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  description: string;
  run: () => Promise<unknown>;
  needsInput?: boolean;
  inputLabel?: string;
  inputType?: string;
}

const methodColors: Record<string, string> = {
  GET: 'bg-emerald-500',
  POST: 'bg-blue-500',
  PUT: 'bg-amber-500',
  DELETE: 'bg-red-500',
};

export function ApiPlayground() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [results, setResults] = useState<Record<string, TestResult>>({});
  const [running, setRunning] = useState<string | null>(null);
  const [inputValues, setInputValues] = useState<Record<string, string>>({});

  const endpoints: EndpointDef[] = [
    {
      method: 'GET',
      path: '/api/v1/water/today',
      description: "Get today's logs & progress",
      run: async () => {
        const logs = await db.getTodayWaterLogs();
        const settings = await db.getAllSettings();
        const total = logs.reduce((s, l) => s + l.amount_ml, 0);
        const goal = parseInt(settings.daily_goal_ml, 10);
        return {
          date: new Date().toISOString().split('T')[0],
          today_total_ml: total,
          daily_goal_ml: goal,
          percentage_complete: Math.round((total / goal) * 100),
          remaining_ml: Math.max(goal - total, 0),
          log_count: logs.length,
          logs,
        };
      },
    },
    {
      method: 'POST',
      path: '/api/v1/water/log',
      description: 'Log water intake',
      needsInput: true,
      inputLabel: 'amount_ml',
      inputType: 'number',
      run: async () => {
        const amountRaw = inputValues['water/log'] || '250';
        const amount = parseInt(amountRaw, 10);
        if (isNaN(amount) || amount <= 0) {
          throw new Error('amount_ml must be a positive number');
        }
        const log = await db.addWaterLog(amount);
        const total = (await db.getTodayWaterLogs()).reduce((s, l) => s + l.amount_ml, 0);
        const settings = await db.getAllSettings();
        const goal = parseInt(settings.daily_goal_ml, 10);
        return {
          success: true,
          logged_ml: amount,
          today_total_ml: total,
          daily_goal_ml: goal,
          percentage_complete: Math.round((total / goal) * 100),
          remaining_ml: Math.max(goal - total, 0),
          record: log,
        };
      },
    },
    {
      method: 'DELETE',
      path: '/api/v1/water/last',
      description: 'Remove most recent entry (undo)',
      run: async () => {
        const removed = await db.deleteLastWaterLog();
        const total = (await db.getTodayWaterLogs()).reduce((s, l) => s + l.amount_ml, 0);
        return {
          success: removed !== null,
          removed_log: removed,
          new_today_total_ml: total,
        };
      },
    },
    {
      method: 'GET',
      path: '/api/v1/water/stats',
      description: 'Get streak & 7-day analytics',
      run: async () => {
        const history = await db.getDailyStatsForDays(7);
        const dailyGoal = parseInt((await db.getAllSettings()).daily_goal_ml, 10);

        let current = 0;
        for (let i = history.length - 1; i >= 0; i--) {
          const isToday = i === history.length - 1;
          if (history[i].total_ml >= dailyGoal) current++;
          else if (!isToday) break;
        }

        let best = 0;
        let temp = 0;
        for (const d of history) {
          if (d.total_ml >= dailyGoal) {
            temp++;
            best = Math.max(best, temp);
          } else {
            temp = 0;
          }
        }

        const avg = Math.round(history.reduce((s, d) => s + d.total_ml, 0) / history.length);

        return {
          current_streak_days: current,
          best_streak_days: best,
          seven_day_average_ml: avg,
          history_7_days: history,
        };
      },
    },
    {
      method: 'GET',
      path: '/api/v1/reminder/check',
      description: 'Run the reminder engine (10-step)',
      run: async () => checkReminder(),
    },
    {
      method: 'GET',
      path: '/api/v1/reminder/settings',
      description: 'View all settings',
      run: async () => {
        const settings = await db.getAllSettings();
        return { settings };
      },
    },
    {
      method: 'PUT',
      path: '/api/v1/reminder/settings',
      description: 'Update a setting',
      needsInput: true,
      inputLabel: 'key=value (e.g. daily_goal_ml=3500)',
      inputType: 'text',
      run: async () => {
        const raw = inputValues['reminder/settings'] || '';
        const [key, ...rest] = raw.split('=');
        const value = rest.join('=');
        if (!key || !value) {
          throw new Error('Format: key=value (e.g. daily_goal_ml=3500)');
        }
        const validKeys: SettingsKey[] = [
          'daily_goal_ml', 'wake_time', 'sleep_time', 'min_interval_mins',
          'reminder_enabled', 'timezone_offset', 'last_reminded_at',
        ];
        if (!validKeys.includes(key.trim() as SettingsKey)) {
          throw new Error(`Invalid key. Valid: ${validKeys.join(', ')}`);
        }
        const updated = await db.updateSettings({ [key.trim()]: value.trim() });
        return { success: true, settings: updated };
      },
    },
  ];

  const runEndpoint = async (ep: EndpointDef) => {
    setRunning(ep.path);
    const start = performance.now();
    try {
      const response = await ep.run();
      const end = performance.now();
      setResults((prev) => ({
        ...prev,
        [ep.path]: {
          endpoint: `${ep.method} ${ep.path}`,
          status: 'success',
          statusCode: 200,
          durationMs: Math.round(end - start),
          response,
        },
      }));
    } catch (err) {
      const end = performance.now();
      setResults((prev) => ({
        ...prev,
        [ep.path]: {
          endpoint: `${ep.method} ${ep.path}`,
          status: 'error',
          statusCode: 500,
          durationMs: Math.round(end - start),
          response: null,
          error: err instanceof Error ? err.message : 'Unknown error',
        },
      }));
    } finally {
      setRunning(null);
    }
  };

  const runAll = async () => {
    for (const ep of endpoints) {
      await runEndpoint(ep);
    }
  };

  return (
    <div className="w-full bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-6 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">🧪</span>
          <div className="text-left">
            <span className="font-semibold text-slate-800 block">API Playground</span>
            <span className="text-xs text-slate-500">Test every endpoint live against Supabase</span>
          </div>
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

      {isExpanded && (
        <div className="px-6 pb-6 space-y-4 border-t border-slate-100 pt-6">
          <button
            onClick={runAll}
            disabled={running !== null}
            className="w-full py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium rounded-xl hover:from-blue-600 hover:to-cyan-600 active:scale-95 transition-all disabled:opacity-50"
          >
            {running !== null ? 'Running...' : '▶ Run All Endpoints'}
          </button>

          <div className="space-y-3">
            {endpoints.map((ep) => {
              const result = results[ep.path];
              return (
                <div key={ep.path} className="border border-slate-100 rounded-xl overflow-hidden">
                  <div className="flex items-center gap-3 p-3 bg-slate-50">
                    <span className={`${methodColors[ep.method]} text-white text-xs font-bold px-2 py-1 rounded`}>
                      {ep.method}
                    </span>
                    <code className="text-sm text-slate-700 font-mono flex-1">{ep.path}</code>

                    {result && (
                      <span className={`text-xs font-bold px-2 py-1 rounded ${
                        result.status === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {result.statusCode} • {result.durationMs}ms
                      </span>
                    )}

                    <button
                      onClick={() => runEndpoint(ep)}
                      disabled={running === ep.path}
                      className="px-3 py-1 bg-slate-800 text-white text-xs font-medium rounded-lg hover:bg-slate-900 active:scale-95 transition-all disabled:opacity-50"
                    >
                      {running === ep.path ? '...' : 'Test'}
                    </button>
                  </div>

                  {ep.needsInput && (
                    <div className="px-3 py-2 bg-slate-50 border-t border-slate-100">
                      <input
                        type={ep.inputType}
                        placeholder={ep.inputLabel}
                        value={inputValues[ep.path.split('/').slice(-2).join('/')] || ''}
                        onChange={(e) =>
                          setInputValues((prev) => ({
                            ...prev,
                            [ep.path.split('/').slice(-2).join('/')]: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                      />
                    </div>
                  )}

                  {result && (
                    <div className="p-3 bg-slate-900 overflow-x-auto">
                      <pre className="text-xs text-slate-100 whitespace-pre-wrap">
                        {result.status === 'success'
                          ? JSON.stringify(result.response, null, 2)
                          : `Error: ${result.error}`}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <p className="text-xs text-slate-500 text-center">
            Green <span className="text-emerald-600 font-semibold">200</span> = endpoint working · Red <span className="text-red-600 font-semibold">500</span> = check Supabase connection
          </p>
        </div>
      )}
    </div>
  );
}
