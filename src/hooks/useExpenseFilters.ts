/**
 * useExpenseFilters — filter/search state for the Transactions tab.
 * Pure client-side filtering over the already-fetched expense list from
 * useExpenseData, so switching filters never triggers a new network call.
 */

import { useMemo, useState } from 'react';
import type { Expense, ExpenseCategoryFilter, ExpenseTypeFilter } from '../types/expense';

export function useExpenseFilters(expenses: Expense[]) {
  const [type, setType] = useState<ExpenseTypeFilter>('all');
  const [category, setCategory] = useState<ExpenseCategoryFilter>('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    return expenses.filter((expense) => {
      if (type !== 'all' && expense.type !== type) return false;
      if (category !== 'all' && expense.category !== category) return false;
      if (term && !(expense.payee || '').toLowerCase().includes(term)) return false;
      return true;
    });
  }, [expenses, type, category, search]);

  const clearFilters = () => {
    setType('all');
    setCategory('all');
    setSearch('');
  };

  const hasActiveFilters = type !== 'all' || category !== 'all' || search.trim() !== '';

  return {
    filtered,
    type,
    setType,
    category,
    setCategory,
    search,
    setSearch,
    clearFilters,
    hasActiveFilters,
  };
}
