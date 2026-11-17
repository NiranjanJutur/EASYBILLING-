/**
 * useSlipExtraction.ts
 * ──────────────────────
 * React hook for the slip extraction pipeline.
 * Handles camera permission, image capture, and OCR state.
 *
 * Usage:
 *   const { extract, result, loading, error, reset } = useSlipExtraction();
 *   // In your component:
 *   <Button onPress={() => extract(imageBase64)} />
 *   {result?.items.map(item => <CartRow item={item} />)}
 */

import { useState, useCallback } from 'react';
import { extractSlip, SlipExtractionResult } from '../services/vision/slipExtractionService';

interface UseSlipExtractionReturn {
  extract:  (imageBase64: string) => Promise<void>;
  result:   SlipExtractionResult | null;
  loading:  boolean;
  error:    string | null;
  reset:    () => void;
}

export const useSlipExtraction = (): UseSlipExtractionReturn => {
  const [result,  setResult]  = useState<SlipExtractionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const extract = useCallback(async (imageBase64: string) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await extractSlip(imageBase64);
      setResult(res);
    } catch (e: any) {
      setError(e?.message ?? 'Extraction failed');
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { extract, result, loading, error, reset };
};
