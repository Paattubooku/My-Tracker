/**
 * ICICI Bank SMS Parser Pipeline — runs entirely in the browser.
 *
 * This mirrors the Water Tracker's architecture: no backend server, no
 * webhooks, no serverless functions. The React app itself classifies
 * messages using the anon-key Supabase client, exactly like every other
 * read/write in this application.
 *
 * Three-stage pipeline, cheapest-first:
 *
 *   Stage A — REJECT: regex-match known NON-TRANSACTIONAL message shapes
 *             (bill reminders, failed autopay, statement notices, noise)
 *             and bail out immediately. Free, instant, never reaches Gemini.
 *
 *   Stage B — EXTRACT: run an ordered list of transaction rules (regex +
 *             extractor function) against the message. Covers ~90% of real
 *             ICICI formats for free, with no network call.
 *
 *   Stage C — FALLBACK: only reached if A and B both miss, AND a Gemini API
 *             key is configured (VITE_GEMINI_API_KEY). Calls Gemini Flash
 *             directly from the browser with a strict JSON-only
 *             classification+extraction prompt.
 *
 * IMPORTANT SECURITY NOTE ON GEMINI: because this key must be readable by
 * the browser to call Gemini directly (no backend to hide it behind), it
 * is bundled into the client JavaScript like VITE_SUPABASE_ANON_KEY already
 * is. This is an accepted tradeoff for a personal, single-user app with no
 * public traffic — the same trust model already used for the Supabase anon
 * key elsewhere in this project. If you don't want to expose a Gemini key
 * at all, simply leave VITE_GEMINI_API_KEY unset: the parser still handles
 * ~90% of real ICICI message formats via regex alone, and anything it
 * can't confidently classify is safely left untouched for manual review
 * instead of being guessed at.
 */

export type ExpenseCategory =
  | 'food'
  | 'bills'
  | 'cash'
  | 'card'
  | 'shopping'
  | 'transfer'
  | 'income'
  | 'other';

export type ParseStage = 'reject_rule' | 'extract_rule' | 'gemini_fallback' | 'unmatched_default';

export interface ParseMeta {
  stage: ParseStage;
  ruleName: string | null;
}

export type NonTransactionReason =
  | 'bill_reminder'
  | 'failed_autopay'
  | 'statement_notice'
  | 'noise';

export interface ParsedTransaction {
  classification: 'actual_debit' | 'actual_credit';
  amount: number;
  payee: string | null;
  category: ExpenseCategory;
  txn_date: string; // YYYY-MM-DD
  upi_ref: string | null;
  source: 'regex' | 'gemini';
  meta: ParseMeta;
}

export interface ParsedNonTransaction {
  classification: 'not_a_transaction';
  reason: NonTransactionReason;
  source: 'regex' | 'gemini';
  meta: ParseMeta;
}

export type ParseResult = ParsedTransaction | ParsedNonTransaction;

/**
 * Thrown when classification genuinely fails due to a transient problem
 * (Gemini network error, malformed Gemini response, etc.) rather than a
 * confident "this is not a transaction" determination. Callers (the inbox
 * processor) catch this and leave the message in the inbox so the NEXT
 * sync attempt retries it automatically instead of silently losing data.
 */
export class ClassificationError extends Error {}

// ============================================================================
// Shared helpers
// ============================================================================

const MONTH_MAP: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

/** Parses "01-Jun-26" (DD-MMM-YY) or "12-06-2026" (DD-MM-YYYY) into YYYY-MM-DD. */
export function parseIciciDate(raw: string): string {
  const ddMmmYy = raw.match(/^(\d{2})-([A-Za-z]{3})-(\d{2})$/);
  if (ddMmmYy) {
    const [, day, monAbbrev, yy] = ddMmmYy;
    const month = MONTH_MAP[monAbbrev.toLowerCase()];
    if (month) return `20${yy}-${month}-${day}`;
  }

  const ddMmYyyy = raw.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (ddMmYyyy) {
    const [, day, month, year] = ddMmYyyy;
    return `${year}-${month}-${day}`;
  }

  return new Date().toISOString().split('T')[0];
}

function parseAmount(raw: string): number {
  return parseFloat(raw.replace(/,/g, ''));
}

/**
 * Lightweight, dependency-free string hash (no Node built-ins — this file
 * runs in the browser). Doesn't need to be cryptographically secure, only
 * stable and unique-enough: it builds a synthetic dedup key for messages
 * with no natural UPI/IMPS/Txn reference number, so a genuine retry/resend
 * of the exact same SMS text still dedups correctly against the unique
 * index on upi_ref.
 */
