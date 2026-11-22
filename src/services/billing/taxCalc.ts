/**
 * taxCalc.ts — Single source of truth for GST arithmetic.
 *
 * Rules implemented:
 *  1. Discount is applied BEFORE tax (GST is on taxable value).
 *  2. Items are grouped by GST rate → one CGST+SGST (or IGST) row per slab.
 *  3. IGST is used when the first two digits of customer GSTIN ≠ store GSTIN.
 *  4. Round-off is the difference between the mathematical total and the
 *     nearest rupee (or paisa, configurable).
 *  5. Amount-in-words follows Indian numbering (lakhs, crores).
 *
 * This module has zero React / RN imports — it is safe to test with plain Jest.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TaxLineItem {
  productId: string;
  name: string;
  qty: number;
  unit: string;
  /** Rate per unit BEFORE any line-level discount */
  price: number;
  /** GST rate % — must be one of 0 | 5 | 12 | 18 | 28 */
  gst: number;
  /** HSN/SAC code — optional, printed on invoice */
  hsn?: string;
}

export interface TaxSlabRow {
  rate: number;        // e.g. 18
  taxableValue: number;
  cgst: number;        // 0 when isIgst === true
  sgst: number;        // 0 when isIgst === true
  igst: number;        // 0 when isIgst === false
}

export interface ComputedLineItem {
  productId: string;
  name: string;
  qty: number;
  unit: string;
  price: number;
  gst: number;
  hsn: string;
  taxableAmount: number; // price * qty * proportionalDiscountFactor
  gstAmount: number;     // taxableAmount * gst / 100
  total: number;         // taxableAmount + gstAmount
}

export interface TaxBreakdown {
  /** Per-line detail with discount already applied */
  lines: ComputedLineItem[];
  /** Per-GST-rate summary rows */
  slabs: TaxSlabRow[];
  subtotalBeforeDiscount: number;
  discountAmount: number;
  taxableValue: number;    // subtotal after discount
  totalCGST: number;
  totalSGST: number;
  totalIGST: number;
  totalTax: number;
  grandTotalExact: number; // before round-off
  roundOff: number;        // ± difference to nearest rupee
  grandTotal: number;      // rounded
  isIgst: boolean;
  amountInWords: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const r2 = (n: number) => Math.round(n * 100) / 100;
const r0 = (n: number) => Math.round(n);

/** Extract the 2-digit state code from a 15-char GSTIN */
export const gstinStateCode = (gstin: string | null | undefined): string =>
  (gstin ?? '').replace(/\s/g, '').slice(0, 2).toUpperCase();

/**
 * Returns true when customer and store GSTINs belong to different states,
 * which requires IGST instead of CGST+SGST.
 */
export const isInterState = (
  storeGstin: string | null | undefined,
  customerGstin: string | null | undefined,
): boolean => {
  const sc = gstinStateCode(storeGstin);
  const cc = gstinStateCode(customerGstin);
  if (!sc || !cc) return false; // cannot determine → default intra-state
  return sc !== cc;
};

// ─── Amount in Words (Indian numbering) ──────────────────────────────────────

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function belowHundred(n: number): string {
  if (n < 20) return ONES[n];
  return (TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '')).trim();
}

function belowThousand(n: number): string {
  if (n < 100) return belowHundred(n);
  return `${ONES[Math.floor(n / 100)]} Hundred${n % 100 ? ' ' + belowHundred(n % 100) : ''}`;
}

export function amountInWords(amount: number): string {
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);

  if (rupees === 0 && paise === 0) return 'Zero Rupees Only';

  const parts: string[] = [];
  let n = rupees;

  const crore = Math.floor(n / 10_000_000); n %= 10_000_000;
  const lakh  = Math.floor(n / 100_000);    n %= 100_000;
  const thou  = Math.floor(n / 1_000);      n %= 1_000;
  const rest  = n;

  if (crore) parts.push(`${belowThousand(crore)} Crore`);
  if (lakh)  parts.push(`${belowHundred(lakh)} Lakh`);
  if (thou)  parts.push(`${belowThousand(thou)} Thousand`);
  if (rest)  parts.push(belowThousand(rest));

  let result = parts.join(' ') + ' Rupees';
  if (paise) result += ` and ${belowHundred(paise)} Paise`;
  return result + ' Only';
}

