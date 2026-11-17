/**
 * Enhanced Scan Memory Service (v2)
 * Now tracks price-based corrections and learns from handwritten text
 * Understands that different product prices = different product types
 */

import { priceBasedDisambiguationService } from './priceBasedDisambiguationService';
import type { Product } from '../../models/Product';

export interface ScannedItemV2 {
  scanId: string;
  timestamp: number;
  scannedText: string;        // Raw text from OCR/barcode
  scannedPrice?: number;      // Price from handwriting/label
  recognizedProduct?: {
    id: string;
    name: string;
    matchScore: number;
  };
  correctedProduct?: {
    id: string;
    name: string;
    correctPrice: number;     // Actual price of corrected product
    reason: string;
  };
  quantity: number;
  unit?: string;
  originalPrice?: number;
  finalPrice?: number;        // After correction
}

export interface PriceProductVariation {
  productId: string;
  variations: string[];
  pricePoints: Map<number, number>; // price -> frequency
  frequency: Record<string, number>;
}

export const enhancedScanMemoryService = {
  currentSession: null as any,

  initializeSession(sessionId: string, products: Product[]) {
    this.currentSession = {
      sessionId,
      startTime: Date.now(),
      items: [],
      productVariations: new Map<string, PriceProductVariation>(),
      correctionHistory: [],
      priceCorrections: [], // Track corrections based on price
    };

    // Initialize price-based service
    priceBasedDisambiguationService.initialize(products);

    return this.currentSession;
  },

  /**
   * Record a scan with price information
   */
  recordScanWithPrice(
    scannedText: string,
    scannedPrice: number | undefined,
    recognizedProduct?: { id: string; name: string; matchScore: number },
    metadata?: { quantity?: number; unit?: string; finalPrice?: number }
  ): ScannedItemV2 {
    if (!this.currentSession) {
      throw new Error('No active scan session');
    }

    const scanItem: ScannedItemV2 = {
      scanId: `scan_${Date.now()}_${Math.random()}`,
      timestamp: Date.now(),
      scannedText,
      scannedPrice,
      recognizedProduct,
      quantity: metadata?.quantity || 1,
      unit: metadata?.unit,
      originalPrice: scannedPrice,
      finalPrice: metadata?.finalPrice || scannedPrice,
    };

    this.currentSession.items.push(scanItem);

    if (recognizedProduct) {
      this.learnProductVariationWithPrice(
        recognizedProduct.id,
        scannedText,
        recognizedProduct.name,
        scannedPrice
      );
    }

    return scanItem;
  },

  learnProductVariationWithPrice(
    productId: string,
    scannedName: string,
    actualName: string,
    price?: number
  ): void {
    if (!this.currentSession) return;

    let variation = this.currentSession.productVariations.get(productId);

    if (!variation) {
      variation = {
        productId,
        variations: [actualName],
        pricePoints: new Map(),
        frequency: { [actualName]: 1 },
      };
      this.currentSession.productVariations.set(productId, variation);
    }

    if (scannedName !== actualName) {
      if (!variation.variations.includes(scannedName)) {
        variation.variations.push(scannedName);
        variation.frequency[scannedName] = 1;
      } else {
        variation.frequency[scannedName] = (variation.frequency[scannedName] || 0) + 1;
      }
    }

    variation.frequency[actualName] = (variation.frequency[actualName] || 0) + 1;

    if (price) {
      variation.pricePoints.set(price, (variation.pricePoints.get(price) || 0) + 1);
    }
  },

  recordPriceBasedCorrection(
    scanId: string,
    scannedPrice: number | undefined,
    toProductId: string,
    toProductName: string,
    actualPrice: number
  ): ScannedItemV2 | null {
    if (!this.currentSession) return null;

    const item = this.currentSession.items.find((s: any) => s.scanId === scanId);
    if (!item) return null;

    item.correctedProduct = {
      id: toProductId,
      name: toProductName,
      correctPrice: actualPrice,
      reason: 'price_indicated_different_product',
    };
    item.finalPrice = actualPrice;

    if (scannedPrice) {
      priceBasedDisambiguationService.recordPriceCorrectionPattern(
        scannedPrice,
        toProductId,
        actualPrice
      );
    }

    this.currentSession.priceCorrections.push({
      scanId,
      scannedPrice,
      correctedProductId: toProductId,
      correctedPrice: actualPrice,
      timestamp: Date.now(),
    });

    return item;
  },

  findProductsByPriceBand(price: number): string[] {
    return priceBasedDisambiguationService.findInPriceBand(price);
  },

  findProductByPrice(price: number): { id: string; name: string; confidence: number } | null {
    const directMatch = priceBasedDisambiguationService.findByExactPrice(price);
    if (directMatch) {
      return {
        id: directMatch.productId,
        name: directMatch.productName,
        confidence: directMatch.confidence,
      };
    }

    const patterns = priceBasedDisambiguationService.getPricePatterns();
    const learned = patterns.find(
      p => Math.abs(p.scannedPrice - price) < price * 0.1
    );

    if (learned) {
      return {
        id: learned.likelyProduct,
        name: learned.likelyProduct,
        confidence: learned.accuracy,
      };
    }

    return null;
  },

  getPriceCorrectionPatterns() {
    return priceBasedDisambiguationService.getPricePatterns();
  },

  getSessionSummary() {
    if (!this.currentSession) return null;

    const priceCorrections = this.currentSession.priceCorrections.length;
    const priceAccuracy = priceCorrections === 0
      ? 1.0
      : 1 - (priceCorrections / this.currentSession.items.length);

    return {
      sessionId: this.currentSession.sessionId,
      duration: Date.now() - this.currentSession.startTime,
      totalItems: this.currentSession.items.length,
      uniqueProducts: this.currentSession.productVariations.size,
      corrections: this.currentSession.correctionHistory.length,
      priceCorrections,
      priceAccuracy,
      items: this.currentSession.items,
      priceLearnings: this.getPriceCorrectionPatterns(),
    };
  },

  getRicePriceBand(riceType: 'regular' | 'type2' | 'basmati') {
    return priceBasedDisambiguationService.getExpectedPriceForRice(riceType);
  },

  endSession() {
    const session = this.currentSession;
    this.currentSession = null;
    return session;
  },

  resetSession() {
    this.currentSession = null;
    priceBasedDisambiguationService.reset();
  },
};