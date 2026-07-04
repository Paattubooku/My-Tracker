/**
 * AddExpenseForm — manual expense entry, mirroring the Water Tracker's
 * quick-add-water buttons. Useful for cash spends or any transaction your
 * bank doesn't send an SMS for. Writes directly to Supabase via the anon
 * key (addManualExpense in src/lib/expenses.ts) — no backend involved.
 */

import { useState } from 'react';
import { addManualExpense } from '../../lib/expenses';
import { ALL_CATEGORIES, CATEGORY_META } from '../../types/expense';
import type { ExpenseCategory, ExpenseType } from '../../types/expense';

interface AddExpenseFormProps {
  onAdded: () => void;
}

export function AddExpenseForm({ onAdded }: AddExpenseFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [payee, setPayee] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('other');
  const [type, setType] = useState<ExpenseType>('debit');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setAmount('');
    setPayee('');
    setCategory('other');
    setType('debit');
    setError(null);
  };

  const handleSubmit = async () => {
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Enter a valid amount greater than 0.');
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await addManualExpense({
        amount: parsedAmount,
        payee: payee.trim() || (type === 'debit' ? 'Manual Expense' : 'Manual Income'),
        category,
        type,
      });
      reset();
      setIsOpen(false);
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save expense.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="w-full py-3 bg-gradient-to-r from-violet-500 to-purple-500 text-white font-medium rounded-xl hover:from-violet-600 hover:to-purple-600 active:scale-95 transition-all flex items-center justify-center gap-2"
      >
        <span className="text-lg">+</span> Add Expense Manually
      </button>
    );
  }

  return (
    <div className="bg-slate-50 rounded-2xl p-4 space-y-3 border border-slate-100">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-700">Add Expense Manually</h4>
        <button
          onClick={() => {
            setIsOpen(false);
            reset();
          }}
          className="text-slate-400 hover:text-slate-600 text-sm"
        >
          ✕
        </button>
      </div>

      <div className="flex gap-2">
        {(['debit', 'credit'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              type === t ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 border border-slate-200'
            }`}
          >
            {t === 'debit' ? '↗️ Spent' : '↘️ Received'}
          </button>
        ))}
      </div>

      <input
        type="number"
        inputMode="decimal"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Amount (₹)"
        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-all"
      />

      <input
        type="text"
        value={payee}
        onChange={(e) => setPayee(e.target.value)}
        placeholder="Payee / description"
        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-all"
      />

      <div className="flex flex-wrap gap-1.5">
        {ALL_CATEGORIES.map((cat) => {
          const meta = CATEGORY_META[cat];
          return (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-2.5 py-1 text-xs font-medium rounded-full transition-colors flex items-center gap-1 ${
                category === cat ? 'text-white' : 'bg-white text-slate-600 border border-slate-200'
              }`}
              style={category === cat ? { backgroundColor: meta.color } : undefined}
            >
              <span>{meta.icon}</span>
              {meta.label}
            </button>
          );
        })}
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={isSaving}
        className="w-full py-2.5 bg-violet-500 text-white text-sm font-medium rounded-lg hover:bg-violet-600 active:scale-95 transition-all disabled:opacity-50"
      >
        {isSaving ? 'Saving…' : 'Save Expense'}
      </button>
    </div>
  );
}
