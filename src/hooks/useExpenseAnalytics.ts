/**
 * useExpenseAnalytics — derives all Analytics-tab metrics from the raw
 * expense list for a given time range. Pure computation, no network calls —
 * everything is calculated client-side from the dataset already fetched by
 * useExpenseData, so switching ranges is instant.
 */

import { useMemo } from 'react';
import type {
  Expense,
  ExpenseAnalytics,
  AnalyticsRange,
  CategorySlice,
  DailyPoint,
  PayeeStat,
  WeekdayStat,
  MonthComparison,
  ExpenseCategory,
} from '../types/expense';
import { ALL_CATEGORIES } from '../types/expense';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const RANGE_LABELS: Record<AnalyticsRange, string> = {
  '7d': 'Last 7 Days',
  '30d': 'Last 30 Days',
  '90d': 'Last 90 Days',
  month: 'This Month',
  all: 'All Time',
};

// Chart readability cap: even with "All Time" selected for the totals, the
// daily bar chart only ever renders the most recent 90 days so it stays legible.
const DAILY_TREND_CHART_CAP_DAYS = 90;

function toISODate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return toISODate(d);
}

function getRangeStartDate(range: AnalyticsRange): string | null {
  switch (range) {
    case '7d': return daysAgoISO(6);
    case '30d': return daysAgoISO(29);
    case '90d': return daysAgoISO(89);
    case 'month': {
      const now = new Date();
      return toISODate(new Date(now.getFullYear(), now.getMonth(), 1));
    }
    case 'all': return null;
  }
}

function getMonthBounds(offsetMonths: number): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offsetMonths, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + offsetMonths + 1, 1);
  return { start: toISODate(start), end: toISODate(end) };
}

function computeMonthComparison(all: Expense[]): MonthComparison {
  const current = getMonthBounds(0);
  const previous = getMonthBounds(-1);

  let currentMonthTotal = 0;
  let previousMonthTotal = 0;

  for (const e of all) {
    if (e.type !== 'debit') continue;
    if (e.txn_date >= current.start && e.txn_date < current.end) {
      currentMonthTotal += Number(e.amount) || 0;
    } else if (e.txn_date >= previous.start && e.txn_date < previous.end) {
      previousMonthTotal += Number(e.amount) || 0;
    }
  }

  const changePct = previousMonthTotal > 0
    ? ((currentMonthTotal - previousMonthTotal) / previousMonthTotal) * 100
    : null;

  return { currentMonthTotal, previousMonthTotal, changePct };
}

export function useExpenseAnalytics(allExpenses: Expense[], range: AnalyticsRange): ExpenseAnalytics {
  return useMemo(() => {
    const startDate = getRangeStartDate(range);
    const inRange = startDate ? allExpenses.filter((e) => e.txn_date >= startDate) : allExpenses;

    let totalDebit = 0;
    let totalCredit = 0;
    let debitCount = 0;

    const categoryMap: Partial<Record<ExpenseCategory, { total: number; count: number }>> = {};
    const payeeMap: Record<string, { total: number; count: number; lastDate: string }> = {};
    const weekdayMap: Record<number, { total: number; count: number }> = {};

    for (const e of inRange) {
      const amount = Number(e.amount) || 0;

      if (e.type === 'credit') {
        totalCredit += amount;
        continue;
      }

      // type === 'debit'
      totalDebit += amount;
      debitCount += 1;

      const cat = e.category || 'other';
      if (!categoryMap[cat]) categoryMap[cat] = { total: 0, count: 0 };
      categoryMap[cat]!.total += amount;
      categoryMap[cat]!.count += 1;

      const payeeName = e.payee || 'Unknown';
      if (!payeeMap[payeeName]) payeeMap[payeeName] = { total: 0, count: 0, lastDate: e.txn_date };
      payeeMap[payeeName].total += amount;
      payeeMap[payeeName].count += 1;
      if (e.txn_date > payeeMap[payeeName].lastDate) payeeMap[payeeName].lastDate = e.txn_date;

      const weekday = new Date(e.txn_date + 'T00:00:00').getDay();
      if (!weekdayMap[weekday]) weekdayMap[weekday] = { total: 0, count: 0 };
      weekdayMap[weekday].total += amount;
      weekdayMap[weekday].count += 1;
    }

    const categories: CategorySlice[] = ALL_CATEGORIES
      .filter((cat) => categoryMap[cat])
      .map((cat) => ({
        category: cat,
        total: categoryMap[cat]!.total,
        count: categoryMap[cat]!.count,
        percentage: totalDebit > 0 ? (categoryMap[cat]!.total / totalDebit) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);

    const topPayees: PayeeStat[] = Object.entries(payeeMap)
      .map(([payee, stats]) => ({ payee, ...stats }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);

    const weekdayPattern: WeekdayStat[] = WEEKDAY_LABELS.map((label, weekday) => ({
      weekday,
      label,
      total: weekdayMap[weekday]?.total || 0,
      count: weekdayMap[weekday]?.count || 0,
    }));

    // Daily trend: always capped to a readable window regardless of range,
    // but respects a shorter range if one was explicitly selected.
    const trendDays = startDate
      ? Math.min(
          DAILY_TREND_CHART_CAP_DAYS,
          Math.round((Date.now() - new Date(startDate).getTime()) / 86_400_000) + 1
        )
      : DAILY_TREND_CHART_CAP_DAYS;

    const dailyMap: Record<string, { debit: number; credit: number }> = {};
    const trendStart = daysAgoISO(trendDays - 1);
    for (const e of allExpenses) {
      if (e.txn_date < trendStart) continue;
      if (!dailyMap[e.txn_date]) dailyMap[e.txn_date] = { debit: 0, credit: 0 };
      const amount = Number(e.amount) || 0;
      if (e.type === 'debit') dailyMap[e.txn_date].debit += amount;
      else dailyMap[e.txn_date].credit += amount;
    }

    const dailyTrend: DailyPoint[] = [];
    for (let i = trendDays - 1; i >= 0; i--) {
      const date = daysAgoISO(i);
      dailyTrend.push({ date, debit: dailyMap[date]?.debit || 0, credit: dailyMap[date]?.credit || 0 });
    }

    const monthComparison = computeMonthComparison(allExpenses);

    return {
      rangeLabel: RANGE_LABELS[range],
      totalDebit,
      totalCredit,
      net: totalCredit - totalDebit,
      avgTransaction: debitCount > 0 ? totalDebit / debitCount : 0,
      txnCount: debitCount,
      categories,
      dailyTrend,
      topPayees,
      weekdayPattern,
      monthComparison,
    };
  }, [allExpenses, range]);
}
