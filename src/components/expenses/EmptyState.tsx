/**
 * Consistent empty-state block used across expense tabs.
 */

interface EmptyStateProps {
  icon: string;
  message: string;
}

export function EmptyState({ icon, message }: EmptyStateProps) {
  return (
    <div className="text-center py-10">
      <span className="text-3xl mb-2 block">{icon}</span>
      <p className="text-sm text-slate-400 max-w-xs mx-auto">{message}</p>
    </div>
  );
}