// ─── Core Calculation ─────────────────────────────────────────────────────────

export interface TaxCalcOptions {
  /** Flat rupee discount applied proportionally across all items */
  discountRupees?: number;
  /** Percentage discount (0–100) — ignored if discountRupees is provided */
  discountPercent?: number;
  /** Store GSTIN — used to determine IGST vs CGST/SGST */
  storeGstin?: string;
  /** Customer GSTIN — used to determine IGST vs CGST/SGST */
  customerGstin?: string;
}

export function computeTax(
  items: TaxLineItem[],
  opts: TaxCalcOptions = {},
): TaxBreakdown {
  if (!items.length) {
    return {
      lines: [], slabs: [],
      subtotalBeforeDiscount: 0, discountAmount: 0, taxableValue: 0,
      totalCGST: 0, totalSGST: 0, totalIGST: 0, totalTax: 0,
      grandTotalExact: 0, roundOff: 0, grandTotal: 0,
      isIgst: false, amountInWords: 'Zero Rupees Only',
    };
  }

  // 1. Subtotal before discount
  const subtotalBeforeDiscount = r2(items.reduce((s, i) => s + i.price * i.qty, 0));

  // 2. Discount amount
  let discountAmount = 0;
  if (opts.discountRupees && opts.discountRupees > 0) {
    discountAmount = r2(Math.min(subtotalBeforeDiscount, opts.discountRupees));
  } else if (opts.discountPercent && opts.discountPercent > 0) {
    discountAmount = r2(subtotalBeforeDiscount * Math.min(opts.discountPercent, 100) / 100);
  }

  // 3. Proportional discount factor (applied per line)
  const discountFactor = subtotalBeforeDiscount > 0
    ? (subtotalBeforeDiscount - discountAmount) / subtotalBeforeDiscount
    : 1;

  // 4. IGST determination
  const igstMode = isInterState(opts.storeGstin, opts.customerGstin);

  // 5. Compute per-line values (discount applied before tax)
  const lines: ComputedLineItem[] = items.map(item => {
    const taxableAmount = r2(item.price * item.qty * discountFactor);
    const gstAmount     = r2(taxableAmount * item.gst / 100);
    const total         = r2(taxableAmount + gstAmount);
    return {
      productId: item.productId,
      name: item.name,
      qty: item.qty,
      unit: item.unit,
      price: item.price,
      gst: item.gst,
      hsn: item.hsn ?? '',
      taxableAmount,
      gstAmount,
      total,
    };
  });

  // 6. Group lines by GST rate → slab rows
  const slabMap = new Map<number, { taxable: number; tax: number }>();
  for (const line of lines) {
    const existing = slabMap.get(line.gst) ?? { taxable: 0, tax: 0 };
    slabMap.set(line.gst, {
      taxable: r2(existing.taxable + line.taxableAmount),
      tax:     r2(existing.tax     + line.gstAmount),
    });
  }

  const slabs: TaxSlabRow[] = [...slabMap.entries()]
    .sort(([a], [b]) => a - b)
    .map(([rate, { taxable, tax }]) => {
      const cgst = igstMode ? 0 : r2(tax / 2);
      const sgst = igstMode ? 0 : r2(tax - cgst);
      return {
        rate,
        taxableValue: taxable,
        cgst,
        sgst,
        igst: igstMode ? tax : 0,
      };
    });

  // 7. Totals
  const taxableValue = r2(lines.reduce((s, l) => s + l.taxableAmount, 0));
  const totalTax     = r2(lines.reduce((s, l) => s + l.gstAmount,     0));
  const totalCGST    = igstMode ? 0 : r2(totalTax / 2);
  const totalSGST    = igstMode ? 0 : r2(totalTax - totalCGST);
  const totalIGST    = igstMode ? totalTax : 0;

  const grandTotalExact = r2(taxableValue + totalTax);
  const roundOff        = r2(r0(grandTotalExact) - grandTotalExact);
  const grandTotal      = r2(grandTotalExact + roundOff);

  return {
    lines,
    slabs,
    subtotalBeforeDiscount,
    discountAmount,
    taxableValue,
    totalCGST,
    totalSGST,
    totalIGST,
    totalTax,
    grandTotalExact,
    roundOff,
    grandTotal,
    isIgst: igstMode,
    amountInWords: amountInWords(grandTotal),
  };
}
