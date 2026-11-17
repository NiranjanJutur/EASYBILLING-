/**
 * Handwriting OCR Service
 * Specializes in recognizing handwritten text from product packages/slips
 * Sends images to Gemini Vision API for accurate OCR
 */

import { analyzeImage } from '../ai/geminiService';
import type { Product } from '../../models/Product';

export interface HandwritingOCRResult {
  rawText: string;              // Recognized text
  confidence: number;           // 0-1 how confident
  extractedFields: {
    productName?: string;       // e.g., "Basmati Rice"
    price?: number;             // e.g., 110
    quantity?: number;          // e.g., 2
    unit?: string;              // e.g., "kg"
    weight?: string;            // e.g., "1kg", "500g"
    date?: string;              // Expiry/MFG date
  };
  suggestedProducts: Array<{
    id: string;
    name: string;
    matchScore: number;         // 0-1 how well it matches
    priceMatch: boolean;        // If price matches
  }>;
}

export const handwritingOCRService = {
  /**
   * Process handwritten text from image
   * Optimized for product packages, price labels, handwritten notes
   */
  async recognizeHandwriting(
    imagePath: string,
    products: Product[],
    contextPrice?: number  // Hint: if price is written, pass it
  ): Promise<HandwritingOCRResult> {
    try {
      // Send to Gemini for handwriting recognition
      const extractionPrompt = `
You are a handwriting recognition expert for grocery store products.
Analyze this image and extract:

1. Product name (rice type, brand, etc.)
2. Price (if visible)
3. Quantity/Weight (kg, g, liters, units)
4. Manufacturing/Expiry date (if visible)
5. Any other text

Return JSON only, no other text:
{
  "productName": "extracted product name",
  "price": null or number,
  "quantity": null or number,
  "unit": "kg/g/l/pieces or null",
  "weight": "formatted weight like 1kg or 500g",
  "date": "extracted date or null",
  "allText": "all recognized text",
  "confidence": 0 to 1
}
`;

      // In production, this calls geminiService.analyzeImage
      const ocrResult = await analyzeImage(imagePath, extractionPrompt);
      const parsed = JSON.parse(ocrResult);

      // Normalize extracted data
      const result: HandwritingOCRResult = {
        rawText: parsed.allText || '',
        confidence: parsed.confidence || 0.5,
        extractedFields: {
          productName: parsed.productName,
          price: parsed.price,
          quantity: parsed.quantity,
          unit: parsed.unit,
          weight: parsed.weight,
          date: parsed.date,
        },
        suggestedProducts: [],
      };

      // Find matching products
      result.suggestedProducts = this.matchProductsByHandwriting(
        result.extractedFields,
        products,
        contextPrice
      );

      return result;
    } catch (error) {
      console.error('Handwriting OCR failed:', error);
      return {
        rawText: '',
        confidence: 0,
        extractedFields: {},
        suggestedProducts: [],
      };
    }
  },

  /**
   * Match products based on handwritten extraction
   */
  matchProductsByHandwriting(
    extracted: any,
    products: Product[],
    contextPrice?: number
  ): Array<{ id: string; name: string; matchScore: number; priceMatch: boolean }> {
    const matches = products
      .map(product => {
        let score = 0;
        let priceMatch = false;

        // 1. Price is strongest signal (40% weight)
        if (extracted.price) {
          const priceDiff = Math.abs(product.price - extracted.price) / product.price;
          if (priceDiff < 0.05) {
            score += 0.4;
            priceMatch = true;
          } else if (priceDiff < 0.15) {
            score += 0.2;
          }
        } else if (contextPrice) {
          const priceDiff = Math.abs(product.price - contextPrice) / product.price;
          if (priceDiff < 0.1) {
            score += 0.3;
            priceMatch = true;
          }
        }

        // 2. Product name text matching (35% weight)
        if (extracted.productName) {
          const similarity = this.calculateNameSimilarity(
            extracted.productName,
            product.name
          );
          score += similarity * 0.35;
        }

        // 3. Quantity matching (15% weight)
        if (extracted.quantity && product.packSize) {
          if (extracted.quantity === product.packSize) {
            score += 0.15;
          }
        }

        // 4. Weight/Unit matching (10% weight)
        if (extracted.unit && product.unit) {
          if (extracted.unit.toLowerCase() === product.unit.toLowerCase()) {
            score += 0.1;
          }
        }

        return {
          id: product.id,
          name: product.name,
          matchScore: Math.min(score, 1),
          priceMatch,
        };
      })
      .filter(m => m.matchScore > 0.3)
      .sort((a, b) => {
        if (a.priceMatch !== b.priceMatch) {
          return a.priceMatch ? -1 : 1;
        }
        return b.matchScore - a.matchScore;
      })
      .slice(0, 5);

    return matches;
  },

  /**
   * Calculate similarity between handwritten product name and database product
   */
  calculateNameSimilarity(handwrittenName: string, dbName: string): number {
    const h = handwrittenName.toLowerCase().trim();
    const d = dbName.toLowerCase().trim();

    if (h === d) return 1.0;
    if (h.includes(d) || d.includes(h)) return 0.85;

    const distance = this.getEditDistance(h, d);
    const maxLen = Math.max(h.length, d.length);
    return Math.max(0, (maxLen - distance) / maxLen);
  },

  /**
   * Levenshtein distance
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
   * Extract just the price from handwritten text
   */
  extractPrice(text: string): number | null {
    const patterns = [
      /₹\s*(\d+(?:\.\d{2})?)/,
      /Rs\.?\s*(\d+(?:\.\d{2})?)/i,
      /price[:\s]*(\d+(?:\.\d{2})?)/i,
      /(\d+(?:\.\d{2})?)\s*(?:₹|rs|rupees)/i,
      /^(\d+(?:\.\d{2})?)$/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return parseFloat(match[1]);
      }
    }

    return null;
  },

  /**
   * Extract weight/quantity from handwritten text
   */
  extractWeight(text: string): { quantity: number; unit: string; formatted: string } | null {
    const patterns = [
      /(\d+(?:\.\d+)?)\s*(kg|gram|g|liter|litre|l|ml|pcs|piece|units|no\.)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return {
          quantity: parseFloat(match[1]),
          unit: match[2],
          formatted: `${match[1]}${match[2]}`,
        };
      }
    }

    return null;
  },

  /**
   * Identify rice type by handwriting patterns
   */
  identifyRiceType(handwrittenText: string): 'basmati' | 'regular' | 'unknown' {
    const text = handwrittenText.toLowerCase();

    if (text.includes('basmati') || text.includes('basmti') || text.includes('basmatic')) {
      return 'basmati';
    }

    if (
      text.includes('regular') ||
      text.includes('common rice') ||
      text.includes('white rice')
    ) {
      return 'regular';
    }

    return 'unknown';
  },
};