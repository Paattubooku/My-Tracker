/**
 * Transactions tab — full filterable/searchable transaction list.
 * Supports an externally-controlled initial category (so the Analytics tab
 * can deep-link "show me all Food transactions" into this tab), and
 * per-row deletion (e.g. to remove a misclassified entry) writing directly
 * to Supabase via the anon key — no backend involved.
 */

import { useEffect, useState } from 'react';
import type { Expense, ExpenseCategoryFilter } from '../../types/expense';
import { CATEGORY_META, ALL_CATEGORIES } from '../../types/expense';
import { useExpenseFilters } from '../../hooks/useExpenseFilters';
import { deleteExpense } from '../../lib/expenses';
import { CategoryBadge } from './CategoryBadge';
import { EmptyState } from './EmptyState';

interface TransactionsTabProps {
  expenses: Expense[];
  initialCategory: ExpenseCategoryFilter;
  onInitialCategoryConsumed: () => void;
  onExpenseDeleted: () => void;
}

function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const PAGE_SIZE = 15;

export function TransactionsTab({
  expenses,
  initialCategory,
  onInitialCategoryConsumed,
  onExpenseDeleted,
}: TransactionsTabProps) {
  const {
    filtered, type, setType, category, setCategory, search, setSearch, clearFilters, hasActiveFilters,
  } = useExpenseFilters(expenses);

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Apply a category pushed in from the Analytics tab exactly once.
  useEffect(() => {
    if (initialCategory !== 'all') {
      setCategory(initialCategory);
      onInitialCategoryConsumed();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCategory]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [type, category, search]);

  const visible = filtered.slice(0, visibleCount);

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await deleteExpense(id);
      onExpenseDeleted();
    } catch (err) {
      console.error('Failed to delete expense:', err);
    } finally {
      setDeletingId(null);
      setPendingDeleteId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Type filter chips */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'debit', 'credit'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
              type === t ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {t === 'all' ? 'All' : t === 'debit' ? 'Spent' : 'Received'}
          </button>
        ))}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="px-3 py-1.5 text-xs font-medium rounded-full text-red-500 hover:bg-red-50 transition-colors ml-auto"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Category filter chips */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setCategory('all')}
          className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
            category === 'all' ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          All Categories
        </button>
        {ALL_CATEGORIES.map((cat) => {
          const meta = CATEGORY_META[cat];
          return (
            <button
              key={cat}
              onClick={() => setCategory(category === cat ? 'all' : cat)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors flex items-center gap-1 ${
                category === cat ? 'text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
              style={category === cat ? { backgroundColor: meta.color } : undefined}
            >
              <span>{meta.icon}</span>
              {meta.label}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by payee…"
        className="w-full px-4 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
      />

      {/* Result count */}
      <p className="text-xs text-slate-400">
        Showing {Math.min(visible.length, filtered.length)} of {filtered.length}
        {hasActiveFilters ? ` (filtered from ${expenses.length})` : ''} transactions
      </p>

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState
          icon="🔍"
          message={
            expenses.length === 0
              ? 'No transactions yet — add one manually in the Overview tab, or set up the iPhone Automation.'
              : 'No transactions match your filters.'
          }
        />
      ) : (
        <div className="space-y-2">
          {visible.map((expense) => (
            <div key={expense.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <CategoryBadge category={expense.category} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{expense.payee || 'Unknown'}</p>
                  <p className="text-xs text-slate-400">
                    {formatDate(expense.txn_date)} • {CATEGORY_META[expense.category]?.label || 'Other'}
                  </p>
                  {expense.upi_ref && (
                    <p className="text-[10px] text-slate-300 font-mono truncate">Ref: {expense.upi_ref}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={`text-sm font-semibold whitespace-nowrap ${
                    expense.type === 'debit' ? 'text-red-600' : 'text-emerald-600'
                  }`}
                >
                  {expense.type === 'debit' ? '-' : '+'}
                  {formatCurrency(expense.amount)}
                </span>

                {pendingDeleteId === expense.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDelete(expense.id)}
                      disabled={deletingId === expense.id}
                      className="text-xs px-2 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                    >
                      {deletingId === expense.id ? '…' : 'Confirm'}
                    </button>
                    <button
                      onClick={() => setPendingDeleteId(null)}
                      className="text-xs px-2 py-1 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setPendingDeleteId(expense.id)}
                    className="text-slate-300 hover:text-red-500 transition-colors p-1"
                    title="Delete"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0l-1 14a2 2 0 01-2 2H7a2 2 0 01-2-2L4 6h16z" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {visibleCount < filtered.length && (
        <button
          onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
          className="w-full py-2.5 text-sm text-blue-600 hover:text-blue-700 font-medium bg-blue-50 rounded-xl transition-colors"
        >
          Load More ({filtered.length - visibleCount} remaining)
        </button>
      )}
    </div>
  );
}
