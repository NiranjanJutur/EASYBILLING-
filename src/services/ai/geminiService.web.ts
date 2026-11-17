/**
 * AI Service (Web)
 * Multi-provider: Gemini (primary) → DeepSeek (fallback)
 * Enhanced with model fallback chain, retry logic, deep extraction prompts,
 * and response validation for robust AI-powered features.
 */
import { Product } from '../../models/Product';
import { SlipOCRResult } from '../../models/Slip';
import { geminiRequest, deepseekRequest } from './aiProxy';

// ── Gemini Config ───────────────────────────────────────────────────────────
const GEMINI_MODELS = [
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-2.5-flash',
];


// ── DeepSeek Config ─────────────────────────────────────────────────────────
const DEEPSEEK_MODEL = 'deepseek-chat';

// ── Retry / Backoff Config ──────────────────────────────────────────────────
const MAX_RETRIES = 1;
const RETRY_DELAY_MS = 1000;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// ── DeepSeek API Call ───────────────────────────────────────────────────────

const callDeepSeek = async (systemPrompt: string, userPrompt: string, imageBase64?: string): Promise<any> => {

    console.log('[DeepSeek] Calling DeepSeek as fallback...');

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
            model: DEEPSEEK_MODEL,
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

    console.log('[DeepSeek] ✅ Success');
    return JSON.parse(text);
};

// ── Generic Gemini API Call ─────────────────────────────────────────────────

const callGemini = async (parts: object[], responseSchema?: object): Promise<any> => {
    const body: any = {
        contents: [{ parts }],
        generationConfig: {
            responseMimeType: 'application/json',
        },
    };

    if (responseSchema) {
        body.generationConfig.responseSchema = responseSchema;
    }

    let lastError: Error | null = null;

    // Try each Gemini model
    for (const model of GEMINI_MODELS) {

        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
                console.log(`[Gemini] Trying ${model} (attempt ${attempt + 1})...`);
                const res = await geminiRequest(model, body);

                if (res.status === 429) {
                    console.warn(`[Gemini] ${model} quota exceeded (429).`);
                    lastError = new Error(`API quota exceeded for ${model}`);
                    if (attempt < MAX_RETRIES) {
                        await sleep(RETRY_DELAY_MS * (attempt + 1));
                        continue;
                    }
                    break; // next model
                }

                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    const errMsg = errData?.error?.message || res.statusText;
                    console.error(`[Gemini] ${model} error:`, res.status, errMsg);
                    lastError = new Error(`AI Error (${model}): ${errMsg}`);
                    break; // next model
                }

                const data = await res.json();
                const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
                if (!text) {
                    lastError = new Error('AI returned an empty response.');
                    break;
                }

                console.log(`[Gemini] ✅ Success with ${model}`);
                return JSON.parse(text);
            } catch (e: any) {
                console.error(`[Gemini] ${model} call failed:`, e);
                lastError = e;
                if (attempt < MAX_RETRIES) {
                    await sleep(RETRY_DELAY_MS * (attempt + 1));
                }
            }
        }
    }

    // All Gemini models failed — throw so callers can try DeepSeek
    throw lastError || new Error('All Gemini models failed.');
};

// ── Validation Helpers ───────────────────────────────────────────────────────

const validateSlipResult = (result: any): SlipOCRResult => {
    if (!result || !Array.isArray(result.items)) {
        throw new Error('Invalid AI response: missing items array');
    }

    const validItems = result.items
        .filter((item: any) => item && typeof item.name === 'string' && item.name.trim().length > 0)
        .map((item: any) => ({
            name: item.name.trim(),
            qty: Math.max(0.1, Number(item.qty) || 1),
            unit: item.unit || 'pcs',
            confidence: item.confidence || 0,
            amount: Number(item.amount) || 0,
        }));

    return {
        name: (result.name || '').trim(),
        phone: (result.phone || '').trim().replace(/[^0-9+]/g, ''),
        items: validItems,
    };
};

const validateProductResult = (result: any): Partial<Product> | null => {
    if (!result || !result.name) return null;
    return {
        name: result.name.trim(),
        category: result.category || 'Other',
        price: Math.max(0, Number(result.price) || 0),
        unit: result.unit || 'pcs',
    };
};

// ── Prompt Templates ─────────────────────────────────────────────────────────

const PRODUCT_PROMPT = `You are an expert grocery store product identification AI. Analyze this product image carefully.

TASK: Identify the product and return accurate structured data.

RULES:
1. Read the product label/packaging carefully for the exact name and brand
2. If multiple products are visible, identify the most prominent one
3. Estimate the Indian retail price (MRP) as accurately as possible

Return a JSON object with:
- "name": Full product name including brand
- "brand": Brand name if visible
- "category": one of: Grains, Oils, Spices, Dairy, Snacks, Beverages, Personal Care, Household, Vegetables, Fruits, Pulses, Other
- "price": estimated MRP in Indian Rupees (INR) as a number
- "unit": one of: kg, gm, ltr, ml, pcs, packet, bottle, bag, dozen, box
- "confidence": your confidence level 0.0 to 1.0`;

