/**
 * Reminder notification display
 */

import { useState } from 'react';
import type { ReminderCheckResponse, ReminderCheckRemindResponse } from '../types';

interface ReminderNotificationProps {
  result: ReminderCheckResponse | null;
  onCheck: () => void;
}

export function ReminderNotification({ result, onCheck }: ReminderNotificationProps) {
  const [showDetails, setShowDetails] = useState(false);

  const isRemind = result && result.remind === true;
  const remindResult = result as ReminderCheckRemindResponse | null;

  const reasonMessages: Record<string, string> = {
    disabled: 'Reminders are currently disabled',
    sleeping: '😴 Sleeping hours - no reminders needed',
    goal_reached: '🎉 Daily goal achieved!',
    cooldown_active: `⏳ Next reminder in ${result && 'next_check_advisable_mins' in result ? result.next_check_advisable_mins : '?'} mins`,
    on_track: '✅ You are on track with hydration',
  };

  return (
    <div className="w-full bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Header */}
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔔</span>
            <span className="font-semibold text-slate-800">Reminder Status</span>
          </div>
          <button
            onClick={onCheck}
            className="px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-xl 
              hover:bg-blue-600 active:scale-95 transition-all"
          >
            Check Now
          </button>
        </div>

        {result ? (
          <div>
            {isRemind && remindResult ? (
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-100">
                <div className="flex items-start gap-3">
                  <span className="text-3xl">{remindResult.urgency === 'high' ? '🔴' : '🚰'}</span>
                  <div className="flex-1">
                    <h4 className="font-semibold text-slate-800">{remindResult.title}</h4>
                    <p className="text-slate-600 mt-1">{remindResult.message}</p>
                    <button
                      onClick={() => setShowDetails(!showDetails)}
                      className="text-sm text-blue-600 hover:text-blue-700 mt-2 underline"
                    >
                      {showDetails ? 'Hide Details' : 'Show Details'}
                    </button>
                  </div>
                </div>

                {showDetails && (
                  <div className="mt-4 pt-4 border-t border-amber-100 grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-white/50 p-3 rounded-lg">
                      <span className="text-slate-500 block">Today's Intake</span>
                      <span className="font-semibold text-slate-800">
                        {remindResult.metrics.today_total_ml} ml
                      </span>
                    </div>
                    <div className="bg-white/50 p-3 rounded-lg">
                      <span className="text-slate-500 block">Expected</span>
                      <span className="font-semibold text-slate-800">
                        {remindResult.metrics.expected_by_now_ml} ml
                      </span>
                    </div>
                    <div className="bg-white/50 p-3 rounded-lg">
                      <span className="text-slate-500 block">Gap</span>
                      <span className="font-semibold text-red-600">
                        {remindResult.metrics.gap_ml} ml
                      </span>
                    </div>
                    <div className="bg-white/50 p-3 rounded-lg">
                      <span className="text-slate-500 block">Progress</span>
                      <span className="font-semibold text-slate-800">
                        {remindResult.metrics.percentage_complete}%
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ) : result ? (
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">😴</span>
                  <p className="text-slate-600">
                    {reasonMessages[result.reason] || result.reason}
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-slate-500 mb-2">Click "Check Now" to test the reminder engine</p>
            <p className="text-xs text-slate-400">
              This simulates the GET /api/v1/reminder/check endpoint
            </p>
          </div>
        )}
      </div>

      {/* API Response Preview */}
      {result && (
        <div className="border-t border-slate-100">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="w-full px-6 py-3 text-left text-sm text-slate-500 hover:bg-slate-50 transition-colors flex items-center justify-between"
          >
            <span>View API Response</span>
            <svg
              className={`w-4 h-4 transition-transform ${showDetails ? 'rotate-180' : ''}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {showDetails && (
            <pre className="px-6 pb-4 text-xs text-slate-600 bg-slate-50 overflow-x-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
