/**
 * Expense Tracker — type system (v3, full rebuild)
 * Completely independent from src/types/index.ts (the water tracker types).
 * Nothing in that file is read or modified by this feature.
 */

export type ExpenseType = 'debit' | 'credit';

export type ExpenseCategory =
  | 'food'
  | 'bills'
  | 'cash'
  | 'card'
  | 'shopping'
  | 'transfer'
  | 'income'
  | 'other';

export interface Expense {
  id: number;
  amount: number;
  payee: string | null;
  category: ExpenseCategory;
  txn_date: string; // YYYY-MM-DD
  upi_ref: string | null;
  raw_message: string;
  type: ExpenseType;
  source: 'regex' | 'gemini';
  created_at: string;
}

export interface SkippedMessage {
  id: number;
  raw_message: string;
  classification: string;
  source: 'regex' | 'gemini';
  received_at: string;
}

/**
 * A raw, not-yet-classified SMS row written directly by the iPhone
 * Automation into the `expense_inbox` table. The app reads these,
 * classifies them client-side, and deletes them once handled — mirroring
 * how the Water Tracker writes/reads directly against Supabase with no
 * backend server involved.
 */
export interface InboxMessage {
  id: number;
  raw_message: string;
  received_at: string;
}

// ============================================================================
// Client-side classification pipeline (src/lib/expenseParser.ts)
// ============================================================================

export type ParseStage = 'reject_rule' | 'extract_rule' | 'gemini_fallback' | 'unmatched_default';

export interface ParseMeta {
  stage: ParseStage;
  ruleName: string | null;
}

export type NonTransactionReason =
  | 'bill_reminder'
  | 'failed_autopay'
  | 'statement_notice'
  | 'noise';

export interface ParsedTransaction {
  classification: 'actual_debit' | 'actual_credit';
  amount: number;
  payee: string | null;
  category: ExpenseCategory;
  txn_date: string;
  upi_ref: string | null;
  source: 'regex' | 'gemini';
  meta: ParseMeta;
}

export interface ParsedNonTransaction {
  classification: 'not_a_transaction';
  reason: NonTransactionReason;
  source: 'regex' | 'gemini';
  meta: ParseMeta;
}

export type ParseResult = ParsedTransaction | ParsedNonTransaction;

/** Summary returned after a full inbox processing pass. */
export interface ProcessInboxResult {
  totalPending: number;
  debitsLogged: number;
  creditsLogged: number;
  duplicatesIgnored: number;
  skippedNonTransactional: number;
  leftInInboxDueToError: number;
  errors: string[];
}

export const CATEGORY_META: Record<ExpenseCategory, { label: string; icon: string; color: string }> = {
  food: { label: 'Food & Dining', icon: '🍔', color: '#f97316' },
  bills: { label: 'Bills & Utilities', icon: '🧾', color: '#8b5cf6' },
  cash: { label: 'Cash Withdrawal', icon: '🏧', color: '#64748b' },
  card: { label: 'Card Payment', icon: '💳', color: '#ec4899' },
  shopping: { label: 'Shopping', icon: '🛍️', color: '#3b82f6' },
  transfer: { label: 'Transfers', icon: '💸', color: '#06b6d4' },
  income: { label: 'Income', icon: '💰', color: '#10b981' },
  other: { label: 'Other', icon: '📦', color: '#94a3b8' },
};

export const ALL_CATEGORIES: ExpenseCategory[] = [
  'food', 'bills', 'cash', 'card', 'shopping', 'transfer', 'income', 'other',
];

// ============================================================================
// Filters (used by the Transactions tab)
// ============================================================================

export type ExpenseTypeFilter = 'all' | ExpenseType;
export type ExpenseCategoryFilter = 'all' | ExpenseCategory;

export interface ExpenseFilters {
  type: ExpenseTypeFilter;
  category: ExpenseCategoryFilter;
  search: string;
}

// ============================================================================
// Analytics (used by the Overview & Analytics tabs)
// ============================================================================

export type AnalyticsRange = '7d' | '30d' | '90d' | 'month' | 'all';

export interface CategorySlice {
  category: ExpenseCategory;
  total: number;
  count: number;
  percentage: number; // 0-100, share of total debit spend in range
}

export interface DailyPoint {
  date: string; // YYYY-MM-DD
  debit: number;
  credit: number;
}

export interface PayeeStat {
  payee: string;
  total: number;
  count: number;
  lastDate: string;
}

export interface WeekdayStat {
  weekday: number; // 0 = Sunday .. 6 = Saturday
  label: string; // "Sun", "Mon", ...
  total: number;
  count: number;
}

export interface MonthComparison {
  currentMonthTotal: number;
  previousMonthTotal: number;
  changePct: number | null; // null when previous month had zero spend
}

export interface ExpenseAnalytics {
  rangeLabel: string;
  totalDebit: number;
  totalCredit: number;
  net: number;
  avgTransaction: number;
  txnCount: number;
  categories: CategorySlice[];
  dailyTrend: DailyPoint[];
  topPayees: PayeeStat[];
  weekdayPattern: WeekdayStat[];
  monthComparison: MonthComparison;
}
