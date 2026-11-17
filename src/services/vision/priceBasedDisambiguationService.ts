/**
 * Price-Based Product Disambiguation Service
 * Uses price as primary signal to identify product type
 * Especially useful for rice: ₹45 (Regular), ₹60 (Type2), ₹110 (Basmati)
 */

import type { Product } from '../../models/Product';

export interface PriceProductMapping {
  price: number;
  productId: string;
  productName: string;
  confidence: number;         // How certain we are
  frequency: number;          // How many times seen
  lastSeen: number;          // Timestamp
}

export interface PriceBand {
  min: number;
  max: number;
  products: string[];        // Product IDs in this price range
}

export const priceBasedDisambiguationService = {
  // Build price-to-product mapping from database
  priceProductMap: new Map<number, PriceProductMapping>(),
  priceBands: [] as PriceBand[],
  correctionHistory: [] as Array<{
    scannedPrice: number;
    userCorrectedProduct: string;
    timestamp: number;
    count: number;
  }>,

  /**
   * Initialize service with product database
   * Build price bands and mappings
   */
  initialize(products: Product[]): void {
    // Clear existing
    this.priceProductMap.clear();
    this.priceBands = [];

    // Build price -> product mapping
    products.forEach(product => {
      if (product.price) {
        this.priceProductMap.set(product.price, {
          price: product.price,
          productId: product.id,
          productName: product.name,
          confidence: 1.0, // Default high confidence from database
          frequency: 0,
          lastSeen: Date.now(),
        });
      }
    });

    // Build price bands (handle slight variations)
    // Example: ₹110 for Basmati might be ₹108-115
    const priceMap = new Map<number, string[]>();

    products.forEach(product => {
      if (product.price) {
        if (!priceMap.has(product.price)) {
          priceMap.set(product.price, []);
        }
        priceMap.get(product.price)!.push(product.id);
      }
    });

    const prices = Array.from(priceMap.keys()).sort((a, b) => a - b);

    prices.forEach(price => {
      // Create bands around each price point (±10%)
      const margin = price * 0.1;
      this.priceBands.push({
        min: price - margin,
        max: price + margin,
        products: priceMap.get(price) || [],
      });
    });
  },

  /**
   * Find product by exact price
   * Used when handwriting shows clear price
   */
  findByExactPrice(price: number): PriceProductMapping | null {
    // Try exact match first
    const mapping = this.priceProductMap.get(price);
    if (mapping) {
      return mapping;
    }

    // Try within tolerance (±2%)
    const tolerance = price * 0.02;
    for (const [mappedPrice, mapping] of this.priceProductMap) {
      if (Math.abs(mappedPrice - price) <= tolerance) {
        return mapping;
      }
    }

    return null;
  },

  /**
   * Find product(s) in price band
   * When price is approximate or rounded
   */
  findInPriceBand(price: number): string[] {
    const band = this.priceBands.find(
      b => price >= b.min && price <= b.max
    );
    return band ? band.products : [];
  },

  /**
   * Disambiguate between products using price
   * Example: "Rice" could be ₹45, ₹60, or ₹110
   * Given price, we can determine which one
   */
  disambiguateByPrice(
    possibleProducts: string[],
    scannedPrice: number,
    products: Product[]
  ): { productId: string; confidence: number } | null {
    if (!scannedPrice || possibleProducts.length === 0) {
      return null;
    }

    const matches = possibleProducts
      .map(productId => {
        const product = products.find(p => p.id === productId);
        if (!product || !product.price) return null;

        const priceDiff = Math.abs(product.price - scannedPrice) / product.price;
        let confidence = 1 - priceDiff;

        // Boost confidence if price is exact match
        if (priceDiff < 0.02) confidence = Math.min(1.0, confidence + 0.2);
        // Reduce confidence if difference is significant
        if (priceDiff > 0.3) confidence = 0;

        return {
          productId,
          price: product.price,
          confidence,
        };
      })
      .filter(m => m && m.confidence > 0)
      .sort((a, b) => (b?.confidence || 0) - (a?.confidence || 0));

    return matches.length > 0 && matches[0] ? matches[0] : null;
  },

  /**
   * When user corrects a product, learn the price association
   */
  recordPriceCorrectionPattern(
    scannedPrice: number,
    actualProductId: string,
    actualPrice: number
  ): void {
    const existing = this.correctionHistory.find(
      h => h.scannedPrice === scannedPrice && h.userCorrectedProduct === actualProductId
    );

    if (existing) {
      existing.count++;
      existing.timestamp = Date.now();
    } else {
      this.correctionHistory.push({
        scannedPrice,
        userCorrectedProduct: actualProductId,
        timestamp: Date.now(),
        count: 1,
      });
    }
  },

  /**
   * Get price-to-product learning statistics
   */
  getPricePatterns(): Array<{
    scannedPrice: number;
    likelyProduct: string;
    count: number;
    accuracy: number;
  }> {
    return this.correctionHistory
      .sort((a, b) => b.count - a.count)
      .map(h => ({
        scannedPrice: h.scannedPrice,
        likelyProduct: h.userCorrectedProduct,
        count: h.count,
        accuracy: h.count / (h.count + 1),
      }));
  },

  /**
   * Smart product selection using price as tiebreaker
   */
  selectByPriceContext(
    candidates: Array<{ id: string; name: string; matchScore: number }>,
    scannedPrice?: number,
    products?: Product[]
  ): string {
    if (candidates.length === 0) return '';
    if (candidates.length === 1) return candidates[0].id;

    if (!scannedPrice || !products) {
      return candidates.sort((a, b) => b.matchScore - a.matchScore)[0].id;
    }

    const withPriceScores = candidates.map(cand => {
      const product = products.find(p => p.id === cand.id);
      if (!product || !product.price) {
        return { ...cand, priceScore: 0 };
      }

      const priceDiff = Math.abs(product.price - scannedPrice) / product.price;
      const priceScore = Math.max(0, 1 - priceDiff);

      return {
        ...cand,
        priceScore,
        combinedScore: cand.matchScore * 0.6 + priceScore * 0.4,
      };
    });

    const best = withPriceScores.sort(
      (a: any, b: any) => (b.combinedScore || 0) - (a.combinedScore || 0)
    )[0];

    return best.id;
  },

  /**
   * For rice specifically, determine type by price
   * ₹45 = Regular Rice
   * ₹60 = Type 2 Rice  
   * ₹110 = Basmati Rice
   */
  identifyRiceTypeByPrice(price: number): 'regular' | 'type2' | 'basmati' | 'unknown' {
    const tolerance = price * 0.1;

    if (Math.abs(price - 45) <= tolerance) return 'regular';
    if (Math.abs(price - 60) <= tolerance) return 'type2';
    if (Math.abs(price - 110) <= tolerance) return 'basmati';

    return 'unknown';
  },

  /**
   * Predict price from product type
   */
  getExpectedPriceForRice(
    type: 'regular' | 'type2' | 'basmati'
  ): { price: number; range: { min: number; max: number } } {
    const prices = {
      regular: { price: 45, range: { min: 40, max: 50 } },
      type2: { price: 60, range: { min: 54, max: 66 } },
      basmati: { price: 110, range: { min: 99, max: 121 } },
    };

    return prices[type];
  },

  /**
   * Suggest likely alternatives after correction
   */
  getSuggestionsAfterCorrection(
    initialPrice: number,
    correctedProductId: string,
    products: Product[]
  ): string[] {
    const similarPatterns = this.correctionHistory.filter(
      h => Math.abs(h.scannedPrice - initialPrice) < initialPrice * 0.15
    );

    const productCounts: Record<string, number> = {};
    similarPatterns.forEach(h => {
      productCounts[h.userCorrectedProduct] = (productCounts[h.userCorrectedProduct] || 0) + 1;
    });

    return Object.entries(productCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([productId]) => productId);
  },

  /**
   * Reset learning
   */
  reset(): void {
    this.priceProductMap.clear();
    this.priceBands = [];
    this.correctionHistory = [];
  },
};