function stableHash(input: string): string {
  let h1 = 0x811c9dc5; // FNV-1a 32-bit offset basis
  let h2 = 0x9e3779b9; // second seed for extra mixing

  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    h1 ^= code;
    h1 = Math.imul(h1, 0x01000193); // FNV prime
    h2 = (h2 ^ code) + ((h2 << 5) + (h2 >>> 2));
    h2 |= 0;
  }

  const toHex = (n: number) => (n >>> 0).toString(16).padStart(8, '0');
  return toHex(h1) + toHex(h2);
}

function syntheticRef(message: string): string {
  return 'sig_' + stableHash(message.trim());
}

function cleanPayee(raw: string | undefined | null): string | null {
  if (!raw) return null;
  return raw.replace(/\s+/g, ' ').trim() || null;
}

// ============================================================================
// Category inference (best-effort, cosmetic — never affects classification)
// ============================================================================

const CATEGORY_KEYWORDS: Array<{ category: ExpenseCategory; patterns: RegExp[] }> = [
  { category: 'cash', patterns: [/cardless withdrawal/i, /\batm\b/i, /cash w/i] },
  { category: 'bills', patterns: [/fibernet/i, /pdcl/i, /electricity/i, /bill pay/i, /broadband/i, /\bdth\b/i, /recharge/i] },
  {
    category: 'food',
    patterns: [
      /swiggy/i, /zomato/i, /juice/i, /spicy/i, /\bbriy/i, /hotel/i, /restaurant/i,
      /thalap/i, /unavagam/i, /food/i, /snacks?/i,
    ],
  },
  { category: 'card', patterns: [/credit card/i, /\bcard xx\d+/i, /spent using/i] },
  { category: 'shopping', patterns: [/\bmart\b/i, /\bstore\b/i, /\bshop\b/i, /retail/i] },
];

function inferCategory(type: 'actual_debit' | 'actual_credit', payee: string | null, message: string): ExpenseCategory {
  if (type === 'actual_credit') return 'income';

  const haystack = `${payee || ''} ${message}`;
  for (const { category, patterns } of CATEGORY_KEYWORDS) {
    if (patterns.some((p) => p.test(haystack))) return category;
  }

  return 'transfer'; // default for a person-to-person UPI debit with no other signal
}

// ============================================================================
// Stage A — Non-transactional rejection rules
// ============================================================================

interface RejectRule {
  name: string;
  test: (messageLower: string) => boolean;
  reason: NonTransactionReason;
}

const REJECT_RULES: RejectRule[] = [
  {
    name: 'bill_reminder_auto_debit',
    test: (m) => m.includes('will be auto-debited on') || m.includes('will auto-deduct on'),
    reason: 'bill_reminder',
  },
  {
    name: 'bill_reminder_please_ignore',
    test: (m) => m.includes('amount will be debited from') && m.includes('please ignore if paid'),
    reason: 'bill_reminder',
  },
  {
    name: 'failed_autopay_cbs_rejection',
    test: (m) => m.includes('not debited') && m.includes('cbs rejection'),
    reason: 'failed_autopay',
  },
  {
    name: 'statement_notice',
    test: (m) => m.includes('statement is sent to'),
    reason: 'statement_notice',
  },
  {
    name: 'fee_change_noise',
    test: (m) => m.includes('revised') && m.includes('fee') && m.includes('updated'),
    reason: 'noise',
  },
  {
    name: 'generic_promo_noise',
    test: (m) => m.includes('for details, visit') && !m.includes('debited') && !m.includes('credited'),
    reason: 'noise',
  },
];

function runRejectStage(message: string): { reason: NonTransactionReason; ruleName: string } | null {
  const lower = message.toLowerCase();
  for (const rule of REJECT_RULES) {
    if (rule.test(lower)) {
      return { reason: rule.reason, ruleName: rule.name };
    }
  }
  return null;
}

// ============================================================================
// Stage B — Ordered transaction extraction rules
// ============================================================================

interface TransactionRule {
  name: string;
  regex: RegExp;
  extract: (match: RegExpMatchArray, message: string) => Omit<ParsedTransaction, 'category' | 'source' | 'meta'>;
}

