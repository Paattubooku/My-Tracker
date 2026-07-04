/**
 * Expense Tracker data layer — v4 (no backend, direct Supabase access)
 *
 * This mirrors src/lib/supabase.ts (the Water Tracker's data layer)
 * exactly: every function here reads AND writes directly against Supabase
 * using the same anon-key client (getSupabaseClient()), with no server, no
 * webhook, and no separate secret key. Row Level Security on
 * expense_inbox/expenses/expense_skipped_messages allows all operations
 * for the anon role (see supabase-expenses-setup.sql), exactly like
 * water_logs/settings/reminder_logs already do.
 */

import { getSupabaseClient } from './supabase';
import { classifyMessage, ClassificationError } from './expenseParser';
import type { Expense, SkippedMessage, InboxMessage, ProcessInboxResult, ExpenseCategory } from '../types/expense';

// ============================================================================
// Expenses — read + manual write
// ============================================================================

/**
 * Fetches expenses up to `limit` rows, most recent first. The expenses
 * table is pruned to the last 1 year by a server-side pg_cron job (see
 * supabase-expenses-setup.sql), so a single bounded query is sufficient —
 * no pagination cursor is needed for a personal single-user dataset.
 */
export async function getExpenses(limit = 1000): Promise<Expense[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .order('txn_date', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch expenses: ${error.message}`);
  }

  return (data || []) as Expense[];
}

/**
 * Manually add an expense from within the app itself — a fallback for
 * transactions with no SMS (cash spends, transfers your bank doesn't
 * notify you about, etc.), mirroring the Water Tracker's manual
 * quick-add-water buttons.
 */
export async function addManualExpense(input: {
  amount: number;
  payee: string;
  category: ExpenseCategory;
  type: 'debit' | 'credit';
  txn_date?: string;
}): Promise<Expense> {
  const supabase = getSupabaseClient();
  const txnDate = input.txn_date || new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('expenses')
    .insert({
      amount: input.amount,
      payee: input.payee || null,
      category: input.category,
      txn_date: txnDate,
      upi_ref: `manual_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      raw_message: `Manually added via app: ${input.payee} — ₹${input.amount}`,
      type: input.type,
      source: 'regex',
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to add expense: ${error.message}`);
  }

  return data as Expense;
}

export async function deleteExpense(id: number): Promise<void> {
  const supabase = getSupabaseClient();

  const { error } = await supabase.from('expenses').delete().eq('id', id);

  if (error) {
    throw new Error(`Failed to delete expense: ${error.message}`);
  }
}

// ============================================================================
// Skipped messages (Parser Lab visibility)
// ============================================================================

export async function getRecentSkippedMessages(limit = 15): Promise<SkippedMessage[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('expense_skipped_messages')
    .select('*')
    .order('received_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch skipped messages: ${error.message}`);
  }

  return (data || []) as SkippedMessage[];
}

export async function getSkippedMessagesCount(): Promise<number> {
  const supabase = getSupabaseClient();

  const { count, error } = await supabase
    .from('expense_skipped_messages')
    .select('*', { count: 'exact', head: true });

  if (error) {
    throw new Error(`Failed to count skipped messages: ${error.message}`);
  }

  return count || 0;
}

// ============================================================================
// Inbox — where the iPhone Automation writes raw SMS text directly
// ============================================================================

export async function getInboxMessages(limit = 200): Promise<InboxMessage[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('expense_inbox')
    .select('*')
    .order('received_at', { ascending: true }) // process oldest first
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch inbox: ${error.message}`);
  }

  return (data || []) as InboxMessage[];
}

export async function getInboxCount(): Promise<number> {
  const supabase = getSupabaseClient();

  const { count, error } = await supabase
    .from('expense_inbox')
    .select('*', { count: 'exact', head: true });

  if (error) {
    throw new Error(`Failed to count inbox: ${error.message}`);
  }

  return count || 0;
}

/**
 * Manually add a message to the inbox — lets you test the full inbox
 * pipeline (classify -> insert -> delete) from within the app itself,
 * without needing the iPhone Automation configured yet.
 */
export async function addToInbox(rawMessage: string): Promise<InboxMessage> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('expense_inbox')
    .insert({ raw_message: rawMessage })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to add to inbox: ${error.message}`);
  }

  return data as InboxMessage;
}

/**
 * Processes every pending inbox message: classifies each one client-side
 * (regex first, optional Gemini fallback), writes the result to `expenses`
 * or `expense_skipped_messages`, then deletes it from the inbox — all via
 * direct Supabase calls with the anon key, no backend involved.
 *
 * Messages that fail classification due to a TRANSIENT error (Gemini
 * network hiccup, bad response, etc.) are deliberately LEFT in the inbox
 * so the next call to this function retries them automatically. This
 * means calling processInbox() repeatedly (e.g. every time the app opens)
 * is always safe and never loses data.
 */
export async function processInbox(): Promise<ProcessInboxResult> {
  const supabase = getSupabaseClient();
  const pending = await getInboxMessages(200);

  const result: ProcessInboxResult = {
    totalPending: pending.length,
    debitsLogged: 0,
    creditsLogged: 0,
    duplicatesIgnored: 0,
    skippedNonTransactional: 0,
    leftInInboxDueToError: 0,
    errors: [],
  };

  for (const item of pending) {
    try {
      const parsed = await classifyMessage(item.raw_message);

      if (parsed.classification === 'not_a_transaction') {
        const { error: insertError } = await supabase.from('expense_skipped_messages').insert({
          raw_message: item.raw_message,
          classification: parsed.reason,
          source: parsed.source,
        });
        if (insertError) throw new Error(insertError.message);

        result.skippedNonTransactional += 1;
      } else {
        const type = parsed.classification === 'actual_debit' ? 'debit' : 'credit';

        const { data: inserted, error: upsertError } = await supabase
          .from('expenses')
          .upsert(
            {
              amount: parsed.amount,
              payee: parsed.payee,
              category: parsed.category,
              txn_date: parsed.txn_date,
              upi_ref: parsed.upi_ref,
              raw_message: item.raw_message,
              type,
              source: parsed.source,
            },
            { onConflict: 'upi_ref', ignoreDuplicates: true }
          )
          .select();

        if (upsertError) throw new Error(upsertError.message);

        const wasDuplicate = !inserted || inserted.length === 0;
        if (wasDuplicate) {
          result.duplicatesIgnored += 1;
        } else if (type === 'debit') {
          result.debitsLogged += 1;
        } else {
          result.creditsLogged += 1;
        }
      }

      // Only remove from the inbox once it has been durably classified
      // AND recorded — if either step above threw, we fall into `catch`
      // and the row stays in the inbox for the next attempt.
      const { error: deleteError } = await supabase.from('expense_inbox').delete().eq('id', item.id);
      if (deleteError) throw new Error(deleteError.message);
    } catch (err) {
      result.leftInInboxDueToError += 1;
      const reason = err instanceof ClassificationError
        ? `Classification failed: ${err.message}`
        : err instanceof Error
        ? err.message
        : 'Unknown error';
      result.errors.push(`Message #${item.id}: ${reason}`);
      // Deliberately do NOT delete this inbox row — leave it for retry.
    }
  }

  return result;
}
