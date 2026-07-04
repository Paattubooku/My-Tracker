/**
 * Quick water intake amount buttons
 */

interface QuickAddButtonsProps {
  onAdd: (amount: number) => void;
  disabled?: boolean;
}

const AMOUNTS = [100, 150, 200, 250, 350, 500];

const AMOUNT_ICONS: Record<number, string> = {
  100: '🥛',
  150: '🥤',
  200: '🍶',
  250: '☕',
  350: '🫗',
  500: '🧴',
};

export function QuickAddButtons({ onAdd, disabled = false }: QuickAddButtonsProps) {
  return (
    <div className="w-full">
      <h3 className="text-sm font-medium text-slate-600 mb-3">Quick Add Water</h3>
      <div className="grid grid-cols-3 gap-3">
        {AMOUNTS.map((amount) => (
          <button
            key={amount}
            onClick={() => onAdd(amount)}
            disabled={disabled}
            className="group relative flex flex-col items-center justify-center p-4 bg-white border-2 border-slate-100 
              rounded-2xl hover:border-blue-400 hover:bg-blue-50 active:scale-95 
              transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="text-2xl mb-1">{AMOUNT_ICONS[amount]}</span>
            <span className="text-lg font-semibold text-slate-700 group-hover:text-blue-600">
              {amount} ml
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
