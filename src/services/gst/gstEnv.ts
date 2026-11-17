/**
 * gstEnv.ts — Public seller details used to build e-invoice / e-way bill payloads.
 *
 * GST portal (GSP) credentials are NOT here any more. They are Supabase Edge
 * Function secrets used by supabase/functions/gsp-proxy. The app calls the
 * portal only through gspProxy.ts.
 */
import { ENV } from '../../config/env';

export const SELLER_PLACE      = ENV.SELLER_PLACE;
export const SELLER_STATE_CODE = ENV.SELLER_STATE_CODE;