const SLIP_PROMPT = `You are an expert OCR system specialized in reading handwritten grocery/wholesale order lists from Indian stores.

TASK: Carefully transcribe EVERY item from this handwritten slip, reading BOTH the left column (amounts) and right column (items) EXACTLY as written.

CRITICAL RULES FOR AMOUNTS:
1. The LEFT COLUMN contains the FINAL LINE TOTAL for each item — this is the EXACT amount the shopkeeper wrote
2. DO NOT recalculate or normalize these amounts. Read the number EXACTLY as handwritten
3. These totals may include wholesale discounts or round-figure pricing that does NOT follow strict (price × qty) math
4. If the left column shows "450" for "300 Laser", the amount is 450 — do NOT change it to match any unit price calculation
5. Treat the left column number as the ground truth total for that line

SLIP LAYOUT:
- LEFT MARGIN: Total amount in ₹ for that line item (e.g., 400, 432, 1100, 1290)
- RIGHT SIDE: Item details in format: "quantity brand/product size"
  Example: "4 set Lux 105" = 4 sets of Lux soap 105gm, total written as 400 on the left
  Example: "36 Margo 10" = 36 pieces of Margo soap 10gm

COMMON ABBREVIATIONS:
- "set" = set/box, "Bx" = box, "Bg" = bag, "Pat" = packet
- "Col" = Colgate, "SE" = Surf Excel, "LB" = Lifebuoy
- "RL" = Rin Liquid, "Red" = Red toothpaste/powder
- Common brands: Lux, Santoor, Lifebuoy, Surf Excel, Margo, Colgate, Closeup, Godrej, Guard, Laser/Laxmi
- "X" marks at end of lines = done/checked (ignore these)
- Look for customer name and date at the top
- Bottom may have a GRAND TOTAL (underlined sum)

Return JSON:
- "name": customer name if found at top (empty string if not)
- "phone": phone number if visible (empty string if not)
- "date": date if visible at top (empty string if not)
- "items": array of ALL items, each with:
  - "name": full item description (e.g. "Lux Soap 105gm")
  - "qty": quantity as a number (the number BEFORE the brand name)
  - "unit": unit (set, box, packet, pieces, bag, kg, etc.)
  - "amount": the EXACT number from the LEFT COLUMN for this line. Read it as-is. Do NOT recalculate.
  - "confidence": reading confidence 0.0-1.0
- "totalItems": count of items found
- "grandTotal": the sum at bottom of slip (0 if not found)
- "language": detected language

CRITICAL: Read the left-column amounts EXACTLY as written. They represent the final negotiated price. Do NOT attempt to verify or recalculate them.`;


const COMMAND_PROMPT = `You are a grocery store voice assistant. Convert spoken commands into structured actions.

Supports English, Hindi, and Hinglish. Common translations:
- "daal do" / "add karo" = ADD
- "hata do" = REMOVE
- "stock bharo" = RESTOCK
- "aadha kilo" = 0.5 kg, "paav kilo" = 0.25 kg

Return JSON with: action (ADD|RESTOCK|REMOVE), item (English name), qty (number), unit (kg/gm/ltr/ml/pcs/packet/bottle/bag/dozen), confidence (0-1)`;

// ── Response Schemas ─────────────────────────────────────────────────────────

const PRODUCT_SCHEMA = {
    type: 'object',
    properties: {
        name: { type: 'string' },
        brand: { type: 'string' },
        category: { type: 'string' },
        price: { type: 'number' },
        unit: { type: 'string' },
        confidence: { type: 'number' },
    },
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
                    amount: { type: 'number' },
                    confidence: { type: 'number' },
                },
                required: ['name', 'qty'],
            },
        },
        totalItems: { type: 'number' },
        grandTotal: { type: 'number' },
        language: { type: 'string' },
        confidence: { type: 'number' },
    },
    required: ['name', 'items'],
};

const COMMAND_SCHEMA = {
    type: 'object',
    properties: {
        action: { type: 'string', enum: ['ADD', 'RESTOCK', 'REMOVE'] },
        item: { type: 'string' },
        qty: { type: 'number' },
        unit: { type: 'string' },
        confidence: { type: 'number' },
    },
    required: ['action', 'item', 'qty', 'unit'],
};

// ── Product Recognition (Image → Product Data) ──────────────────────────────

export const recognizeProduct = async (imageBase64: string): Promise<Partial<Product> | null> => {
    // Image recognition requires Gemini (DeepSeek doesn't support vision)
    const result = await callGemini(
        [
            { text: PRODUCT_PROMPT },
            { inline_data: { mime_type: 'image/jpeg', data: imageBase64 } },
        ],
        PRODUCT_SCHEMA,
    );
    return validateProductResult(result);
};

// ── Slip/Handwritten List OCR (Deep Extraction Pipeline) ─────────────────────

export const extractSlipData = async (imageBase64: string): Promise<SlipOCRResult | null> => {
    // Image OCR requires Gemini (DeepSeek doesn't support vision)
    const result = await callGemini(
        [
            { text: SLIP_PROMPT },
            { inline_data: { mime_type: 'image/jpeg', data: imageBase64 } },
        ],
        SLIP_SCHEMA,
    );
    return validateSlipResult(result);
};

// ── Voice Command Parsing (Text → Structured Action) ─────────────────────────

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
    // Try Gemini first
    try {
        return await callGemini(
            [{ text: `${COMMAND_PROMPT}\n\nVoice command: "${command}"` }],
            COMMAND_SCHEMA,
        );
    } catch (geminiErr) {
        console.warn('[parseCommandAI] Gemini failed, trying DeepSeek...', geminiErr);
    }

    // Fallback to DeepSeek (text-only, no image)
    try {
        return await callDeepSeek(
            'You are a grocery store voice command parser. Return valid JSON only.',
            `${COMMAND_PROMPT}\n\nVoice command: "${command}"`,
        );
    } catch (deepErr) {
        console.error('[parseCommandAI] DeepSeek also failed:', deepErr);
        return null;
    }
};
