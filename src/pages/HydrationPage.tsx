/**
 * HydrationPage
 *
 * This is a 1:1 relocation of the original water-tracker UI that used to
 * live directly in App.tsx. NOTHING about its logic, hooks, components, or
 * behavior has been changed — only the outer file location moved so that
 * App.tsx can act as a thin shell switching between the Hydration page and
 * the new full-page Expense Tracker.
 *
 * Untouched dependencies: useHydration, ProgressCircle, QuickAddButtons,
 * TodayLogs, StatsCard, SettingsPanel, ReminderNotification, ApiInfoPanel,
 * ApiPlayground — none of these files were modified for the expense
 * tracker rebuild.
 */

import { useHydration } from '../hooks/useHydration';
import { ProgressCircle } from '../components/ProgressCircle';
import { QuickAddButtons } from '../components/QuickAddButtons';
import { TodayLogs } from '../components/TodayLogs';
import { StatsCard } from '../components/StatsCard';
import { SettingsPanel } from '../components/SettingsPanel';
import { ReminderNotification } from '../components/ReminderNotification';
import { ApiInfoPanel } from '../components/ApiInfoPanel';
import { ApiPlayground } from '../components/ApiPlayground';

export default function HydrationPage() {
  const {
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
    resetData,
  } = useHydration();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-cyan-50 to-teal-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-bounce text-6xl mb-4">💧</div>
          <p className="text-slate-600 font-medium">Loading HydroFlow...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-cyan-50 to-teal-50">
      {/* Header */}
      <header className="sticky top-14 z-40 backdrop-blur-lg bg-white/80 border-b border-slate-200">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">💧</span>
            <div>
              <h1 className="text-xl font-bold text-slate-800">HydroFlow</h1>
              <p className="text-xs text-slate-500">Smart Water Tracker</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-slate-700">
              {new Date().toLocaleDateString([], {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
              })}
            </p>
            <p className="text-xs text-slate-500">
              {new Date().toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Database Status Banner */}
        {connectionStatus && (
          <div className={`rounded-2xl p-3 flex items-center gap-3 ${
            connectionStatus.success
              ? 'bg-emerald-50 border border-emerald-100'
              : 'bg-red-50 border border-red-100'
          }`}>
            <span className="text-xl">
              {connectionStatus.success ? '🟢' : '🔴'}
            </span>
            <div>
              <p className={`font-medium text-sm ${
                connectionStatus.success ? 'text-emerald-800' : 'text-red-800'
              }`}>
                {connectionStatus.success ? 'Supabase Connected' : 'Supabase Not Configured'}
              </p>
              {!connectionStatus.success && (
                <p className="text-xs text-red-600 mt-0.5">
                  Add your credentials to .env file and restart
                </p>
              )}
            </div>
          </div>
        )}

        {/* Progress Circle */}
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 flex justify-center">
          {metrics && (
            <ProgressCircle
              percentage={metrics.percentageComplete}
              todayTotal={metrics.todayTotalMl}
              dailyGoal={metrics.dailyGoal}
            />
          )}
        </div>

        {/* Quick Add Buttons */}
        <QuickAddButtons onAdd={logWater} disabled={isLoading} />

        {/* Status Cards */}
        {metrics && !metrics.isOnTrack && (
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl p-4 border border-amber-100">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📊</span>
              <div>
                <p className="font-medium text-slate-800">Behind Schedule</p>
                <p className="text-sm text-slate-600">
                  You're <span className="font-semibold text-red-600">{metrics.gapMl} ml</span> behind
                  your expected intake. Drink about {Math.min(Math.round(metrics.gapMl / 50) * 50, 500)} ml
                  to catch up!
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Today's Logs */}
        <TodayLogs logs={todayLogs} onUndoLast={undoLastLog} />

        {/* Reminder Engine */}
        <ReminderNotification result={reminderResult} onCheck={checkForReminder} />

        {/* Stats */}
        {stats && <StatsCard stats={stats} />}

        {/* API Info */}
        <ApiInfoPanel />

        {/* API Playground */}
        <ApiPlayground />

        {/* Settings */}
        {settings && (
          <SettingsPanel
            settings={settings}
            onUpdateSetting={updateSetting}
            onResetData={resetData}
          />
        )}

        {/* Footer */}
        <footer className="text-center py-8 text-slate-400 text-sm">
          <p>HydroFlow • Serverless Hydration Engine Demo</p>
          <p className="mt-1 text-xs">
            Built with React + TypeScript • Designed for Vercel + Supabase
          </p>
        </footer>
      </main>
    </div>
  );
}
