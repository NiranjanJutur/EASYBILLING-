/**
 * aiAssistantService.ts — Conversational Store AI
 * ────────────────────────────────────────────────
 * FIXED:
 *   - fetchDataForQuery and callGemini now race against an 8-second timeout.
 *     Previously, if Supabase or Gemini was slow the AI Pulse spinner hung
 *     forever with no error state. Now it always resolves within ~8s.
 *   - The top-level ask() is wrapped in try/catch so any uncaught error
 *     returns a graceful fallback instead of a rejected promise.
 */

import { geminiRequest } from './aiProxy';
import {
  getTransactions,
  getProducts,
  getCustomers,
  getDailySalesSummary,
} from '../database/supabaseDataService';

// ─── Types ────────────────────────────────────────────────────────────────────

export type QueryType =
  | 'sales-today'
  | 'sales-comparison'
  | 'top-products'
  | 'low-stock'
  | 'customer-debt'
  | 'expiry-risk'
  | 'reorder-suggestions'
  | 'revenue-summary'
  | 'general';

export interface AIAssistantResponse {
  answer: string;
  queryType: QueryType;
  data: Record<string, any>;
  confidence: number;
  suggestedFollowUps: string[];
  timedOut?: boolean;
}

// ─── Timeout helper ───────────────────────────────────────────────────────────

/** Rejects after `ms` milliseconds — use with Promise.race to cap slow calls */
const timeout = (ms: number): Promise<never> =>
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms)
  );

// ─── Query classifier ─────────────────────────────────────────────────────────

const classifyQuery = (question: string): QueryType => {
  const q = question.toLowerCase();
  if (/today|aaj|today.*sell|sell.*today/.test(q))              return 'sales-today';
  if (/compare|week|month|last/.test(q))                        return 'sales-comparison';
  if (/top|best|most.*sold|highest/.test(q))                    return 'top-products';
  if (/low.*stock|stock.*low|restock|finish|running out/.test(q)) return 'low-stock';
  if (/owe|debt|udhaar|outstanding|credit/.test(q))             return 'customer-debt';
  if (/expir|expire|expiry|bad|spoil/.test(q))                  return 'expiry-risk';
  if (/reorder|order|buy|purchase/.test(q))                     return 'reorder-suggestions';
  if (/revenue|income|earn|profit|total/.test(q))               return 'revenue-summary';
  return 'general';
};

// ─── Data fetchers per query type ─────────────────────────────────────────────

const fetchDataForQuery = async (type: QueryType): Promise<Record<string, any>> => {
  // Each fetch races against an 8s timeout — prevents infinite spinner
  const withTimeout = <T>(p: Promise<T>): Promise<T> =>
    Promise.race([p, timeout(8000)]);

  try {
    switch (type) {
      case 'sales-today':         return { summary: await withTimeout(getDailySalesSummary()) };
      case 'top-products':        return { transactions: await withTimeout(getTransactions(200)), products: await withTimeout(getProducts()) };
      case 'low-stock':           return { products: await withTimeout(getProducts()) };
      case 'customer-debt':       return { customers: await withTimeout(getCustomers()) };
      case 'expiry-risk':         return { products: await withTimeout(getProducts()) };
      case 'reorder-suggestions': return { products: await withTimeout(getProducts()), transactions: await withTimeout(getTransactions(100)) };
      case 'revenue-summary':     return { summary: await withTimeout(getDailySalesSummary()), transactions: await withTimeout(getTransactions(50)) };
      case 'sales-comparison':    return { transactions: await withTimeout(getTransactions(200)) };
      default:                    return {};
    }
  } catch (err) {
    console.warn('[AI] fetchDataForQuery timed out or failed:', err);
    return {}; // Return empty data; Gemini will say it has no context
  }
};

// ─── Gemini call ──────────────────────────────────────────────────────────────

const MODELS = ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash'];

const callGemini = async (systemPrompt: string, userPrompt: string): Promise<string> => {
  const body = {
    contents: [{ parts: [{ text: `${systemPrompt}\n\nUser question: ${userPrompt}` }] }],
    generationConfig: { responseMimeType: 'text/plain', maxOutputTokens: 512, temperature: 0.3 },
  };

  let lastError = null;

  for (const model of MODELS) {
    try {
      const res = await Promise.race([
        geminiRequest(model, body),
        timeout(8000),
      ]);
      if (!res.ok) {
        lastError = await res.text();
        console.warn(`[AI] ${model} failed:`, res.status, lastError);
        continue;
      }
      const data = await res.json();
      return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? 'I could not generate an answer.';
    } catch (err) { 
        lastError = err;
        console.warn(`[AI] ${model} threw error:`, err);
        continue; 
    }
  }
  console.error('[AI] All Gemini models failed. Last error:', lastError);
  return 'AI service temporarily unavailable.';
};

// ─── Follow-up suggestions per type ─────────────────────────────────────────

