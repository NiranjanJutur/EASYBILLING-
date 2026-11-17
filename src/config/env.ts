/**
 * env.ts — App configuration for React Native (Android / iOS).
 * The web build uses env.web.ts instead.
 *
 * react-native-dotenv copies the value of every name imported from '@env'
 * straight into the app bundle. So ONLY public values may be imported here.
 * Never import API keys, passwords or the Postgres connection string:
 * those belong in Supabase Edge Function secrets (see SUPABASE_SETUP.md).
 */
import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  DATA_MODE,
  SELLER_PLACE,
  SELLER_STATE_CODE,
} from '@env';

const clean = (v: string | undefined) => (typeof v === 'string' ? v.trim() : '');

export const ENV = {
  SUPABASE_URL: clean(SUPABASE_URL).replace(/\/+$/, ''),
  SUPABASE_ANON_KEY: clean(SUPABASE_ANON_KEY),
  DATA_MODE: clean(DATA_MODE) || 'LOCAL',
  IS_DEV: __DEV__,
  SELLER_PLACE: clean(SELLER_PLACE),
  SELLER_STATE_CODE: clean(SELLER_STATE_CODE) || '29',
};
