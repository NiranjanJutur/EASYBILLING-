/**
 * taxCalc.test.ts — Unit tests for the shared GST tax calculation module.
 *
 * Run: npx jest __tests__/taxCalc.test.ts
 */

import { computeTax, amountInWords, isInterState, gstinStateCode } from '../src/services/billing/taxCalc';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const r2 = (n: number) => Math.round(n * 100) / 100;

const item = (
  name: string,
  price: number,
  qty: number,
  gst: number,
  productId = name,
  hsn = '',
) => ({ productId, name, price, qty, gst, unit: 'pcs', hsn });

// ─── GSTIN helpers ────────────────────────────────────────────────────────────

describe('gstinStateCode', () => {
  it('extracts first two chars', () => {
    expect(gstinStateCode('29ABCDE1234F1Z5')).toBe('29');
    expect(gstinStateCode('07ABCDE1234F1Z5')).toBe('07');
  });
  it('returns empty string for null/undefined', () => {
    expect(gstinStateCode(null)).toBe('');
    expect(gstinStateCode(undefined)).toBe('');
  });
});

describe('isInterState', () => {
  it('false when both same state', () => {
    expect(isInterState('29ABCDE1234F1Z5', '29XYZAB1234G1Z9')).toBe(false);
  });
  it('true when different states', () => {
    expect(isInterState('29ABCDE1234F1Z5', '07XYZAB1234G1Z9')).toBe(true);
  });
  it('false when customer GSTIN is missing', () => {
    expect(isInterState('29ABCDE1234F1Z5', null)).toBe(false);
    expect(isInterState('29ABCDE1234F1Z5', '')).toBe(false);
  });
});

// ─── Empty cart ───────────────────────────────────────────────────────────────

describe('computeTax — empty cart', () => {
  it('returns all zeros', () => {
    const bd = computeTax([]);
    expect(bd.grandTotal).toBe(0);
    expect(bd.totalTax).toBe(0);
    expect(bd.discountAmount).toBe(0);
    expect(bd.amountInWords).toBe('Zero Rupees Only');
  });
});

// ─── Single item, no discount ─────────────────────────────────────────────────

describe('computeTax — single item no discount', () => {
  it('Rice 5kg x 2 @ ₹60, 5% GST', () => {
    const bd = computeTax([item('Rice 5kg', 60, 2, 5)]);
    expect(bd.subtotalBeforeDiscount).toBe(120);
    expect(bd.discountAmount).toBe(0);
    expect(bd.taxableValue).toBe(120);
    const expectedTax = r2(120 * 0.05); // 6.00
    expect(bd.totalTax).toBe(expectedTax);
    expect(bd.grandTotalExact).toBe(r2(120 + expectedTax));
    // No IGST (no customer GSTIN)
    expect(bd.isIgst).toBe(false);
    expect(bd.totalCGST).toBe(r2(expectedTax / 2));
    expect(bd.totalSGST).toBe(r2(expectedTax / 2));
    expect(r2(bd.totalCGST + bd.totalSGST)).toBe(bd.totalTax);
  });
});

// ─── Discount before tax ──────────────────────────────────────────────────────

describe('computeTax — discount before tax', () => {
  it('₹10 flat discount on ₹165 subtotal, 5% GST', () => {
    const items = [item('Rice', 60, 2, 5), item('Sugar', 45, 1, 5)]; // subtotal=165
    const bd = computeTax(items, { discountRupees: 10 });

    expect(bd.subtotalBeforeDiscount).toBe(165);
    expect(bd.discountAmount).toBe(10);
    expect(bd.taxableValue).toBe(155); // 165 - 10

    const expectedTax = r2(155 * 0.05); // 7.75
    expect(bd.totalTax).toBe(expectedTax);
    expect(bd.grandTotalExact).toBe(r2(155 + expectedTax));
  });

  it('percent discount — 10% on ₹200 subtotal', () => {
    const bd = computeTax([item('Item', 100, 2, 18)], { discountPercent: 10 });
    expect(bd.discountAmount).toBe(20);
    expect(bd.taxableValue).toBe(180);
    const expectedTax = r2(180 * 0.18); // 32.40
    expect(bd.totalTax).toBe(expectedTax);
  });

  it('discount cannot exceed subtotal', () => {
    const bd = computeTax([item('X', 50, 1, 0)], { discountRupees: 999 });
    expect(bd.discountAmount).toBe(50);
    expect(bd.taxableValue).toBe(0);
    expect(bd.grandTotal).toBe(0);
  });
});

// ─── Multi-rate slabs ─────────────────────────────────────────────────────────

