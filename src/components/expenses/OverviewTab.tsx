/**
 * Overview tab — the "at a glance" landing view of the Expense Tracker.
 * Shows this month's totals, a month-over-month comparison callout, a
 * 14-day mini trend, and a short list of the most recent transactions with
 * a shortcut into the full Transactions tab.
 */

import { useMemo } from 'react';
import type { Expense } from '../../types/expense';
import { useExpenseAnalytics } from '../../hooks/useExpenseAnalytics';
import { CategoryBadge } from './CategoryBadge';
import { StatCard } from './StatCard';
import { EmptyState } from './EmptyState';
import { AddExpenseForm } from './AddExpenseForm';

interface OverviewTabProps {
  expenses: Expense[];
  onViewAllTransactions: () => void;
  onExpenseAdded: () => void;
}

function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function formatDayLabel(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'narrow' });
}

export function OverviewTab({ expenses, onViewAllTransactions, onExpenseAdded }: OverviewTabProps) {
  const analytics = useExpenseAnalytics(expenses, 'month');

  const todayTotal = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return expenses
      .filter((e) => e.txn_date === today && e.type === 'debit')
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }, [expenses]);

  const recentExpenses = expenses.slice(0, 5);
  const last14 = analytics.dailyTrend.slice(-14);
  const maxDaily = Math.max(...last14.map((d) => d.debit), 1);

  const { changePct } = analytics.monthComparison;

  return (
    <div className="space-y-5">
      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label="Today"
          value={formatCurrency(todayTotal)}
          gradientFrom="from-rose-50"
          gradientTo="to-red-50"
          textColor="text-rose-600"
        />
        <StatCard
          label="This Month"
          value={formatCurrency(analytics.totalDebit)}
          gradientFrom="from-orange-50"
          gradientTo="to-amber-50"
          textColor="text-orange-600"
        />
        <StatCard
          label="Received"
          value={formatCurrency(analytics.totalCredit)}
          gradientFrom="from-emerald-50"
          gradientTo="to-teal-50"
          textColor="text-emerald-600"
        />
      </div>

      {/* Manual expense entry (mirrors the Water Tracker's quick-add buttons) */}
      <AddExpenseForm onAdded={onExpenseAdded} />

      {/* Month-over-month comparison */}
      {changePct !== null && (
        <div
          className={`rounded-2xl p-4 flex items-center gap-3 ${
            changePct > 0 ? 'bg-red-50 border border-red-100' : 'bg-emerald-50 border border-emerald-100'
          }`}
        >
          <span className="text-2xl">{changePct > 0 ? '📈' : '📉'}</span>
          <div>
            <p className={`font-medium text-sm ${changePct > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
              {Math.abs(changePct).toFixed(0)}% {changePct > 0 ? 'higher' : 'lower'} than last month
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {formatCurrency(analytics.monthComparison.previousMonthTotal)} last month vs{' '}
              {formatCurrency(analytics.monthComparison.currentMonthTotal)} this month
            </p>
          </div>
        </div>
      )}

      {/* 14-day mini trend */}
      {last14.some((d) => d.debit > 0) && (
        <div>
          <h4 className="text-sm font-medium text-slate-600 mb-2">Last 14 Days</h4>
          <div className="flex items-end justify-between gap-1 h-16 bg-slate-50 rounded-xl p-3">
            {last14.map((day) => {
              const heightPct = Math.max((day.debit / maxDaily) * 100, day.debit > 0 ? 8 : 2);
              return (
                <div key={day.date} className="flex-1 flex flex-col items-center justify-end h-full gap-1">
                  <div
                    className={`w-full rounded-t-sm transition-all ${
                      day.debit > 0 ? 'bg-gradient-to-t from-blue-400 to-cyan-400' : 'bg-slate-200'
                    }`}
                    style={{ height: `${heightPct}%` }}
                    title={`${formatDate(day.date)}: ${formatCurrency(day.debit)}`}
                  />
                  <span className="text-[9px] text-slate-400">{formatDayLabel(day.date)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent transactions */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium text-slate-600">Recent Transactions</h4>
          {expenses.length > 0 && (
            <button
              onClick={onViewAllTransactions}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              View All →
            </button>
          )}
        </div>

        {recentExpenses.length === 0 ? (
          <EmptyState icon="📭" message="No transactions yet — add one manually above, or set up the iPhone Automation to log SMS automatically." />
        ) : (
          <div className="space-y-2">
            {recentExpenses.map((expense) => (
              <div key={expense.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <div className="flex items-center gap-3 min-w-0">
                  <CategoryBadge category={expense.category} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{expense.payee || 'Unknown'}</p>
                    <p className="text-xs text-slate-400">{formatDate(expense.txn_date)}</p>
                  </div>
                </div>
                <span
                  className={`text-sm font-semibold whitespace-nowrap ${
                    expense.type === 'debit' ? 'text-red-600' : 'text-emerald-600'
                  }`}
                >
                  {expense.type === 'debit' ? '-' : '+'}
                  {formatCurrency(expense.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
