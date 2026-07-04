/**
 * Analytics tab — deep spending insights: range selector, category
 * breakdown (click-through to Transactions), daily trend chart, weekday
 * spending pattern, and top payees.
 */

import { useState } from 'react';
import type { Expense, AnalyticsRange, ExpenseCategory } from '../../types/expense';
import { CATEGORY_META } from '../../types/expense';
import { useExpenseAnalytics } from '../../hooks/useExpenseAnalytics';
import { StatCard } from './StatCard';
import { EmptyState } from './EmptyState';

interface AnalyticsTabProps {
  expenses: Expense[];
  onCategoryClick: (category: ExpenseCategory) => void;
}

const RANGE_OPTIONS: Array<{ value: AnalyticsRange; label: string }> = [
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: '90d', label: '90D' },
  { value: 'month', label: 'This Month' },
  { value: 'all', label: 'All Time' },
];

function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function AnalyticsTab({ expenses, onCategoryClick }: AnalyticsTabProps) {
  const [range, setRange] = useState<AnalyticsRange>('30d');
  const analytics = useExpenseAnalytics(expenses, range);

  const maxDaily = Math.max(...analytics.dailyTrend.map((d) => d.debit), 1);
  const maxWeekday = Math.max(...analytics.weekdayPattern.map((d) => d.total), 1);
  const maxPayee = Math.max(...analytics.topPayees.map((p) => p.total), 1);

  if (expenses.length === 0) {
    return <EmptyState icon="📊" message="No data to analyze yet — transactions will appear here once logged." />;
  }

  return (
    <div className="space-y-6">
      {/* Range selector */}
      <div className="flex gap-2 flex-wrap">
        {RANGE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setRange(opt.value)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
              range === opt.value ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label={`Spent (${analytics.rangeLabel})`}
          value={formatCurrency(analytics.totalDebit)}
          gradientFrom="from-orange-50"
          gradientTo="to-amber-50"
          textColor="text-orange-600"
          subtext={`${analytics.txnCount} transactions`}
        />
        <StatCard
          label="Avg per Transaction"
          value={formatCurrency(analytics.avgTransaction)}
          gradientFrom="from-violet-50"
          gradientTo="to-purple-50"
          textColor="text-violet-600"
        />
      </div>

      {/* Daily trend chart */}
      {analytics.dailyTrend.some((d) => d.debit > 0) && (
        <div>
          <h4 className="text-sm font-medium text-slate-600 mb-3">Daily Spend Trend</h4>
          <div className="flex items-end justify-between gap-0.5 h-28 bg-slate-50 rounded-xl p-3 overflow-x-auto">
            {analytics.dailyTrend.map((day) => {
              const heightPct = Math.max((day.debit / maxDaily) * 100, day.debit > 0 ? 6 : 1);
              return (
                <div
                  key={day.date}
                  className="flex-1 min-w-[3px] flex flex-col items-center justify-end h-full"
                  title={`${formatDate(day.date)}: ${formatCurrency(day.debit)}`}
                >
                  <div
                    className={`w-full rounded-t-sm transition-all ${
                      day.debit > 0 ? 'bg-gradient-to-t from-blue-400 to-cyan-400' : 'bg-slate-200'
                    }`}
                    style={{ height: `${heightPct}%` }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Category breakdown */}
      {analytics.categories.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-slate-600 mb-3">Spending by Category</h4>
          <div className="space-y-2">
            {analytics.categories.map((cb) => {
              const meta = CATEGORY_META[cb.category];
              return (
                <button
                  key={cb.category}
                  onClick={() => onCategoryClick(cb.category)}
                  className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 transition-colors"
                >
                  <span className="text-lg">{meta.icon}</span>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-slate-700 font-medium truncate">{meta.label}</span>
                      <span className="text-slate-600 font-semibold ml-2">
                        {formatCurrency(cb.total)}{' '}
                        <span className="text-slate-400 font-normal">({cb.percentage.toFixed(0)}%)</span>
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${cb.percentage}%`, backgroundColor: meta.color }}
                      />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-slate-400 mt-2">Tap a category to view its transactions →</p>
        </div>
      )}

      {/* Weekday pattern */}
      <div>
        <h4 className="text-sm font-medium text-slate-600 mb-3">Spending by Day of Week</h4>
        <div className="flex items-end justify-between gap-2 h-20 bg-slate-50 rounded-xl p-3">
          {analytics.weekdayPattern.map((day) => {
            const heightPct = Math.max((day.total / maxWeekday) * 100, day.total > 0 ? 8 : 2);
            const isToday = day.weekday === new Date().getDay();
            return (
              <div key={day.weekday} className="flex-1 flex flex-col items-center justify-end h-full gap-1">
                <div
                  className={`w-full rounded-t-sm transition-all ${
                    isToday ? 'bg-gradient-to-t from-violet-500 to-purple-400' : 'bg-gradient-to-t from-slate-300 to-slate-200'
                  }`}
                  style={{ height: `${heightPct}%` }}
                  title={`${day.label}: ${formatCurrency(day.total)}`}
                />
                <span className={`text-[10px] ${isToday ? 'text-violet-600 font-bold' : 'text-slate-400'}`}>
                  {day.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top payees */}
      {analytics.topPayees.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-slate-600 mb-3">Top Payees</h4>
          <div className="space-y-2">
            {analytics.topPayees.map((p) => (
              <div key={p.payee} className="flex items-center gap-3">
                <span className="text-xs text-slate-500 w-24 truncate">{p.payee}</span>
                <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full transition-all"
                    style={{ width: `${(p.total / maxPayee) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-slate-600 font-medium w-16 text-right">{formatCurrency(p.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
