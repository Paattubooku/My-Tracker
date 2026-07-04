/**
 * Parser Lab tab — v4 (no backend)
 *
 * Two things live here now:
 *   1. Inbox status + a manual "Process Inbox Now" button. The inbox is
 *      populated by your iPhone Automation writing directly to Supabase's
 *      expense_inbox table (see the setup guide at the bottom). Processing
 *      happens entirely client-side via src/lib/expenseParser.ts — no
 *      webhook, no server, no secret keys.
 *   2. A dry-run tester: paste any SMS and see exactly how the pipeline
 *      would classify it, WITHOUT writing to Supabase. This calls
 *      classifyMessage() directly as a plain function call — no network
 *      request, no deployment required, works immediately even in local
 *      dev.
 */

import { useEffect, useState } from 'react';
import { classifyMessage, type ParseResult } from '../../lib/expenseParser';
import { getSkippedMessagesCount, getInboxCount, addToInbox, processInbox } from '../../lib/expenses';
import type { ProcessInboxResult } from '../../types/expense';

const SAMPLE_MESSAGES = [
  'ICICI Bank Acct XX219 debited for Rs 40.00 on 01-Jun-26; HOT N SPICY credited. UPI:651870302957. Call 18002662 for dispute. SMS BLOCK 219 to 9215676766',
  'Dear Customer, Acct XX219 is credited with Rs 16.80 on 01-Jun-26 from supermoney. UPI:615210447014-ICICI Bank.',
  'ACTFIBER bill of Rs 1237.82 for 108863157766 due on 2026-06-15, will be auto-debited on 2026-06-12-ICICI Bank.',
  'Your account is not debited with Rs 5000.00 towards AuraGold for Autopay due to cbs rejection 0116, RRN 705667557146-ICICI Bank.',
  'Rs. 2,000.00 cardless withdrawal at ICICI Bank ATM on 10-Jun-26. Info: CCW*27801HHR*14970530*6723*C. To dispute call 18002662 or SMS BLOCK 219 to 9215676766',
  'INR 1,237.82 spent using ICICI Bank Card XX8006 on 12-Jun-26 on ICICI BILL PAY. Avl Limit: INR 1,27,524.36. If not you, call 1800 2662/SMS BLOCK 8006 to 9215676766',
  'ICICI Bank Credit Card XX8006 Statement is sent to th***********98@gmail.com. Total of Rs 1,237.82 or minimum of Rs 100.00 is due by 20-JUN-26.',
];

const STAGE_LABELS: Record<string, string> = {
  reject_rule: '🚫 Stage A — Rejected (regex)',
  extract_rule: '⚡ Stage B — Extracted (regex)',
  gemini_fallback: '🤖 Stage C — Gemini Flash',
  unmatched_default: '❓ Unmatched (no Gemini key)',
};

interface ParserLabTabProps {
  onInboxProcessed: () => void;
}

