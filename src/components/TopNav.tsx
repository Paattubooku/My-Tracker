/**
 * TopNav — app-level view switcher between the Hydration tracker and the
 * Expense tracker. This is the only new piece of "chrome" introduced above
 * the water tracker's own (untouched) header.
 */

export type AppView = 'hydration' | 'expenses';

interface TopNavProps {
  activeView: AppView;
  onChange: (view: AppView) => void;
}

export function TopNav({ activeView, onChange }: TopNavProps) {
  return (
    <nav className="sticky top-0 z-50 h-14 bg-slate-900 flex items-center">
      <div className="max-w-lg mx-auto w-full px-4 flex items-center gap-2">
        <button
          onClick={() => onChange('hydration')}
          className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
            activeView === 'hydration'
              ? 'bg-white text-slate-900'
              : 'text-slate-300 hover:bg-slate-800'
          }`}
        >
          <span>💧</span> Hydration
        </button>
        <button
          onClick={() => onChange('expenses')}
          className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
            activeView === 'expenses'
              ? 'bg-white text-slate-900'
              : 'text-slate-300 hover:bg-slate-800'
          }`}
        >
          <span>💳</span> Expenses
        </button>
      </div>
    </nav>
  );
}
