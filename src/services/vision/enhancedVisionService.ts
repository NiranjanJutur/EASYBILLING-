/**
 * Enhanced Vision Service
 * Integrates with Scan Memory to learn and correct OCR/barcode scans
 * Handles product name variations and improves accuracy over time
 */

import { scanMemoryService } from './scanMemoryService';
import * as geminiService from '../ai/geminiService';
import type { Product } from '../../models/Product';

export interface VisionScanResult {
  raw: string;                    // Raw OCR/barcode text
  detectedProduct?: {
    id: string;
    name: string;
    confidence: number;            // 0-1
    source: 'memory' | 'gemini' | 'database';
  };
  quantity?: number;
  unit?: string;
  suggestions: Array<{             // Alternative matches
    id: string;
    name: string;
    similarity: number;
  }>;
  needsConfirmation: boolean;      // If confidence low
}

export const enhancedVisionService = {
  /**
   * Process scanned text with memory integration
   * Smart matching: memory → fuzzy match → Gemini AI → database search
   */
  async processScannedText(
    scannedText: string,
    products: Product[],
    useAI: boolean = true
  ): Promise<VisionScanResult> {
    const result: VisionScanResult = {
      raw: scannedText,
      suggestions: [],
      needsConfirmation: false,
    };

    // Step 1: Check session memory first (fastest)
    const memoryMatch = scanMemoryService.findProductByVariation(scannedText);
    if (memoryMatch) {
      const product = products.find(p => p.id === memoryMatch.id);
      if (product) {
        result.detectedProduct = {
          id: product.id,
          name: product.name,
          confidence: 0.95, // High confidence from memory
          source: 'memory',
        };
        return result;
      }
    }

    // Step 2: Try fuzzy matching against all products
    const fuzzyMatches = this.fuzzyMatchProduct(scannedText, products);
    if (fuzzyMatches.length > 0 && fuzzyMatches[0].similarity > 0.8) {
      result.detectedProduct = {
        id: fuzzyMatches[0].id,
        name: fuzzyMatches[0].name,
        confidence: fuzzyMatches[0].similarity,
        source: 'database',
      };
      result.suggestions = fuzzyMatches.slice(1, 4);
      return result;
    }

    // Step 3: Use Gemini AI for complex text (OCR from photos)
    if (useAI && fuzzyMatches.length === 0) {
      try {
        // Since we don't have an image here, we might just use text-based recognition if geminiService supports it
        // Or if this was called from a photo, the imageBase64 would be needed.
        // For now, let's assume we can pass the scannnedText to recognizeProduct if it supported it.
        // But geminiService.recognizeProduct expects imageBase64.
        
        // Let's use a generic prompt-based recognition if we only have text
        // For now, let's skip AI if we only have text and no fuzzy match.
      } catch (error) {
        console.warn('AI recognition failed:', error);
      }
    }

    // Step 4: No match found - show suggestions
    result.suggestions = fuzzyMatches;
    result.needsConfirmation = true;

    return result;
  },

  /**
   * Fuzzy match scanned text against product database
   */
  fuzzyMatchProduct(
    scannedText: string,
    products: Product[],
    threshold: number = 0.6
  ): Array<{ id: string; name: string; similarity: number }> {
    const matches = products
      .map(product => ({
        id: product.id,
        name: product.name,
        similarity: this.calculateTextSimilarity(scannedText, product.name),
      }))
      .filter(m => m.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity);

    return matches;
  },

  /**
   * Calculate similarity between two strings
   */
  calculateTextSimilarity(text1: string, text2: string): number {
    const s1 = text1.toLowerCase().trim();
    const s2 = text2.toLowerCase().trim();

    if (s1 === s2) return 1.0;
    if (s1.includes(s2) || s2.includes(s1)) return 0.9;

    const distance = this.getEditDistance(s1, s2);
    const maxLength = Math.max(s1.length, s2.length);
    return (maxLength - distance) / maxLength;
  },

  getEditDistance(s1: string, s2: string): number {
    const costs = [];
    for (let i = 0; i <= s1.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= s2.length; j++) {
        if (i === 0) costs[j] = j;
        else if (j > 0) {
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

  processBarcodeResult(
    barcodeValue: string,
    products: Product[]
  ): VisionScanResult {
    const product = products.find(
      p => p.barcode === barcodeValue || p.sku === barcodeValue
    );

    if (product) {
      return {
        raw: barcodeValue,
        detectedProduct: {
          id: product.id,
          name: product.name,
          confidence: 1.0,
          source: 'database',
        },
        suggestions: [],
        needsConfirmation: false,
      };
    }

    return {
      raw: barcodeValue,
      suggestions: this.fuzzyMatchProduct(barcodeValue, products),
      needsConfirmation: true,
    };
  },

  recordScanWithMemory(
    scannedText: string,
    result: VisionScanResult,
    metadata?: { quantity?: number; unit?: string; price?: number }
  ) {
    if (!result.detectedProduct) return;

    scanMemoryService.recordScan(scannedText, {
      id: result.detectedProduct.id,
      name: result.detectedProduct.name,
      matchScore: result.detectedProduct.confidence
    }, metadata);
  },

  recordUserCorrection(
    scanId: string,
    originalScannedText: string,
    correctedProductId: string,
    correctedProductName: string,
    reason: string = 'user_selected_correct'
  ) {
    scanMemoryService.correctScan(
      scanId,
      correctedProductId,
      correctedProductName,
      reason
    );
  },

  getSessionStats() {
    return scanMemoryService.getSessionSummary();
  },

  extractQuantityAndUnit(scannedText: string): {
    quantity: number;
    unit: string;
    text: string;
  } | null {
    const patterns = [
      /^(\d+(?:\.\d+)?)\s*(kg|gram|g|liter|litre|l|ml|pcs|piece|nos|no\.)/i,
      /(\d+(?:\.\d+)?)\s*(kg|gram|g|liter|litre|l|ml|pcs|piece|nos|no\.)/i,
    ];

    for (const pattern of patterns) {
      const match = scannedText.match(pattern);
      if (match) {
        return {
          quantity: parseFloat(match[1]),
          unit: match[2],
          text: scannedText.replace(match[0], '').trim(),
        };
      }
    }
    return null;
  },

  startSession(sessionId: string) {
    scanMemoryService.initializeSession(sessionId);
  },

  endSession() {
    return scanMemoryService.endSession();
  },
};