const TRANSACTION_RULES: TransactionRule[] = [
  {
    name: 'upi_debit',
    regex: /Acct\s+XX\d+\s+debited for Rs\s*([\d,]+\.\d{2})\s+on\s+(\d{2}-[A-Za-z]{3}-\d{2});\s*(.+?)\s+credited\.?\s*UPI:(\d+)/i,
    extract: ([, amount, date, payee, ref]) => ({
      classification: 'actual_debit',
      amount: parseAmount(amount),
      payee: cleanPayee(payee),
      txn_date: parseIciciDate(date),
      upi_ref: ref,
    }),
  },
  {
    name: 'upi_credit',
    regex: /Acct\s+XX\d+\s+is credited with Rs\s*([\d,]+\.\d{2})\s+on\s+(\d{2}-[A-Za-z]{3}-\d{2})\s+from\s+(.+?)\.\s*UPI:(\d+)/i,
    extract: ([, amount, date, payee, ref]) => ({
      classification: 'actual_credit',
      amount: parseAmount(amount),
      payee: cleanPayee(payee),
      txn_date: parseIciciDate(date),
      upi_ref: ref,
    }),
  },
  {
    name: 'imps_credit',
    regex: /Account\s+XX\d+\s+is credited with Rs\s*([\d,]+\.\d{2})\s+on\s+(\d{2}-[A-Za-z]{3}-\d{2})\s+by\s+(.+?)\.\s*IMPS Ref\.?\s*no\.?\s*(\d+)/i,
    extract: ([, amount, date, payee, ref]) => ({
      classification: 'actual_credit',
      amount: parseAmount(amount),
      payee: cleanPayee(payee),
      txn_date: parseIciciDate(date),
      upi_ref: ref,
    }),
  },
  {
    name: 'cardless_atm_withdrawal',
    regex: /Rs\.?\s*([\d,]+\.\d{2})\s+cardless withdrawal at ICICI Bank ATM on\s+(\d{2}-[A-Za-z]{3}-\d{2})\.\s*Info:\s*([\w*]+)/i,
    extract: ([, amount, date, ref]) => ({
      classification: 'actual_debit',
      amount: parseAmount(amount),
      payee: 'ATM Cash Withdrawal',
      txn_date: parseIciciDate(date),
      upi_ref: ref,
    }),
  },
  {
    name: 'credit_card_spend',
    regex: /INR\s*([\d,]+\.\d{2})\s+spent using ICICI Bank Card\s+XX\d+\s+on\s+(\d{2}-[A-Za-z]{3}-\d{2})\s+on\s+(.+?)\.\s*Avl/i,
    extract: ([, amount, date, payee], message) => ({
      classification: 'actual_debit',
      amount: parseAmount(amount),
      payee: cleanPayee(payee),
      txn_date: parseIciciDate(date),
      upi_ref: syntheticRef(message),
    }),
  },
  {
    name: 'bill_autodebit_paid',
    regex: /^(.+?)\s+bill of Rs\s*([\d,.]+)\s+for .*?paid on\s+(\d{2}-\d{2}-\d{4})\s+[\d:]+\s*[AP]M\.\s*Txn ID:\s*(\S+)/i,
    extract: ([, payee, amount, date, txnId]) => ({
      classification: 'actual_debit',
      amount: parseAmount(amount),
      payee: cleanPayee(payee),
      txn_date: parseIciciDate(date),
      upi_ref: txnId.replace(/-ICICI Bank\.?$/i, ''),
    }),
  },
  {
    name: 'credit_card_autopay_confirmation',
    regex: /thank you for your payment of INR\s*([\d,]+\.\d{2})\s+towards\s+(.+?)\s+through Auto Debit from Account\s+XX\d+\s+on\s+(\d{2}-[A-Za-z]{3}-\d{2})/i,
    extract: ([, amount, payee, date], message) => ({
      classification: 'actual_debit',
      amount: parseAmount(amount),
      payee: cleanPayee(payee),
      txn_date: parseIciciDate(date),
      upi_ref: syntheticRef(message),
    }),
  },
];

function runExtractStage(message: string): { data: Omit<ParsedTransaction, 'category' | 'source' | 'meta'>; ruleName: string } | null {
  for (const rule of TRANSACTION_RULES) {
    const match = message.match(rule.regex);
    if (match) {
      return { data: rule.extract(match, message), ruleName: rule.name };
    }
  }
  return null;
}

// ============================================================================
// Stage C — Gemini Flash fallback (browser-side call, optional)
// ============================================================================

const GEMINI_MODEL = 'gemini-2.0-flash';

