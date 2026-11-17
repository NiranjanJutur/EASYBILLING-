/**
 * gspProxy.ts — Calls the GST portal through the `gsp-proxy` Edge Function.
 * The function logs in to the portal and adds the credentials server-side.
 */
import { functionUrl, functionHeaders, SUPABASE_CONFIGURED } from '../../config/supabase';

export type GspPath =
  | '/ei/api/invoice'
  | '/ei/api/invoice/cancel'
  | '/ewb/api/ewayapi/GenEWayBill'
  | '/ewb/api/ewayapi/UpdateVehicle'
  | '/ewb/api/ewayapi/CancelEWayBill'
  | '/commonapi/v1.3/search';

export interface GspRequest {
  path: GspPath;
  gstin: string;
  body?: unknown;
  query?: Record<string, string>;
  stateCode?: string;
}

export async function gspRequest(req: GspRequest): Promise<Response> {
  if (!SUPABASE_CONFIGURED) {
    throw new Error('Supabase is not configured, so the GST portal cannot be reached');
  }
  return fetch(functionUrl('gsp-proxy'), {
    method: 'POST',
    headers: functionHeaders(),
    body: JSON.stringify(req),
  });
}
