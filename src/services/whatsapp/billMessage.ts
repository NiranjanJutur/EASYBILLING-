import { STORE_INFO } from '../../config/constants';
import { computeTax, TaxLineItem, amountInWords } from '../billing/taxCalc';

export interface BillShareData {
  billNo: string;
  timestamp?: string;
  customerName: string;
  customerGstNumber?: string | null;
  items: { name: string; qty: number; unit: string; price: number; total: number; gst: number; hsn?: string }[];
  subtotal: number;
  totalGST: number;
  grandTotal: number;
  discount?: number;
  paymentType: string;
  paymentSplit?: { cash: number; upi: number; card: number; udhaar: number };
  billerName?: string;
  upiId?: string;
  upiAmount?: number;
  /** Store GSTIN — used for IGST determination */
  storeGstin?: string;
}

export const makeUpiPaymentLink = (upiId: string, amount: number, billNo: string, storeName = STORE_INFO.name) => {
  if (!upiId.trim() || !(amount > 0)) return '';
  const params = new URLSearchParams({
    pa: upiId.trim(), pn: storeName, am: amount.toFixed(2), cu: 'INR', tn: `Invoice ${billNo}`,
  });
  return `upi://pay?${params.toString()}`;
};

/** Format the full bill as a WhatsApp-ready invoice with correct CGST/SGST/IGST split. */
export const buildBillMessage = (data: BillShareData): string => {
  const store = STORE_INFO;

  // Re-compute tax using the shared function so numbers always match
  const taxLines: TaxLineItem[] = data.items.map(it => ({
    productId: it.name,
    name: it.name,
    qty: it.qty,
    unit: it.unit,
    price: it.price,
    gst: it.gst,
    hsn: it.hsn,
  }));
  const tax = computeTax(taxLines, {
    discountRupees: data.discount,
    storeGstin: data.storeGstin ?? store.gstin,
    customerGstin: data.customerGstNumber ?? undefined,
  });

  const date = new Date(data.timestamp ?? Date.now()).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata',
  });
  const lines: string[] = [
    '┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓',
    `   🏬 *${store.name.toUpperCase()}*`,
    '┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛',
    `📍 ${store.address}`,
    `📞 ${store.phone}`,
    `✉️ ${store.email}`,
    `*GSTIN:* ${store.gstin}`,
    '',
    '🧾 *TAX INVOICE*',
    '-------------------------------------------------',
    `*Bill No:* ${data.billNo}`,
    `*Date:* ${date}`,
    `*Customer:* ${data.customerName || 'Walk-in'}`,
  ];
  if (data.customerGstNumber) lines.push(`*Customer GSTIN:* ${data.customerGstNumber}`);
  if (data.billerName) lines.push(`*Biller:* ${data.billerName}`);
  lines.push('-------------------------------------------------', '', '📦 *ITEMIZED DETAILS*', '');

  tax.lines.forEach((line, index) => {
    lines.push(`*${index + 1}. ${line.name}*`);
    lines.push(`   ↳ ${line.qty} ${line.unit} x ₹${line.price.toFixed(2)}  =  *₹${line.taxableAmount.toFixed(2)}*`);
    if (line.gst > 0) lines.push(`   _(GST ${line.gst}%: ₹${line.gstAmount.toFixed(2)})_`);
    lines.push('');
  });

  lines.push('-------------------------------------------------');

  // Show discount before tax (correct GST order)
  if (tax.discountAmount > 0) {
    lines.push(`*Subtotal:*               ₹${tax.subtotalBeforeDiscount.toFixed(2)}`);
    lines.push(`*Discount:*              -₹${tax.discountAmount.toFixed(2)}`);
  }
  lines.push(`*Taxable Value:*          ₹${tax.taxableValue.toFixed(2)}`);

  // CGST/SGST or IGST — grouped by rate
  if (tax.slabs.some(s => s.rate > 0)) {
    for (const slab of tax.slabs.filter(s => s.rate > 0)) {
      if (tax.isIgst) {
        lines.push(`*IGST ${slab.rate}%:*            ₹${slab.igst.toFixed(2)}`);
      } else {
        lines.push(`*CGST ${slab.rate / 2}%:*            ₹${slab.cgst.toFixed(2)}`);
        lines.push(`*SGST ${slab.rate / 2}%:*            ₹${slab.sgst.toFixed(2)}`);
      }
    }
  }

  if (tax.roundOff !== 0) {
    lines.push(`*Round-off:*             ${tax.roundOff > 0 ? '+' : ''}₹${tax.roundOff.toFixed(2)}`);
  }

  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push(`💰 *GRAND TOTAL:    ₹${tax.grandTotal.toFixed(2)}*`);
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push(`_${tax.amountInWords}_`);
  lines.push('');
  lines.push(`*Payment Mode:* ${data.paymentType}`);

  if (data.paymentType === 'SPLIT' && data.paymentSplit) {
    const split = data.paymentSplit;
    lines.push(`Cash ₹${split.cash.toFixed(2)} · UPI ₹${split.upi.toFixed(2)} · Card ₹${split.card.toFixed(2)} · Udhaar ₹${split.udhaar.toFixed(2)}`);
  }

  const payAmount = data.upiAmount ?? (data.paymentType === 'SPLIT' ? data.paymentSplit?.upi ?? 0 : data.paymentType === 'UPI' ? data.grandTotal : 0);
  const upiLink = makeUpiPaymentLink(data.upiId ?? store.upiId, payAmount, data.billNo, store.name);
  if (upiLink) lines.push('', '📲 *Pay via UPI:*', upiLink);

  lines.push('', '🙏 *Thank you for your visit!*', '_This is a computer-generated invoice and requires no signature._');
  return lines.join('\n');
};