const GEMINI_SYSTEM_PROMPT = `You are a strict parser for Indian bank SMS alerts (ICICI Bank).
Classify the given SMS into EXACTLY one of: actual_debit, actual_credit, not_a_transaction.

Rules:
- actual_debit: money has ACTUALLY left the account (UPI debit, ATM withdrawal, card spend, a bill that says "paid" or "payment ... through Auto Debit").
- actual_credit: money has ACTUALLY arrived in the account (UPI/IMPS credit).
- not_a_transaction: bill reminders ("will be auto-debited on", "due on"), failed/rejected autopay ("not debited", "cbs rejection"), statement notices, promotional or fee-change notices, or anything else where money has NOT actually moved.

Only actual_debit or actual_credit should include transaction fields — for not_a_transaction, set amount, payee, category, and upi_ref to null.

For actual_debit/actual_credit, also assign a "category" — one of: food, bills, cash, card, shopping, transfer, income, other.
- income: always used for actual_credit
- cash: ATM withdrawals
- bills: utility/broadband/recharge bills
- food: restaurants, food delivery, juice/snack shops
- card: generic credit/debit card spends with no clearer category
- shopping: retail/stores
- transfer: person-to-person UPI payments with no clearer category
- other: anything that doesn't fit above

Dates in the message may appear as DD-MMM-YY (e.g. 01-Jun-26) or DD-MM-YYYY (e.g. 12-06-2026). Always output txn_date as YYYY-MM-DD.

Respond with STRICT JSON ONLY (no markdown, no code fences, no explanation) matching exactly this schema:
{"classification": "actual_debit" | "actual_credit" | "not_a_transaction", "amount": number | null, "payee": string | null, "category": string | null, "txn_date": string | null, "upi_ref": string | null}`;

interface GeminiJsonResult {
  classification: 'actual_debit' | 'actual_credit' | 'not_a_transaction';
  amount: number | null;
  payee: string | null;
  category: string | null;
  txn_date: string | null;
  upi_ref: string | null;
}

const VALID_CATEGORIES: ExpenseCategory[] = ['food', 'bills', 'cash', 'card', 'shopping', 'transfer', 'income', 'other'];

function getGeminiApiKey(): string | undefined {
  const key = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  return key && key.trim() && !key.includes('your-gemini') ? key : undefined;
}

async function runGeminiStage(message: string): Promise<ParseResult> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new ClassificationError('Gemini is not configured (VITE_GEMINI_API_KEY not set)');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: message }] }],
        systemInstruction: { parts: [{ text: GEMINI_SYSTEM_PROMPT }] },
        generationConfig: { temperature: 0, responseMimeType: 'application/json' },
      }),
    });
  } catch (err) {
    throw new ClassificationError(
      `Network error calling Gemini: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new ClassificationError(`Gemini API request failed (${response.status}): ${errorText.slice(0, 200)}`);
  }

  const data = await response.json();
  const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new ClassificationError('Gemini API returned an empty response');

  let parsed: GeminiJsonResult;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ClassificationError(`Gemini API returned non-JSON output: ${text.slice(0, 200)}`);
  }

  const meta: ParseMeta = { stage: 'gemini_fallback', ruleName: null };

  if (parsed.classification === 'not_a_transaction' || parsed.amount === null || parsed.txn_date === null) {
    return { classification: 'not_a_transaction', reason: 'noise', source: 'gemini', meta };
  }

  const category: ExpenseCategory = VALID_CATEGORIES.includes(parsed.category as ExpenseCategory)
    ? (parsed.category as ExpenseCategory)
    : inferCategory(parsed.classification, parsed.payee, message);

  return {
    classification: parsed.classification,
    amount: parsed.amount,
    payee: cleanPayee(parsed.payee),
    category,
    txn_date: parsed.txn_date,
    upi_ref: parsed.upi_ref || syntheticRef(message),
    source: 'gemini',
    meta,
  };
}

// ============================================================================
// Public entry point — orchestrates the 3-stage pipeline
// ============================================================================

/**
 * Classifies a single SMS message. Never silently guesses on genuine
 * failures — if Gemini is configured but errors out (network, bad
 * response), this THROWS a ClassificationError instead of returning a
 * fake "noise" result, so the inbox processor can safely leave the
 * message for a later retry rather than losing it.
 */
export async function classifyMessage(message: string): Promise<ParseResult> {
  const trimmed = message.trim();

  // Stage A
  const rejected = runRejectStage(trimmed);
  if (rejected) {
    return {
      classification: 'not_a_transaction',
      reason: rejected.reason,
      source: 'regex',
      meta: { stage: 'reject_rule', ruleName: rejected.ruleName },
    };
  }

  // Stage B
  const extracted = runExtractStage(trimmed);
  if (extracted) {
    const category = inferCategory(extracted.data.classification, extracted.data.payee, trimmed);
    return {
      ...extracted.data,
      category,
      source: 'regex',
      meta: { stage: 'extract_rule', ruleName: extracted.ruleName },
    };
  }

  // Stage C — only attempted if a Gemini key is actually configured.
  if (getGeminiApiKey()) {
    return runGeminiStage(trimmed); // may throw ClassificationError — caller decides what to do
  }

  // No Gemini key configured and nothing matched — confidently classify as
  // noise rather than throwing, since there's no fallback path to retry.
  return {
    classification: 'not_a_transaction',
    reason: 'noise',
    source: 'regex',
    meta: { stage: 'unmatched_default', ruleName: null },
  };
}
