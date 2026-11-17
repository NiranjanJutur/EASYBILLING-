/**
 * Supabase access is disabled when the app runs in local mode.
 * Credentials are read only for builds explicitly configured for Supabase.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ENV } from './env';

export const LOCAL_ONLY = ENV.DATA_MODE === 'LOCAL';
export const SUPABASE_CONFIGURED = !LOCAL_ONLY && Boolean(ENV.SUPABASE_URL && ENV.SUPABASE_ANON_KEY);

if (!LOCAL_ONLY && !SUPABASE_CONFIGURED) {
  console.warn('[Supabase] Missing SUPABASE_URL or SUPABASE_ANON_KEY.');
}

const disabledClient = new Proxy({}, {
  get() {
    throw new Error('Supabase is disabled. Set DATA_MODE=SUPABASE to enable it.');
  },
}) as SupabaseClient;

export const supabase: SupabaseClient = SUPABASE_CONFIGURED
  ? createClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : disabledClient;

/** URL of a Supabase Edge Function, e.g. functionUrl('ai-proxy'). */
export const functionUrl = (name: string) => SUPABASE_CONFIGURED ? `${ENV.SUPABASE_URL}/functions/v1/${name}` : '';

/** Headers every Edge Function call needs (the anon key is public by design). */
export const functionHeaders = (): Record<string, string> => SUPABASE_CONFIGURED ? ({
  'Content-Type': 'application/json',
  apikey: ENV.SUPABASE_ANON_KEY,
  Authorization: `Bearer ${ENV.SUPABASE_ANON_KEY}`,
}) : ({ 'Content-Type': 'application/json' });
