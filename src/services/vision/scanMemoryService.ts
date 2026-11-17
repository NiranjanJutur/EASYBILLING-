/**
 * Scan Memory Service
 * Maintains persistent memory of scanned products during billing session
 * Learns from user corrections and handles product name variations
 */

import type { Product } from '../../models/Product';

export interface ScannedItem {
  scanId: string;
  timestamp: number;
  scannedText: string;      // Raw text from OCR/barcode
  recognizedProduct?: {
    id: string;
    name: string;
    matchScore: number;      // 0-1 confidence
  };
  correctedProduct?: {
    id: string;
    name: string;
    userCorrected: boolean;  // True if user manually changed
  };
  quantity: number;
  unit?: string;
  price?: number;
}

export interface ProductVariation {
  productId: string;
  variations: string[];  // Different names for same product
  frequency: Record<string, number>;  // How often each name appears
}

export interface ScanSession {
  sessionId: string;
  startTime: number;
  items: ScannedItem[];
  productVariations: Map<string, ProductVariation>;
  correctionHistory: Array<{
    scanId: string;
    fromProduct: string;
    toProduct: string;
    reason: string;
  }>;
}

export const scanMemoryService = {
  // Active session memory
  currentSession: null as ScanSession | null,

  /**
   * Initialize new billing session
   */
  initializeSession(sessionId: string): ScanSession {
    this.currentSession = {
      sessionId,
      startTime: Date.now(),
      items: [],
      productVariations: new Map(),
      correctionHistory: [],
    };
    return this.currentSession;
  },

  /**
   * Record a scanned item
   */
  recordScan(
    scannedText: string,
    recognizedProduct?: { id: string; name: string; matchScore: number },
    metadata?: { quantity?: number; unit?: string; price?: number }
  ): ScannedItem {
    if (!this.currentSession) {
      throw new Error('No active scan session');
    }

    const scanItem: ScannedItem = {
      scanId: `scan_${Date.now()}_${Math.random()}`,
      timestamp: Date.now(),
      scannedText,
      recognizedProduct,
      quantity: metadata?.quantity || 1,
      unit: metadata?.unit,
      price: metadata?.price,
    };

    this.currentSession.items.push(scanItem);

    // Learn product variation
    if (recognizedProduct) {
      this.learnProductVariation(
        recognizedProduct.id,
        scannedText,
        recognizedProduct.name
      );
    }

    return scanItem;
  },

  /**
   * Track product name variations
   * Builds knowledge base of how same product is named differently
   */
  learnProductVariation(
    productId: string,
    scannedName: string,
    actualName: string
  ): void {
    if (!this.currentSession) return;

    let variation = this.currentSession.productVariations.get(productId);

    if (!variation) {
      variation = {
        productId,
        variations: [actualName],
        frequency: { [actualName]: 1 },
      };
      this.currentSession.productVariations.set(productId, variation);
    }

    // Track scanned variation if different
    if (scannedName !== actualName) {
      if (!variation.variations.includes(scannedName)) {
        variation.variations.push(scannedName);
        variation.frequency[scannedName] = 1;
      } else {
        variation.frequency[scannedName] = (variation.frequency[scannedName] || 0) + 1;
      }
    }

    variation.frequency[actualName] = (variation.frequency[actualName] || 0) + 1;
  },

  /**
   * When user corrects a product, update memory
   */
  correctScan(
    scanId: string,
    toProductId: string,
    toProductName: string,
    reason: string = 'user_correction'
  ): ScannedItem | null {
    if (!this.currentSession) return null;

    const item = this.currentSession.items.find(s => s.scanId === scanId);
    if (!item) return null;

    const fromProductId = item.recognizedProduct?.id || 'unknown';
    const fromProductName = item.recognizedProduct?.name || item.scannedText;

    // Record correction
    item.correctedProduct = {
      id: toProductId,
      name: toProductName,
      userCorrected: true,
    };

    this.currentSession.correctionHistory.push({
      scanId,
      fromProduct: `${fromProductId}:${fromProductName}`,
      toProduct: `${toProductId}:${toProductName}`,
      reason,
    });

    // Learn this variation
    this.learnProductVariation(toProductId, item.scannedText, toProductName);

    return item;
  },

  /**
   * Get all scanned items in session
   */
  getSessionItems(): ScannedItem[] {
    return this.currentSession?.items || [];
  },

  /**
   * Get product variations learned in this session
   */
  getProductVariations(): Map<string, ProductVariation> {
    return this.currentSession?.productVariations || new Map();
  },

  /**
   * Check if we've seen this product name before in session
   * Returns matching product ID if found
   */
  findProductByVariation(scannedText: string): { id: string; name: string } | null {
    if (!this.currentSession) return null;

    // Exact match first
    for (const [productId, variation] of this.currentSession.productVariations) {
      if (variation.variations.includes(scannedText)) {
        return { id: productId, name: variation.variations[0] };
      }
    }

    // Fuzzy match
    let bestMatch: { id: string; name: string; score: number } | null = null;
    const threshold = 0.7;

    for (const [productId, variation] of this.currentSession.productVariations) {
      for (const varName of variation.variations) {
        const score = this.calculateSimilarity(scannedText, varName);
        if (score > threshold && (!bestMatch || score > bestMatch.score)) {
          bestMatch = { id: productId, name: varName, score };
        }
      }
    }

    return bestMatch ? { id: bestMatch.id, name: bestMatch.name } : null;
  },

  /**
   * Calculate string similarity (Levenshtein distance)
   * Returns 0-1 where 1 is exact match
   */
  calculateSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();

    if (s1 === s2) return 1;

    // Check if one contains the other
    if (s1.includes(s2) || s2.includes(s1)) return 0.9;

    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;

    if (longer.length === 0) return 1.0;

    const editDistance = this.getEditDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  },

  /**
   * Levenshtein distance algorithm
   */
  getEditDistance(s1: string, s2: string): number {
    const costs = [];

    for (let i = 0; i <= s1.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= s2.length; j++) {
        if (i === 0) {
          costs[j] = j;
        } else if (j > 0) {
          let newValue = costs[j - 1];
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
      if (i > 0) costs[s2.length] = lastValue;
    }

    return costs[s2.length];
  },

  /**
   * Get correction statistics
   */
  getCorrectionStats(): {
    totalScans: number;
    correctedScans: number;
    correctionRate: number;
    mostCorrectedProducts: Array<{ product: string; count: number }>;
  } {
    if (!this.currentSession) {
      return {
        totalScans: 0,
        correctedScans: 0,
        correctionRate: 0,
        mostCorrectedProducts: [],
      };
    }

    const totalScans = this.currentSession.items.length;
    const correctedScans = this.currentSession.items.filter(
      i => i.correctedProduct
    ).length;

    const productCorrectionCount: Record<string, number> = {};
    this.currentSession.correctionHistory.forEach(correction => {
      productCorrectionCount[correction.toProduct] =
        (productCorrectionCount[correction.toProduct] || 0) + 1;
    });

    const mostCorrectedProducts = Object.entries(productCorrectionCount)
      .map(([product, count]) => ({ product, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalScans,
      correctedScans,
      correctionRate: totalScans > 0 ? correctedScans / totalScans : 0,
      mostCorrectedProducts,
    };
  },

  /**
   * Get session summary
   */
  getSessionSummary() {
    if (!this.currentSession) return null;

    return {
      sessionId: this.currentSession.sessionId,
      duration: Date.now() - this.currentSession.startTime,
      totalItems: this.currentSession.items.length,
      uniqueProducts: this.currentSession.productVariations.size,
      corrections: this.currentSession.correctionHistory.length,
      stats: this.getCorrectionStats(),
      items: this.currentSession.items,
    };
  },

  /**
   * End session and clear memory
   */
  endSession(): ScanSession | null {
    const session = this.currentSession;
    this.currentSession = null;
    return session;
  },

  /**
   * Reset current session
   */
  resetSession(): void {
    this.currentSession = null;
  },
};