describe('computeTax — multiple GST rates', () => {
  it('groups items into separate slab rows', () => {
    const items = [
      item('Rice', 100, 1, 5),
      item('Oil',  200, 1, 18),
      item('Soap',  50, 2, 12),
    ];
    const bd = computeTax(items);
    const rates = bd.slabs.map(s => s.rate).sort((a, b) => a - b);
    expect(rates).toEqual([5, 12, 18]);

    for (const slab of bd.slabs) {
      // CGST + SGST must equal the slab tax
      expect(r2(slab.cgst + slab.sgst)).toBe(r2(slab.cgst * 2));
    }
  });

  it('total tax = sum of slab taxes', () => {
    const items = [item('A', 100, 1, 5), item('B', 200, 1, 18)];
    const bd = computeTax(items);
    const slabTaxTotal = r2(bd.slabs.reduce((s, sl) => s + sl.cgst + sl.sgst + sl.igst, 0));
    expect(slabTaxTotal).toBe(bd.totalTax);
  });
});

// ─── IGST (inter-state) ───────────────────────────────────────────────────────

describe('computeTax — IGST for inter-state', () => {
  const store = '29ABCDE1234F1Z5'; // Karnataka
  const customer = '07XYZAB1234G1Z9'; // Delhi

  it('uses IGST, not CGST/SGST', () => {
    const bd = computeTax(
      [item('Widget', 1000, 1, 18)],
      { storeGstin: store, customerGstin: customer },
    );
    expect(bd.isIgst).toBe(true);
    expect(bd.totalIGST).toBe(r2(1000 * 0.18));
    expect(bd.totalCGST).toBe(0);
    expect(bd.totalSGST).toBe(0);
  });

  it('intra-state → CGST/SGST', () => {
    const sameCust = '29XYZAB1234G1Z9';
    const bd = computeTax(
      [item('Widget', 1000, 1, 18)],
      { storeGstin: store, customerGstin: sameCust },
    );
    expect(bd.isIgst).toBe(false);
    expect(bd.totalCGST).toBeGreaterThan(0);
    expect(bd.totalSGST).toBeGreaterThan(0);
    expect(bd.totalIGST).toBe(0);
  });
});

// ─── CGST + SGST = total tax to the paisa ────────────────────────────────────

describe('computeTax — CGST + SGST precision', () => {
  it('never drifts from totalTax by more than 0.01', () => {
    // Exhaustive check across common values
    const prices = [1, 7, 13, 50, 99, 149, 333, 999, 1234];
    const rates  = [5, 12, 18, 28];
    for (const price of prices) {
      for (const rate of rates) {
        const bd = computeTax([item('P', price, 1, rate)]);
        const diff = Math.abs(r2(bd.totalCGST + bd.totalSGST) - bd.totalTax);
        expect(diff).toBeLessThanOrEqual(0.01);
      }
    }
  });
});

// ─── Round-off ────────────────────────────────────────────────────────────────

describe('computeTax — round-off', () => {
  it('grandTotal = grandTotalExact + roundOff', () => {
    const bd = computeTax([item('X', 97, 1, 5)]);
    expect(r2(bd.grandTotalExact + bd.roundOff)).toBe(bd.grandTotal);
  });

  it('roundOff is within ±0.50', () => {
    const bd = computeTax([item('X', 97, 1, 5)]);
    expect(Math.abs(bd.roundOff)).toBeLessThanOrEqual(0.5);
  });
});

// ─── amountInWords ───────────────────────────────────────────────────────────

describe('amountInWords', () => {
  it('zero', () => expect(amountInWords(0)).toBe('Zero Rupees Only'));
  it('single digit', () => expect(amountInWords(5)).toBe('Five Rupees Only'));
  it('round hundreds', () => expect(amountInWords(100)).toBe('One Hundred Rupees Only'));
  it('thousands', () => expect(amountInWords(1500)).toBe('One Thousand Five Hundred Rupees Only'));
  it('lakhs', () => expect(amountInWords(150000)).toBe('One Lakh Fifty Thousand Rupees Only'));
  it('crores', () => expect(amountInWords(10000000)).toBe('One Crore Rupees Only'));
  it('with paise', () => expect(amountInWords(101.50)).toBe('One Hundred One Rupees and Fifty Paise Only'));
  it('nineteen edge', () => expect(amountInWords(19)).toBe('Nineteen Rupees Only'));
  it('twenty', () => expect(amountInWords(20)).toBe('Twenty Rupees Only'));
  it('eleven hundred', () => expect(amountInWords(1100)).toBe('One Thousand One Hundred Rupees Only'));
});
