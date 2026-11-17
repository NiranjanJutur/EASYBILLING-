/**
 * env.web.ts — App configuration for the web build (Vite).
 *
 * Each value is read with a fixed name like `import.meta.env.VITE_SUPABASE_URL`.
 * Do NOT read `import.meta.env` with a computed key (env[key]) anywhere:
 * Vite then pastes EVERY VITE_ variable, secrets included, into the bundle.
 * The build also fails if a secret value ends up in the output (vite.config.ts).
 */

const clean = (v: string | undefined) => (typeof v === 'string' ? v.trim() : '');

export const ENV = {
  SUPABASE_URL: clean(import.meta.env.VITE_SUPABASE_URL).replace(/\/+$/, ''),
  SUPABASE_ANON_KEY: clean(import.meta.env.VITE_SUPABASE_ANON_KEY),
  DATA_MODE: clean(import.meta.env.VITE_DATA_MODE) || 'LOCAL',
  IS_DEV: Boolean(import.meta.env.DEV),
  SELLER_PLACE: clean(import.meta.env.VITE_SELLER_PLACE),
  SELLER_STATE_CODE: clean(import.meta.env.VITE_SELLER_STATE_CODE) || '29',
};
