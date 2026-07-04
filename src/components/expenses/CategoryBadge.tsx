/**
 * Small icon+label pill representing an expense category, used in
 * transaction rows and category filter chips.
 */

import { CATEGORY_META } from '../../types/expense';
import type { ExpenseCategory } from '../../types/expense';

interface CategoryBadgeProps {
  category: ExpenseCategory;
  size?: 'sm' | 'md';
}

export function CategoryBadge({ category, size = 'md' }: CategoryBadgeProps) {
  const meta = CATEGORY_META[category] || CATEGORY_META.other;
  const dims = size === 'sm' ? 'w-7 h-7 text-sm' : 'w-9 h-9 text-base';

  return (
    <span
      className={`${dims} flex items-center justify-center rounded-full shrink-0`}
      style={{ backgroundColor: `${meta.color}20` }}
      title={meta.label}
    >
      {meta.icon}
    </span>
  );
}
