// ════════════════════════════════════════════════════════════════════════════
// gsp-proxy — calls the GST portal (GSP) for e-invoice / e-way bill / GSTIN search.
// ────────────────────────────────────────────────────────────────────────────
// The GSP username, password, client id and secret live ONLY here.
// The app sends:  { path, method?, body?, query?, gstin, stateCode? }
// This function logs in to the GSP (token cached per GSTIN), adds the
// credential headers, calls the GSP and passes the response straight back.
//
// Secrets (set once):
//   supabase secrets set GSP_BASE_URL=... GSP_USERNAME=... GSP_PASSWORD=... \
//                        GSP_CLIENT_ID=... GSP_CLIENT_SECRET=... \
//                        ALLOWED_GSTINS=36XXXXX1234X1Z5,36YYYYY5678Y2Z8
// Deploy:
//   supabase functions deploy gsp-proxy
// ════════════════════════════════════════════════════════════════════════════

const BASE_URL = (Deno.env.get('GSP_BASE_URL') ?? '').replace(/\/+$/, '');
const USERNAME = Deno.env.get('GSP_USERNAME') ?? '';
const PASSWORD = Deno.env.get('GSP_PASSWORD') ?? '';
const CLIENT_ID = Deno.env.get('GSP_CLIENT_ID') ?? '';
const CLIENT_SECRET = Deno.env.get('GSP_CLIENT_SECRET') ?? '';
const ALLOWED_GSTINS = (Deno.env.get('ALLOWED_GSTINS') ?? '')
  .split(',')
  .map((g) => g.trim().toUpperCase())
  .filter(Boolean);

// Only these GSP endpoints can be reached through the proxy.
const ENDPOINTS: Record<string, { method: 'GET' | 'POST'; style: 'standard' | 'commonapi' }> = {
  '/ei/api/invoice':                  { method: 'POST', style: 'standard' },
  '/ei/api/invoice/cancel':           { method: 'POST', style: 'standard' },
  '/ewb/api/ewayapi/GenEWayBill':     { method: 'POST', style: 'standard' },
  '/ewb/api/ewayapi/UpdateVehicle':   { method: 'POST', style: 'standard' },
  '/ewb/api/ewayapi/CancelEWayBill':  { method: 'POST', style: 'standard' },
  '/commonapi/v1.3/search':           { method: 'GET',  style: 'commonapi' },
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const reply = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const tokens = new Map<string, { token: string; expiresAt: number }>();

function randomAppKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

async function getToken(gstin: string): Promise<string> {
  const cached = tokens.get(gstin);
  if (cached && cached.expiresAt - Date.now() > 5 * 60 * 1000) return cached.token;

  const res = await fetch(`${BASE_URL}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', client_id: CLIENT_ID, client_secret: CLIENT_SECRET },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD, gstin, app_key: randomAppKey() }),
  });
  if (!res.ok) throw new Error(`GSP login failed (HTTP ${res.status})`);

  const json = await res.json();
  if (json?.status !== '1' || !json?.data?.AuthToken) {
    throw new Error(`GSP login failed: ${json?.error ?? 'unknown error'}`);
  }

  const expiresAt = new Date(json.data.Expiry).getTime() || Date.now() + 5 * 60 * 60 * 1000;
  tokens.set(gstin, { token: json.data.AuthToken, expiresAt });
  return json.data.AuthToken;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return reply(405, { status: '0', error: 'Use POST' });

  if (!BASE_URL || !USERNAME || !PASSWORD || !CLIENT_ID || !CLIENT_SECRET) {
    return reply(503, { status: '0', error: 'GST portal credentials are not set on the server' });
  }

  let input: {
    path?: string;
    body?: unknown;
    query?: Record<string, string>;
    gstin?: string;
    stateCode?: string;
  };
  try {
    input = await req.json();
  } catch {
    return reply(400, { status: '0', error: 'Invalid JSON' });
  }

  const endpoint = input.path ? ENDPOINTS[input.path] : undefined;
  if (!endpoint) return reply(400, { status: '0', error: 'This GST endpoint is not allowed' });

  const gstin = String(input.gstin ?? '').trim().toUpperCase();
  if (!/^[0-9A-Z]{15}$/.test(gstin)) return reply(400, { status: '0', error: 'Invalid seller GSTIN' });
  if (ALLOWED_GSTINS.length > 0 && !ALLOWED_GSTINS.includes(gstin)) {
    return reply(403, { status: '0', error: 'This GSTIN is not allowed on this server' });
  }

  try {
    const token = await getToken(gstin);

    const headers: Record<string, string> =
      endpoint.style === 'commonapi'
        ? {
            'Content-Type': 'application/json',
            clientid: CLIENT_ID,
            'client-secret': CLIENT_SECRET,
            username: USERNAME,
            'auth-token': token,
            'state-cd': String(input.stateCode ?? gstin.slice(0, 2)),
          }
        : {
            'Content-Type': 'application/json',
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            user_name: USERNAME,
            AuthToken: token,
            Gstin: gstin,
          };

    const query = input.query ? `?${new URLSearchParams(input.query).toString()}` : '';
    const res = await fetch(`${BASE_URL}${input.path}${query}`, {
      method: endpoint.method,
      headers,
      body: endpoint.method === 'GET' ? undefined : JSON.stringify(input.body ?? {}),
    });

    return new Response(await res.text(), {
      status: res.status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return reply(502, { status: '0', error: (err as Error).message });
  }
});
