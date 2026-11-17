// ════════════════════════════════════════════════════════════════════════════
// ai-proxy — forwards AI requests so the API keys stay on the server.
// ────────────────────────────────────────────────────────────────────────────
// Request body (POST, JSON):
//   { provider: 'gemini',   model: 'gemini-2.0-flash', body: <generateContent body> }
//   { provider: 'deepseek', body: <chat/completions body> }
// The upstream response (status + JSON) is passed straight back.
//
// Secrets (set once):  supabase secrets set GEMINI_API_KEY=... DEEPSEEK_API_KEY=...
// Deploy:              supabase functions deploy ai-proxy
// ════════════════════════════════════════════════════════════════════════════

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
const DEEPSEEK_API_KEY = Deno.env.get('DEEPSEEK_API_KEY') ?? '';

const GEMINI_MODEL = /^gemini-[a-z0-9.\-]{1,40}$/;
const DEEPSEEK_MODEL = /^deepseek-[a-z0-9.\-]{1,40}$/;
const MAX_BODY_BYTES = 8 * 1024 * 1024; // photos of slips are sent as base64

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const reply = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const passThrough = async (res: Response) =>
  new Response(await res.text(), { status: res.status, headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return reply(405, { error: { message: 'Use POST' } });

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return reply(413, { error: { message: 'Request too large' } });

  let input: { provider?: string; model?: string; body?: Record<string, unknown> };
  try {
    input = JSON.parse(raw);
  } catch {
    return reply(400, { error: { message: 'Invalid JSON' } });
  }

  const { provider, model, body } = input ?? {};
  if (!body || typeof body !== 'object') return reply(400, { error: { message: 'Missing body' } });

  try {
    if (provider === 'gemini') {
      if (!GEMINI_API_KEY) return reply(503, { error: { message: 'GEMINI_API_KEY is not set on the server' } });
      if (typeof model !== 'string' || !GEMINI_MODEL.test(model)) {
        return reply(400, { error: { message: 'Unsupported Gemini model' } });
      }
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
          body: JSON.stringify(body),
        },
      );
      return passThrough(res);
    }

    if (provider === 'deepseek') {
      if (!DEEPSEEK_API_KEY) return reply(503, { error: { message: 'DEEPSEEK_API_KEY is not set on the server' } });
      const requested = typeof body.model === 'string' ? body.model : 'deepseek-chat';
      const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DEEPSEEK_API_KEY}` },
        body: JSON.stringify({ ...body, model: DEEPSEEK_MODEL.test(requested) ? requested : 'deepseek-chat' }),
      });
      return passThrough(res);
    }

    return reply(400, { error: { message: 'Unknown provider' } });
  } catch (err) {
    return reply(502, { error: { message: `AI provider unreachable: ${(err as Error).message}` } });
  }
});
