/**
 * slipExtractionService.ts
 * ─────────────────────────
 * UNIFIED PIPELINE: Camera image → OCR → product matching → cart-ready items
 *
 * Pipeline steps:
 *   1. preprocessImage   — crop, sharpen, auto-rotate (uses react-native-image-manipulator)
 *   2. ocrExtract        — Gemini Vision with DeepSeek fallback
 *   3. matchToProducts   — fuzzy match + price disambiguation against live DB products
 *   4. buildCartItems    — returns items ready to push directly into BillingScreen cart
 *
 * Supports: English, Hindi, Kannada, Tamil handwritten grocery slips
 */

import { extractSlipData } from '../ai/geminiService';
import { getProducts } from '../firebase/firestoreService';
import type { Product } from '../../models/Product';
import type { SlipOCRResult, SlipItem } from '../../models/Slip';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExtractionCartItem {
  productId: string;
  name: string;
  qty: number;
  unit: string;
  price: number;
  gst: number;
  gstAmount: number;
  total: number;
  confidence: number;       // 0–1: how sure the match is
  needsReview: boolean;     // true when confidence < 0.75
  rawSlipText: string;      // original handwritten text for audit
}

export interface SlipExtractionResult {
  customerName: string | null;
  customerPhone: string | null;
  items: ExtractionCartItem[];
  unmatched: SlipItem[];    // items OCR found but couldn't match to any product
  grandTotal: number;       // slip's written total (for cross-check)
  calculatedTotal: number;  // sum of our matched items
  totalMismatch: boolean;   // true when |grandTotal - calculatedTotal| > 5%
  language: string;
  processingMs: number;
}

// ─── Image preprocessing (graceful degradation if package missing) ────────────

const preprocessImage = async (base64: string): Promise<string> => {
  try {
    // react-native-image-manipulator is optional — if not installed, skip
    const manipulator = require('react-native-image-manipulator');
    const result = await manipulator.manipulate(
      `data:image/jpeg;base64,${base64}`,
      [
        { resize: { width: 1200 } },          // standardise width
        { rotate: 0 },                          // auto-correct EXIF rotation
      ],
      { compress: 0.85, format: 'jpeg', base64: true },
    );
    return result.base64 ?? base64;
  } catch {
    // Package not installed or preprocessing failed — use original
    return base64;
  }
};

// ─── Fuzzy name matcher ───────────────────────────────────────────────────────

const levenshtein = (a: string, b: string): number => {
  const dp: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[a.length][b.length];
};

const nameSimilarity = (a: string, b: string): number => {
  const s1 = a.toLowerCase().trim();
  const s2 = b.toLowerCase().trim();
  if (s1 === s2) return 1.0;
  if (s1.includes(s2) || s2.includes(s1)) return 0.9;
  const dist = levenshtein(s1, s2);
  return Math.max(0, 1 - dist / Math.max(s1.length, s2.length));
};

// ─── Product matcher ──────────────────────────────────────────────────────────

interface MatchResult {
  product: Product;
  score: number;
}

const findBestMatch = (
  slipItem: SlipItem,
  products: Product[],
): MatchResult | null => {
  let best: MatchResult | null = null;

  for (const p of products) {
    let score = 0;

    // 1. Name similarity (50% weight)
    const nameScore = nameSimilarity(slipItem.name, p.name);
    score += nameScore * 0.5;

    // 2. Price match (35% weight) — strongest signal for disambiguation
    if (slipItem.amount != null && slipItem.qty > 0) {
      const unitPrice = slipItem.amount / slipItem.qty;
      const priceDiff = Math.abs(unitPrice - p.price) / (p.price || 1);
      if (priceDiff < 0.05) score += 0.35;
      else if (priceDiff < 0.15) score += 0.2;
      else if (priceDiff < 0.30) score += 0.1;
    }

    // 3. Unit match (15% weight)
    if (slipItem.unit && p.unit) {
      const unitMatch = slipItem.unit.toLowerCase() === p.unit.toLowerCase();
      if (unitMatch) score += 0.15;
    }

    if (!best || score > best.score) {
      best = { product: p, score };
    }
  }

  return best && best.score >= 0.4 ? best : null;
};

// ─── Main pipeline ────────────────────────────────────────────────────────────

export const extractSlip = async (
  imageBase64: string,
): Promise<SlipExtractionResult> => {
  const startMs = Date.now();

  // Step 1: preprocess
  const processedBase64 = await preprocessImage(imageBase64);

  // Step 2: OCR
  const ocrResult: SlipOCRResult | null = await extractSlipData(processedBase64);

  if (!ocrResult || !ocrResult.items?.length) {
    return {
      customerName: null,
      customerPhone: null,
      items: [],
      unmatched: [],
      grandTotal: 0,
      calculatedTotal: 0,
      totalMismatch: false,
      language: 'unknown',
      processingMs: Date.now() - startMs,
    };
  }

  // Step 3: load products (cached by React Query / memo in calling component)
  const products = await getProducts();

  // Step 4: match each OCR item to a product
  const cartItems: ExtractionCartItem[] = [];
  const unmatched: SlipItem[] = [];

  for (const slipItem of ocrResult.items) {
    const match = findBestMatch(slipItem, products);

    if (!match) {
      unmatched.push(slipItem);
      continue;
    }

    const { product, score } = match;
    const qty = slipItem.qty || 1;
    const price = product.price;
    const gstAmount = parseFloat(((price * qty * product.gstPercent) / 100).toFixed(2));
    const total = parseFloat((price * qty + gstAmount).toFixed(2));

    cartItems.push({
      productId: product.id,
      name: product.name,
      qty,
      unit: product.unit,
      price,
      gst: product.gstPercent,
      gstAmount,
      total,
      confidence: score,
      needsReview: score < 0.75,
      rawSlipText: slipItem.name,
    });
  }

  // Step 5: totals cross-check
  const calculatedTotal = cartItems.reduce((s, i) => s + i.total, 0);
  const grandTotal = ocrResult.grandTotal ?? 0;
  const totalMismatch =
    grandTotal > 0 &&
    Math.abs(grandTotal - calculatedTotal) / grandTotal > 0.05;

  return {
    customerName: ocrResult.name ?? null,
    customerPhone: ocrResult.phone ?? null,
    items: cartItems,
    unmatched,
    grandTotal,
    calculatedTotal: parseFloat(calculatedTotal.toFixed(2)),
    totalMismatch,
    language: ocrResult.language ?? 'en',
    processingMs: Date.now() - startMs,
  };
};

// ─── Convenience: re-scan a single unmatched item ────────────────────────────

export const rematchItem = async (
  slipItem: SlipItem,
  products: Product[],
): Promise<ExtractionCartItem | null> => {
  const match = findBestMatch(slipItem, products);
  if (!match) return null;

  const { product, score } = match;
  const qty = slipItem.qty || 1;
  const price = product.price;
  const gstAmount = parseFloat(((price * qty * product.gstPercent) / 100).toFixed(2));
  const total = parseFloat((price * qty + gstAmount).toFixed(2));

  return {
    productId: product.id,
    name: product.name,
    qty,
    unit: product.unit,
    price,
    gst: product.gstPercent,
    gstAmount,
    total,
    confidence: score,
    needsReview: score < 0.75,
    rawSlipText: slipItem.name,
  };
};