export function ParserLabTab({ onInboxProcessed }: ParserLabTabProps) {
  const [skippedCount, setSkippedCount] = useState<number | null>(null);
  const [inboxCount, setInboxCount] = useState<number | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [processResult, setProcessResult] = useState<ProcessInboxResult | null>(null);

  const [testMessage, setTestMessage] = useState('');
  const [testResult, setTestResult] = useState<ParseResult | { error: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const [inboxMessage, setInboxMessage] = useState('');
  const [isAddingToInbox, setIsAddingToInbox] = useState(false);

  const refreshCounts = () => {
    getSkippedMessagesCount().then(setSkippedCount).catch(() => setSkippedCount(null));
    getInboxCount().then(setInboxCount).catch(() => setInboxCount(null));
  };

  useEffect(() => {
    refreshCounts();
  }, []);

  const runInboxProcessing = async () => {
    setIsProcessing(true);
    setProcessResult(null);
    try {
      const result = await processInbox();
      setProcessResult(result);
      refreshCounts();
      onInboxProcessed();
    } catch (err) {
      setProcessResult({
        totalPending: 0,
        debitsLogged: 0,
        creditsLogged: 0,
        duplicatesIgnored: 0,
        skippedNonTransactional: 0,
        leftInInboxDueToError: 0,
        errors: [err instanceof Error ? err.message : 'Unknown error while processing inbox'],
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const runDryRunTest = async () => {
    if (!testMessage.trim()) return;
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await classifyMessage(testMessage);
      setTestResult(result);
    } catch (err) {
      setTestResult({ error: err instanceof Error ? err.message : 'Classification failed' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleAddToInbox = async () => {
    if (!inboxMessage.trim()) return;
    setIsAddingToInbox(true);
    try {
      await addToInbox(inboxMessage.trim());
      setInboxMessage('');
      refreshCounts();
    } catch (err) {
      console.error('Failed to add to inbox:', err);
    } finally {
      setIsAddingToInbox(false);
    }
  };

  const classificationColor = (classification?: string) => {
    if (classification === 'actual_debit') return 'text-red-600 bg-red-50';
    if (classification === 'actual_credit') return 'text-emerald-600 bg-emerald-50';
    return 'text-slate-500 bg-slate-100';
  };

  return (
    <div className="space-y-6">
      {/* Inbox status + processing */}
      <div className="bg-violet-50 border border-violet-100 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <p className="text-sm font-medium text-violet-800">📥 SMS Inbox</p>
            <p className="text-xs text-violet-600 mt-0.5">
              {inboxCount === null ? 'Loading…' : `${inboxCount} message${inboxCount === 1 ? '' : 's'} waiting to be classified`}
            </p>
          </div>
          <button
            onClick={runInboxProcessing}
            disabled={isProcessing}
            className="px-4 py-2 bg-violet-500 text-white text-sm font-medium rounded-lg hover:bg-violet-600 active:scale-95 transition-all disabled:opacity-50"
          >
            {isProcessing ? 'Processing…' : 'Process Inbox Now'}
          </button>
        </div>

        {processResult && (
          <div className="bg-white rounded-lg p-3 text-xs space-y-1">
            <p className="text-slate-600">
              Processed <strong>{processResult.totalPending}</strong> pending message
              {processResult.totalPending === 1 ? '' : 's'}:
            </p>
            <ul className="text-slate-500 space-y-0.5 pl-4 list-disc">
              {processResult.debitsLogged > 0 && <li className="text-red-600">{processResult.debitsLogged} debit(s) logged</li>}
              {processResult.creditsLogged > 0 && <li className="text-emerald-600">{processResult.creditsLogged} credit(s) logged</li>}
              {processResult.duplicatesIgnored > 0 && <li>{processResult.duplicatesIgnored} duplicate(s) ignored</li>}
              {processResult.skippedNonTransactional > 0 && <li>{processResult.skippedNonTransactional} non-transactional message(s) skipped</li>}
              {processResult.leftInInboxDueToError > 0 && (
                <li className="text-amber-600">
                  {processResult.leftInInboxDueToError} left in inbox for retry (see errors below)
                </li>
              )}
            </ul>
            {processResult.errors.length > 0 && (
              <div className="mt-2 pt-2 border-t border-slate-100 space-y-1">
                {processResult.errors.map((e, i) => (
                  <p key={i} className="text-red-500">⚠️ {e}</p>
                ))}
              </div>
            )}
          </div>
        )}

        {skippedCount !== null && (
          <p className="text-xs text-violet-500">
            🗂️ {skippedCount} non-transactional message{skippedCount === 1 ? '' : 's'} archived overall
          </p>
        )}
      </div>

      {/* Manually add a message to the inbox (test the full pipeline end-to-end) */}
      <div className="space-y-2">
        <label className="block text-xs font-medium text-slate-500">
          Add a message to the inbox (simulates the iPhone Automation)
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={inboxMessage}
            onChange={(e) => setInboxMessage(e.target.value)}
            placeholder="Paste an SMS to add to the real inbox…"
            className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-all font-mono"
          />
          <button
            onClick={handleAddToInbox}
            disabled={isAddingToInbox || !inboxMessage.trim()}
            className="px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-900 transition-all disabled:opacity-50 whitespace-nowrap"
          >
            {isAddingToInbox ? 'Adding…' : 'Add to Inbox'}
          </button>
        </div>
      </div>

      <div className="border-t border-slate-100 pt-6">
        <h4 className="text-sm font-semibold text-slate-700 mb-1">🧪 Dry-Run Tester</h4>
        <p className="text-xs text-slate-400 mb-3">
          Classifies instantly in your browser — never touches the database.
        </p>

        <textarea
          value={testMessage}
          onChange={(e) => setTestMessage(e.target.value)}
          rows={3}
          placeholder="Paste a raw ICICI Bank SMS here…"
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-mono mb-2"
        />

        <div className="flex flex-wrap gap-2 mb-3">
          {SAMPLE_MESSAGES.map((sample, i) => (
            <button
              key={i}
              onClick={() => setTestMessage(sample)}
              className="text-xs px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors"
            >
              Sample #{i + 1}
            </button>
          ))}
        </div>

        <button
          onClick={runDryRunTest}
          disabled={isTesting || !testMessage.trim()}
          className="w-full py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium rounded-xl hover:from-blue-600 hover:to-cyan-600 active:scale-95 transition-all disabled:opacity-50"
        >
          {isTesting ? 'Classifying…' : 'Test Parse (no DB write)'}
        </button>

        {testResult && (
          <div className="mt-3 border border-slate-100 rounded-xl overflow-hidden">
            {'error' in testResult ? (
              <div className="p-3 text-sm text-red-600 bg-red-50">⚠️ {testResult.error}</div>
            ) : (
              <>
                <div className="p-3 bg-slate-50 flex items-center justify-between flex-wrap gap-2">
                  <span className="text-sm font-medium text-slate-700">Result</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${classificationColor(testResult.classification)}`}>
                      {testResult.classification}
                    </span>
                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-slate-200 text-slate-600">
                      {STAGE_LABELS[testResult.meta.stage] || testResult.meta.stage}
                    </span>
                  </div>
                </div>
                {testResult.meta.ruleName && (
                  <div className="px-3 pt-2 text-xs text-slate-500">
                    Matched rule: <code className="bg-slate-100 px-1.5 py-0.5 rounded">{testResult.meta.ruleName}</code>
                  </div>
                )}
                <pre className="p-3 text-xs text-slate-100 bg-slate-900 overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(testResult, null, 2)}
                </pre>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
