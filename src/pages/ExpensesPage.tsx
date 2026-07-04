/**
 * ExpensesPage — full-page Expense Tracker experience.
 *
 * Owns the single shared data fetch (useExpenseData) and renders one of
 * four internal tabs: Overview, Transactions, Analytics, Parser Lab. All
 * tabs read from the same in-memory expense list, so switching tabs is
 * instant with no extra network calls.
 *
 * Architecture note: there is no backend for this feature. useExpenseData
 * automatically processes any pending expense_inbox rows (written directly
 * by the iPhone Automation via Supabase's REST API) every time this page
 * loads or is refreshed — exactly mirroring how the Water Tracker reads
 * and writes directly against Supabase with the anon key.
 */

import { useState } from 'react';
import { useExpenseData } from '../hooks/useExpenseData';
import { OverviewTab } from '../components/expenses/OverviewTab';
import { TransactionsTab } from '../components/expenses/TransactionsTab';
import { AnalyticsTab } from '../components/expenses/AnalyticsTab';
import { ParserLabTab } from '../components/expenses/ParserLabTab';
import type { ExpenseCategory, ExpenseCategoryFilter } from '../types/expense';

type ExpenseTab = 'overview' | 'transactions' | 'analytics' | 'parser';

const TABS: Array<{ id: ExpenseTab; label: string; icon: string }> = [
  { id: 'overview', label: 'Overview', icon: '📊' },
  { id: 'transactions', label: 'Transactions', icon: '📋' },
  { id: 'analytics', label: 'Analytics', icon: '📈' },
  { id: 'parser', label: 'Parser Lab', icon: '🧬' },
];

export default function ExpensesPage() {
  const { expenses, isLoading, isProcessing, error, lastProcessResult, refresh } = useExpenseData();
  const [activeTab, setActiveTab] = useState<ExpenseTab>('overview');
  const [pendingCategory, setPendingCategory] = useState<ExpenseCategoryFilter>('all');

  const jumpToTransactions = (category?: ExpenseCategory) => {
    if (category) setPendingCategory(category);
    setActiveTab('transactions');
  };

  const newlyLogged = lastProcessResult
    ? lastProcessResult.debitsLogged + lastProcessResult.creditsLogged
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-purple-50 to-fuchsia-50">
      {/* Page header */}
      <header className="sticky top-14 z-40 backdrop-blur-lg bg-white/80 border-b border-slate-200">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">💳</span>
            <div>
              <h1 className="text-xl font-bold text-slate-800">Expense Tracker</h1>
              <p className="text-xs text-slate-500">Auto-logged from ICICI Bank SMS</p>
            </div>
          </div>
          <button
            onClick={() => refresh()}
            disabled={isProcessing}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
            title="Refresh & process inbox"
          >
            <svg
              className={`w-5 h-5 ${isProcessing ? 'animate-spin' : ''}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                d="M4 4v5h5M20 20v-5h-5M4 9a8 8 0 0114-4.9M20 15a8 8 0 01-14 4.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        {/* Tab navigation */}
        <div className="max-w-lg mx-auto px-4 pb-3 flex gap-1.5 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-2 text-sm font-medium rounded-xl transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === tab.id
                  ? 'bg-violet-500 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {isProcessing && (
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-3 flex items-center gap-3 text-sm text-blue-700">
            <span className="animate-spin text-lg">⏳</span>
            Checking for new SMS messages…
          </div>
        )}

        {!isProcessing && newlyLogged > 0 && (
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3 flex items-center gap-3 text-sm text-emerald-700">
            <span className="text-lg">✅</span>
            Logged {newlyLogged} new transaction{newlyLogged === 1 ? '' : 's'} from your inbox
          </div>
        )}

        {isLoading && <div className="text-center py-16 text-slate-400 text-sm">Loading expenses…</div>}

        {error && !isLoading && (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-sm text-red-600">{error}</div>
        )}

        {!isLoading && !error && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            {activeTab === 'overview' && (
              <OverviewTab
                expenses={expenses}
                onViewAllTransactions={() => jumpToTransactions()}
                onExpenseAdded={() => refresh({ skipInboxProcessing: true })}
              />
            )}
            {activeTab === 'transactions' && (
              <TransactionsTab
                expenses={expenses}
                initialCategory={pendingCategory}
                onInitialCategoryConsumed={() => setPendingCategory('all')}
                onExpenseDeleted={() => refresh({ skipInboxProcessing: true })}
              />
            )}
            {activeTab === 'analytics' && (
              <AnalyticsTab expenses={expenses} onCategoryClick={(cat) => jumpToTransactions(cat)} />
            )}
            {activeTab === 'parser' && <ParserLabTab onInboxProcessed={() => refresh()} />}
          </div>
        )}

        <footer className="text-center py-8 text-slate-400 text-sm">
          <p>Expense Tracker • No backend — the app talks to Supabase directly</p>
          <p className="mt-1 text-xs">1-year retention • Deduped by UPI reference</p>
        </footer>
      </main>
    </div>
  );
}
