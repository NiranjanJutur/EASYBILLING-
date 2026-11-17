// Values react-native-dotenv may inline into the Android/iOS bundle.
// Only PUBLIC values belong here — see src/config/env.ts.
declare module '@env' {
  export const SUPABASE_URL: string;
  export const SUPABASE_ANON_KEY: string;
  export const DATA_MODE: 'SUPABASE' | 'LOCAL' | '';
  export const SELLER_PLACE: string;
  export const SELLER_STATE_CODE: string;
}

// Vite's import.meta.env (web build only)
interface ImportMetaEnv {
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly MODE: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_DATA_MODE?: string;
  readonly VITE_SELLER_PLACE?: string;
  readonly VITE_SELLER_STATE_CODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
