/**
 * aiProxy.ts — Calls Gemini / DeepSeek through the `ai-proxy` Edge Function,
 * so the API keys never ship inside the app or the website.
 * The returned Response has the provider's own status code and JSON body.
 */
import { functionUrl, functionHeaders, SUPABASE_CONFIGURED } from '../../config/supabase';

const post = (payload: object): Promise<Response> => {
  if (!SUPABASE_CONFIGURED) {
    return Promise.reject(new Error('Supabase is not configured, so AI features are unavailable'));
  }
  return fetch(functionUrl('ai-proxy'), {
    method: 'POST',
    headers: functionHeaders(),
    body: JSON.stringify(payload),
  });
};

/** Gemini generateContent request body → Gemini response. */
export const geminiRequest = (model: string, body: object) => post({ provider: 'gemini', model, body });

/** DeepSeek chat/completions request body → DeepSeek response. */
export const deepseekRequest = (body: object) => post({ provider: 'deepseek', body });
