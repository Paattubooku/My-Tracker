/**
 * Stats display cards
 */

import type { HydrationStats } from '../hooks/useHydration';

interface StatsCardProps {
  stats: HydrationStats;
}

export function StatsCard({ stats }: StatsCardProps) {
  return (
    <div className="w-full bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
      <h3 className="font-semibold text-slate-800 mb-4">Your Stats</h3>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center p-3 bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl">
          <span className="text-3xl font-bold text-orange-600 block">
            {stats.currentStreakDays}
          </span>
          <span className="text-xs text-orange-700 font-medium">Day Streak 🔥</span>
        </div>
        <div className="text-center p-3 bg-gradient-to-br from-violet-50 to-purple-50 rounded-xl">
          <span className="text-3xl font-bold text-violet-600 block">
            {stats.bestStreakDays}
          </span>
          <span className="text-xs text-violet-700 font-medium">Best Streak</span>
        </div>
        <div className="text-center p-3 bg-gradient-to-br from-cyan-50 to-teal-50 rounded-xl">
          <span className="text-3xl font-bold text-cyan-600 block">
            {(stats.sevenDayAverageMl / 1000).toFixed(1)}L
          </span>
          <span className="text-xs text-cyan-700 font-medium">7-Day Avg</span>
        </div>
      </div>

      {/* Weekly History */}
      <div>
        <h4 className="text-sm font-medium text-slate-600 mb-3">Last 7 Days</h4>
        <div className="space-y-2">
          {stats.history7Days.slice().reverse().map((day) => {
            const percentage = Math.min((day.total_ml / 3000) * 100, 100);
            const dateLabel = new Date(day.date + 'T00:00:00').toLocaleDateString([], {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            });

            return (
              <div key={day.date} className="flex items-center gap-3">
                <span className="text-sm text-slate-600 w-20 text-right">{dateLabel}</span>
                <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      day.goal_met
                        ? 'bg-gradient-to-r from-emerald-400 to-emerald-500'
                        : 'bg-gradient-to-r from-blue-400 to-blue-500'
                    }`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <span className="text-sm text-slate-600 w-16">
                  {(day.total_ml / 1000).toFixed(1)}L
                </span>
                {day.goal_met && <span className="text-lg">✓</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
