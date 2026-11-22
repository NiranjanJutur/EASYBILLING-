/**
 * invoiceTemplate.ts — Single HTML invoice template used by:
 *   - Native PDF (react-native-html-to-pdf)
 *   - Web PDF (blob printed via hidden iframe)
 *   - Browser print dialog
 *   - Preview in receipt modal
 *
 * Using HTML avoids jsPDF's ₹ glyph problem and supports Unicode
 * (Kannada, Hindi item names, etc.) out of the box via UTF-8.
 */

import { TaxBreakdown } from './taxCalc';
import { STORE_INFO } from '../../config/constants';

export interface InvoiceStoreInfo {
  name: string;
  gstin: string;
  phone: string;
  email: string;
  address: string;
  upiId?: string;
  /** Set true if the store is on the GST Composition Scheme */
  isCompositionScheme?: boolean;
  /** State name for "Place of Supply" field */
  state?: string;
}

export interface InvoiceData {
  billNo: string;
  timestamp?: string | number;
  customerName: string;
  customerGstin?: string | null;
  customerPhone?: string;
  billerName?: string;
  orderType?: string;
  paymentType: string;
  paymentSplit?: { cash: number; upi: number; card: number; udhaar: number };
  /** Pre-computed breakdown from taxCalc.computeTax */
  tax: TaxBreakdown;
  storeInfo?: InvoiceStoreInfo;
  storeName?: string;
  /** Consecutive invoice sequence number (optional) */
  invoiceSeqNo?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const esc = (v: unknown): string =>
  String(v ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]!));

const fmt = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function paymentLabel(type: string, split?: InvoiceData['paymentSplit']): string {
  if (type !== 'SPLIT' || !split) return type;
  const parts: string[] = [];
  if (split.cash  > 0) parts.push(`Cash ₹${fmt(split.cash)}`);
  if (split.upi   > 0) parts.push(`UPI ₹${fmt(split.upi)}`);
  if (split.card  > 0) parts.push(`Card ₹${fmt(split.card)}`);
  if (split.udhaar > 0) parts.push(`Udhaar ₹${fmt(split.udhaar)}`);
  return 'Split: ' + parts.join(' · ');
}

// ─── Main Template ────────────────────────────────────────────────────────────

