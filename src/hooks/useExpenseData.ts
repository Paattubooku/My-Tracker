/**
 * useExpenseData — fetches the expense list AND auto-processes any pending
 * inbox messages every time the app loads or refresh() is called. This is
 * the single source of truth for expense rows; filtering
 * (useExpenseFilters) and analytics (useExpenseAnalytics) both derive from
 * this same dataset so every tab stays consistent.
 *
 * This mirrors useHydration.ts's background-cleanup pattern: inbox
 * processing is best-effort and wrapped so a failure here never blocks or
 * breaks the rest of the page — it just means unprocessed messages will be
 * retried on the next refresh.
 */

import { useState, useEffect, useCallback } from 'react';
import type { Expense, ProcessInboxResult } from '../types/expense';
import { getExpenses, processInbox } from '../lib/expenses';

export function useExpenseData() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastProcessResult, setLastProcessResult] = useState<ProcessInboxResult | null>(null);

  const refresh = useCallback(async (options?: { skipInboxProcessing?: boolean }) => {
    try {
      if (!options?.skipInboxProcessing) {
        setIsProcessing(true);
        try {
          const result = await processInbox();
          setLastProcessResult(result);
        } catch (err) {
          // Non-fatal: inbox processing failing should never block viewing
          // existing expense data. Pending messages simply retry next time.
          console.error('Inbox processing failed:', err);
        } finally {
          setIsProcessing(false);
        }
      }

      const data = await getExpenses(1000);
      setExpenses(data);
      setError(null);
    } catch (err) {
      console.error('Failed to load expenses:', err);
      setError(err instanceof Error ? err.message : 'Failed to load expenses');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { expenses, isLoading, isProcessing, error, lastProcessResult, refresh };
}
