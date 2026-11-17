/**
 * Gemini AI Service (Native version)
 * Multi-provider: Gemini → DeepSeek fallback.
 */
import { Product } from '../../models/Product';
import { SlipOCRResult } from '../../models/Slip';
import { geminiRequest, deepseekRequest } from './aiProxy';

const GEMINI_MODELS = ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-2.5-flash'];


const MAX_RETRIES = 1;
const RETRY_DELAY_MS = 1000;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// ── DeepSeek Fallback ───────────────────────────────────────────────────────

const callDeepSeek = async (systemPrompt: string, userPrompt: string, imageBase64?: string): Promise<any> => {

    const messages: any[] = [
        { role: 'system', content: systemPrompt },
    ];
    if (imageBase64) {
        messages.push({
            role: 'user',
            content: [
                { type: 'text', text: userPrompt },
                { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
            ],
        });
    } else {
        messages.push({ role: 'user', content: userPrompt });
    }

    const res = await deepseekRequest({
            model: 'deepseek-chat',
            messages,
            response_format: { type: 'json_object' },
            temperature: 0.1,
            max_tokens: 2048,
        });

    if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(`DeepSeek Error: ${errData?.error?.message || res.statusText}`);
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text) throw new Error('DeepSeek returned empty response');
    return JSON.parse(text);
};

// ── Generic Gemini Call with model fallback ──────────────────────────────────

const callGemini = async (parts: object[], responseSchema?: object): Promise<any> => {
    const body: any = {
        contents: [{ parts }],
        generationConfig: { responseMimeType: 'application/json' },
    };
    if (responseSchema) body.generationConfig.responseSchema = responseSchema;

    let lastError: Error | null = null;

    for (const model of GEMINI_MODELS) {
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
                const res = await geminiRequest(model, body);

                if (res.status === 429) {
                    lastError = new Error(`Quota exceeded for ${model}`);
                    if (attempt < MAX_RETRIES) { await sleep(RETRY_DELAY_MS * (attempt + 1)); continue; }
                    break;
                }
                if (!res.ok) { lastError = new Error(`AI Error: ${res.statusText}`); break; }

                const data = await res.json();
                const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
                if (!text) { lastError = new Error('Empty response'); break; }
                return JSON.parse(text);
            } catch (e: any) {
                lastError = e;
                if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS * (attempt + 1));
            }
        }
    }
    throw lastError || new Error('All Gemini models failed.');
};

// ── Schemas ─────────────────────────────────────────────────────────────────

const PRODUCT_SCHEMA = {
    type: 'object',
    properties: { name: { type: 'string' }, category: { type: 'string' }, price: { type: 'number' }, unit: { type: 'string' } },
    required: ['name', 'category', 'price', 'unit'],
};

const SLIP_SCHEMA = {
    type: 'object',
    properties: {
        name: { type: 'string' },
        phone: { type: 'string' },
        items: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    name: { type: 'string' },
                    qty: { type: 'number' },
                    unit: { type: 'string' },
                    amount: { type: 'number' },  // Left-column line total — read as-is
                    confidence: { type: 'number' },
                },
                required: ['name', 'qty'],
            },
        },
        totalItems: { type: 'number' },
        grandTotal: { type: 'number' },
        language: { type: 'string' },
    },
    required: ['name', 'items'],
};

const COMMAND_SCHEMA = {
    type: 'object',
    properties: { action: { type: 'string', enum: ['ADD', 'RESTOCK', 'REMOVE'] }, item: { type: 'string' }, qty: { type: 'number' }, unit: { type: 'string' } },
    required: ['action', 'item', 'qty', 'unit'],
};

// ── Exports ─────────────────────────────────────────────────────────────────

export const recognizeProduct = async (imageBase64: string): Promise<Partial<Product> | null> => {
    const prompt = 'Identify this product. JSON: name, category, price (INR), unit';
    try {
        return await callGemini(
            [{ text: prompt }, { inline_data: { mime_type: 'image/jpeg', data: imageBase64 } }],
            PRODUCT_SCHEMA,
        );
    } catch {
        try { return await callDeepSeek('Product ID AI. JSON only.', prompt, imageBase64); } catch { return null; }
    }
};

export const extractSlipData = async (imageBase64: string): Promise<SlipOCRResult | null> => {
    const prompt = `You are an expert OCR system for handwritten Indian grocery slips.

Read EVERY item. The LEFT COLUMN contains the exact line total in ₹ — do NOT recalculate it.
Return JSON: name (customer), phone, items[{name, qty, unit, amount, confidence}], totalItems, grandTotal.
For amounts: read the left-column number exactly as written. It is the negotiated price.`;
    try {
        return await callGemini(
            [{ text: prompt }, { inline_data: { mime_type: 'image/jpeg', data: imageBase64 } }],
            SLIP_SCHEMA,
        );
    } catch {
        try { return await callDeepSeek('Handwriting OCR AI. JSON only.', prompt, imageBase64); } catch { return null; }
    }
};

export const analyzeImage = async (imageBase64: string, prompt: string): Promise<string> => {
    try {
        const parts = [
            { text: prompt },
            { inline_data: { mime_type: 'image/jpeg', data: imageBase64 } }
        ];
        const result = await callGemini(parts);
        return typeof result === 'string' ? result : JSON.stringify(result);
    } catch (e) {
        console.error('Gemini analyzeImage error:', e);
        // Try fallback to DeepSeek
        try {
            const result = await callDeepSeek('Image Analyzer. JSON only.', prompt, imageBase64);
            return JSON.stringify(result);
        } catch (innerE) {
            throw new Error('All AI providers failed to analyze image');
        }
    }
};

export const parseCommandAI = async (command: string): Promise<any | null> => {
    const prompt = `Parse voice command to JSON. action(ADD|RESTOCK|REMOVE), item, qty, unit. Command: "${command}"`;
    try {
        return await callGemini([{ text: prompt }], COMMAND_SCHEMA);
    } catch {
        try { return await callDeepSeek('Voice command parser. JSON only.', prompt); } catch { return null; }
    }
};