export function buildInvoiceHTML(data: InvoiceData): string {
  const store: InvoiceStoreInfo = data.storeInfo ?? { ...STORE_INFO };
  const storeName = data.storeName ?? store.name;
  const tax = data.tax;

  const isComposition = store.isCompositionScheme ?? false;
  const invoiceTitle = isComposition ? 'BILL OF SUPPLY' : 'TAX INVOICE';

  const dateObj = new Date(data.timestamp ?? Date.now());
  const dateStr = dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
  const timeStr = dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });

  // Items table rows
  const itemRows = tax.lines.map((line, i) => `
    <tr>
      <td class="center">${i + 1}</td>
      <td>${esc(line.name)}${line.hsn ? `<br/><small>HSN: ${esc(line.hsn)}</small>` : ''}</td>
      <td class="center">${esc(line.qty)} ${esc(line.unit)}</td>
      <td class="right">₹${fmt(line.price)}</td>
      <td class="right">₹${fmt(line.taxableAmount)}</td>
      <td class="center">${line.gst > 0 ? `${line.gst}%` : '—'}</td>
      <td class="right">₹${fmt(line.gstAmount)}</td>
      <td class="right bold">₹${fmt(line.total)}</td>
    </tr>`).join('');

  // Tax slab rows
  const slabRows = tax.slabs.filter(s => s.rate > 0).map(s => `
    <tr>
      <td>${s.rate}%</td>
      <td class="right">₹${fmt(s.taxableValue)}</td>
      ${tax.isIgst
        ? `<td class="right" colspan="2">₹${fmt(s.igst)}</td>`
        : `<td class="right">₹${fmt(s.cgst)}</td><td class="right">₹${fmt(s.sgst)}</td>`}
    </tr>`).join('');

  const slabHeader = tax.isIgst
    ? '<th>Rate</th><th class="right">Taxable</th><th class="right" colspan="2">IGST</th>'
    : '<th>Rate</th><th class="right">Taxable</th><th class="right">CGST</th><th class="right">SGST</th>';

  const placeOfSupply = store.state ?? 'Karnataka';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Invoice ${esc(data.billNo)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;color:#1f2937;font-size:12px;padding:24px;max-width:900px;margin:auto}
  /* Header */
  .invoice-header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1E6B3C;padding-bottom:16px;margin-bottom:16px}
  .store-name{font-size:22px;font-weight:800;color:#1E6B3C;margin-bottom:4px}
  .store-meta{color:#4b5563;line-height:1.6}
  .invoice-title-box{text-align:right}
  .invoice-title{font-size:18px;font-weight:700;color:#1E6B3C;text-transform:uppercase;letter-spacing:1px}
  .invoice-title-box .bill-no{font-size:13px;color:#374151;margin-top:4px}
  /* Meta grid */
  .meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 24px;margin-bottom:16px;padding:12px;background:#f9fafb;border-radius:6px;border:1px solid #e5e7eb}
  .meta-row{display:flex;gap:6px}
  .meta-label{font-weight:600;color:#6b7280;min-width:110px}
  .meta-value{color:#111827}
  /* Tables */
  table{width:100%;border-collapse:collapse;margin:12px 0;font-size:11.5px}
  th{background:#1E6B3C;color:#fff;padding:8px 6px;text-align:left;font-weight:600}
  td{padding:7px 6px;border-bottom:1px solid #f0f0f0}
  tr:nth-child(even) td{background:#f9fafb}
  .center{text-align:center}
  .right{text-align:right}
  .bold{font-weight:700}
  /* Totals */
  .totals-section{display:flex;justify-content:space-between;gap:24px;margin-top:16px}
  .slab-table{flex:1}
  .totals-box{width:280px;flex-shrink:0}
  .total-row{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #f0f0f0}
  .total-row.grand{border-top:2px solid #1E6B3C;border-bottom:none;font-size:15px;font-weight:800;color:#1E6B3C;margin-top:6px;padding-top:8px}
  .total-row.dim{color:#6b7280;font-size:11px}
  /* Amount in words */
  .amount-words{margin-top:12px;padding:10px;background:#f0fdf4;border-left:4px solid #1E6B3C;border-radius:4px;font-style:italic;font-size:11.5px}
  /* Payment */
  .payment-box{margin-top:14px;padding:10px 14px;background:#eff6ff;border-radius:6px;border:1px solid #bfdbfe;font-size:11.5px}
  /* Footer */
  .footer{text-align:center;margin-top:24px;padding-top:14px;border-top:1px solid #e5e7eb;color:#9ca3af;font-size:11px;line-height:1.7}
  .signature-line{display:flex;justify-content:space-between;margin-top:32px;padding-top:8px;font-size:11px;color:#6b7280}
  .signature-line div{text-align:center;width:160px;border-top:1px solid #9ca3af;padding-top:4px}
  /* Print styles */
  @media print{
    body{padding:12px}
    @page{margin:12mm;size:A4}
    .no-print{display:none}
  }
</style>
</head>
<body>

<!-- Header -->
<div class="invoice-header">
  <div>
    <div class="store-name">${esc(storeName)}</div>
    <div class="store-meta">
      ${esc(store.address)}<br/>
      Ph: ${esc(store.phone)}${store.email ? ` &nbsp;|&nbsp; ${esc(store.email)}` : ''}<br/>
      <strong>GSTIN:</strong> ${esc(store.gstin)}
    </div>
  </div>
  <div class="invoice-title-box">
    <div class="invoice-title">${invoiceTitle}</div>
    <div class="bill-no"><strong>Bill No:</strong> ${esc(data.billNo)}</div>
    <div class="bill-no"><strong>Date:</strong> ${esc(dateStr)} &nbsp; <strong>Time:</strong> ${esc(timeStr)}</div>
    ${data.invoiceSeqNo ? `<div class="bill-no"><strong>Seq No:</strong> ${data.invoiceSeqNo}</div>` : ''}
  </div>
</div>

<!-- Bill Meta -->
<div class="meta-grid">
  <div class="meta-row"><span class="meta-label">Customer</span><span class="meta-value">${esc(data.customerName || 'Walk-in')}</span></div>
  <div class="meta-row"><span class="meta-label">Biller</span><span class="meta-value">${esc(data.billerName || 'Staff')}</span></div>
  ${data.customerGstin ? `<div class="meta-row"><span class="meta-label">Customer GSTIN</span><span class="meta-value">${esc(data.customerGstin)}</span></div>` : ''}
  ${data.customerPhone ? `<div class="meta-row"><span class="meta-label">Customer Phone</span><span class="meta-value">${esc(data.customerPhone)}</span></div>` : ''}
  <div class="meta-row"><span class="meta-label">Order Type</span><span class="meta-value">${esc(data.orderType ?? 'In-store')}</span></div>
  <div class="meta-row"><span class="meta-label">Place of Supply</span><span class="meta-value">${esc(placeOfSupply)}</span></div>
</div>

<!-- Items Table -->
<table>
  <thead>
    <tr>
      <th class="center" style="width:28px">#</th>
      <th>Item Description</th>
      <th class="center">Qty</th>
      <th class="right">Unit Rate</th>
      <th class="right">Taxable Value</th>
      <th class="center">GST%</th>
      <th class="right">GST Amt</th>
      <th class="right">Amount</th>
    </tr>
  </thead>
  <tbody>
    ${itemRows}
  </tbody>
</table>

<!-- Totals + Tax Slab -->
<div class="totals-section">

  <!-- Tax Slab Summary (only for Tax Invoice) -->
  ${!isComposition && tax.slabs.some(s => s.rate > 0) ? `
  <div class="slab-table">
    <table style="margin:0">
      <thead><tr>${slabHeader}</tr></thead>
      <tbody>${slabRows}</tbody>
      <tfoot>
        <tr>
          <td class="bold">Total</td>
          <td class="right bold">₹${fmt(tax.taxableValue)}</td>
          ${tax.isIgst
            ? `<td class="right bold" colspan="2">₹${fmt(tax.totalIGST)}</td>`
            : `<td class="right bold">₹${fmt(tax.totalCGST)}</td><td class="right bold">₹${fmt(tax.totalSGST)}</td>`}
        </tr>
      </tfoot>
    </table>
  </div>` : '<div></div>'}

  <!-- Grand Total Box -->
  <div class="totals-box">
    ${tax.discountAmount > 0 ? `
    <div class="total-row dim"><span>Subtotal (before discount)</span><span>₹${fmt(tax.subtotalBeforeDiscount)}</span></div>
    <div class="total-row dim"><span>Discount</span><span style="color:#dc2626">−₹${fmt(tax.discountAmount)}</span></div>
    ` : ''}
    <div class="total-row"><span>Taxable Value</span><span>₹${fmt(tax.taxableValue)}</span></div>
    ${tax.isIgst
      ? `<div class="total-row"><span>IGST</span><span>₹${fmt(tax.totalIGST)}</span></div>`
      : `${tax.totalCGST > 0 ? `<div class="total-row"><span>CGST</span><span>₹${fmt(tax.totalCGST)}</span></div>` : ''}
         ${tax.totalSGST > 0 ? `<div class="total-row"><span>SGST</span><span>₹${fmt(tax.totalSGST)}</span></div>` : ''}`}
    ${tax.roundOff !== 0 ? `<div class="total-row dim"><span>Round-off</span><span>${tax.roundOff > 0 ? '+' : ''}₹${fmt(tax.roundOff)}</span></div>` : ''}
    <div class="total-row grand"><span>Grand Total</span><span>₹${fmt(tax.grandTotal)}</span></div>
  </div>
</div>

<!-- Amount in Words -->
<div class="amount-words">
  <strong>Amount in Words:</strong> ${esc(tax.amountInWords)}
</div>

<!-- Payment -->
<div class="payment-box">
  <strong>Payment Mode:</strong> ${esc(paymentLabel(data.paymentType, data.paymentSplit))}
</div>

<!-- Signature Line -->
<div class="signature-line">
  <div>Customer Signature</div>
  <div>Authorised Signatory<br/><em>${esc(storeName)}</em></div>
</div>

<!-- Footer -->
<div class="footer">
  Thank you for shopping at <strong>${esc(storeName)}</strong>!<br/>
  This is a computer-generated invoice and does not require a physical signature.<br/>
  ${isComposition ? 'Composition taxable person — not eligible to collect tax on supplies.' : ''}
</div>

</body>
</html>`;
}
