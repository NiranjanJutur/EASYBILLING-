/**
 * api_keys.ts — public client configuration only.
 *
 * AI keys (Gemini, DeepSeek), GST portal credentials and the Postgres
 * connection string are NOT available to the app any more. They live in
 * Supabase Edge Function secrets and are used by:
 *   supabase/functions/ai-proxy   (Gemini / DeepSeek)
 *   supabase/functions/gsp-proxy  (e-invoice / e-way bill / GSTIN search)
 */
import { ENV } from './env';

export const API_KEYS = {
  SUPABASE_URL: ENV.SUPABASE_URL,
  SUPABASE_ANON_KEY: ENV.SUPABASE_ANON_KEY,
};
