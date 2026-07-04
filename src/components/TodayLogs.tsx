/**
 * Today's water intake log history
 */

import type { WaterLog } from '../types';

interface TodayLogsProps {
  logs: WaterLog[];
  onUndoLast: () => void;
}

export function TodayLogs({ logs, onUndoLast }: TodayLogsProps) {
  if (logs.length === 0) {
    return (
      <div className="w-full bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800">Today's Log</h3>
        </div>
        <div className="text-center py-8">
          <span className="text-4xl mb-3 block">💧</span>
          <p className="text-slate-500">No water logged yet today</p>
          <p className="text-sm text-slate-400 mt-1">Use the buttons above to start tracking!</p>
        </div>
      </div>
    );
  }

  const sortedLogs = [...logs].sort(
    (a, b) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime()
  );

  const formatTime = (isoString: string): string => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="w-full bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-800">Today's Log</h3>
        {logs.length > 0 && (
          <button
            onClick={onUndoLast}
            className="text-sm text-red-500 hover:text-red-600 hover:bg-red-50 
              px-3 py-1 rounded-lg transition-colors flex items-center gap-1"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 10h10a5 5 0 0 1 0 10H9" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M3 10l4-4M3 10l4 4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Undo Last
          </button>
        )}
      </div>

      <div className="space-y-3 max-h-64 overflow-y-auto">
        {sortedLogs.map((log, index) => (
          <div
            key={log.id}
            className={`flex items-center justify-between p-3 rounded-xl ${
              index === 0 ? 'bg-blue-50 border border-blue-100' : 'bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">
                {log.amount_ml >= 500 ? '🧴' : log.amount_ml >= 250 ? '☕' : '💧'}
              </span>
              <div>
                <span className="font-semibold text-slate-700">{log.amount_ml} ml</span>
                {index === 0 && (
                  <span className="ml-2 text-xs text-blue-600 font-medium">Latest</span>
                )}
              </div>
            </div>
            <span className="text-sm text-slate-500">{formatTime(log.logged_at)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