const FOLLOW_UPS: Record<QueryType, string[]> = {
  'sales-today':          ['How does that compare to yesterday?', 'Which items sold the most?', 'What were the payment methods?'],
  'sales-comparison':     ['Show me top 5 products this week', 'What caused the change?'],
  'top-products':         ['Which product made the most profit?', 'What are the slow movers?'],
  'low-stock':            ['What should I reorder today?', 'Which supplier should I call?'],
  'customer-debt':        ['How much did we collect this week?', 'Who has the highest credit limit?'],
  'expiry-risk':          ['What products need to be discounted?', 'Show me items expiring this week'],
  'reorder-suggestions':  ['Which supplier has the best price?', 'How much stock should I keep?'],
  'revenue-summary':      ['What is our profit margin?', 'Compare to last month'],
  'general':              ['Ask me about sales', 'Ask me about stock levels'],
};

// ─── Main service ─────────────────────────────────────────────────────────────

export const aiAssistantService = {
  /**
   * Ask the AI assistant a question about the store.
   * Always resolves — never hangs. Returns a graceful error on timeout/failure.
   */
  async ask(question: string): Promise<AIAssistantResponse> {
    try {
      const queryType = classifyQuery(question);
      const data      = await fetchDataForQuery(queryType);

      const contextSummary = this._buildContextSummary(queryType, data);

      const systemPrompt = `You are a helpful store management assistant for an Indian grocery shop.
You have access to real store data. Answer concisely in 2-4 sentences.
Use ₹ for currency. Be direct and actionable.
Store data: ${contextSummary}`;

      const answer = await callGemini(systemPrompt, question);

      return {
        answer,
        queryType,
        data,
        confidence: 0.85,
        suggestedFollowUps: FOLLOW_UPS[queryType] ?? [],
      };
    } catch (err) {
      console.error('[AI] ask() failed:', err);
      return {
        answer: 'Could not load AI insights right now. Check your connection and try again.',
        queryType: 'general',
        data: {},
        confidence: 0,
        suggestedFollowUps: [],
        timedOut: true,
      };
    }
  },

  _buildContextSummary(type: QueryType, data: Record<string, any>): string {
    try {
      switch (type) {
        case 'sales-today': {
          const s = data.summary;
          if (!s) return 'No sales data available for today.';
          return `Today: ${s.total_transactions} bills, ₹${s.total_revenue} revenue, ₹${s.total_gst} GST. Cash: ₹${s.cash_sales}, UPI: ₹${s.upi_sales}, Udhaar: ₹${s.udhaar_sales}.`;
        }
        case 'low-stock': {
          const low = (data.products ?? []).filter((p: any) => p.currentStock <= p.minThreshold);
          if (low.length === 0) return 'All products are adequately stocked.';
          return `${low.length} products low on stock. Worst: ${low.slice(0,3).map((p: any) => `${p.name}(${p.currentStock}${p.unit})`).join(', ')}`;
        }
        case 'customer-debt': {
          const sorted = [...(data.customers ?? [])].sort((a: any, b: any) => b.totalOutstanding - a.totalOutstanding);
          const total = sorted.reduce((s: number, c: any) => s + c.totalOutstanding, 0);
          if (total === 0) return 'No outstanding customer debts.';
          return `Total udhaar: ₹${total.toFixed(0)}. Top debtors: ${sorted.slice(0,3).map((c: any) => `${c.name}(₹${c.totalOutstanding})`).join(', ')}`;
        }
        case 'expiry-risk': {
          const today = new Date();
          const soon = (data.products ?? []).filter((p: any) => {
            if (!p.expiryDate) return false;
            const diff = (new Date(p.expiryDate).getTime() - today.getTime()) / 86400000;
            return diff < 14 && diff > 0;
          });
          if (soon.length === 0) return 'No products expiring in the next 14 days.';
          return `${soon.length} products expiring within 14 days. ${soon.slice(0,3).map((p: any) => `${p.name}(exp:${p.expiryDate})`).join(', ')}`;
        }
        case 'top-products': {
          const freq: Record<string, number> = {};
          for (const txn of (data.transactions ?? [])) {
            for (const item of (txn.items ?? [])) {
              freq[item.name] = (freq[item.name] ?? 0) + item.qty;
            }
          }
          const top = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 5);
          if (top.length === 0) return 'No sales data available.';
          return `Top sold items: ${top.map(([n, q]) => `${n}(${q})`).join(', ')}`;
        }
        default: return 'General store data available.';
      }
    } catch { return 'Store data summary unavailable.'; }
  },

  /** Quick one-line summary for notification badge — always resolves */
  async getDailySummaryText(): Promise<string> {
    try {
      const s = await Promise.race([getDailySalesSummary(), timeout(5000)]);
      return `₹${Number(s?.total_revenue ?? 0).toFixed(0)} today · ${s?.total_transactions ?? 0} bills`;
    } catch { return 'Tap to view sales'; }
  },
};
