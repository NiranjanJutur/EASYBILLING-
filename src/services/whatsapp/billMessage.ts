import { STORE_INFO } from '../../config/constants';

export interface BillShareData {
  billNo: string;
  timestamp?: string;
  customerName: string;
  customerGstNumber?: string | null;
  items: { name: string; qty: number; unit: string; price: number; total: number; gst: number }[];
  subtotal: number;
  totalGST: number;
  grandTotal: number;
  discount?: number;
  paymentType: string;
  paymentSplit?: { cash: number; upi: number; card: number; udhaar: number };
  billerName?: string;
  upiId?: string;
  upiAmount?: number;
}

export const makeUpiPaymentLink = (upiId: string, amount: number, billNo: string, storeName = STORE_INFO.name) => {
  if (!upiId.trim() || !(amount > 0)) return '';
  const params = new URLSearchParams({
    pa: upiId.trim(), pn: storeName, am: amount.toFixed(2), cu: 'INR', tn: `Invoice ${billNo}`,
  });
  return `upi://pay?${params.toString()}`;
};

/** Format the full bill as a WhatsApp-ready invoice with seller and buyer GSTIN. */
export const buildBillMessage = (data: BillShareData): string => {
  const store = STORE_INFO;
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

  data.items.forEach((item, index) => {
    const lineSubtotal = item.price * item.qty;
    lines.push(`*${index + 1}. ${item.name}*`);
    lines.push(`   ↳ ${item.qty} ${item.unit} x ₹${item.price.toFixed(2)}  =  *₹${lineSubtotal.toFixed(2)}*`);
    if (item.gst > 0) lines.push(`   _(Includes ${item.gst}% GST)_`);
    lines.push('');
  });

  lines.push('-------------------------------------------------');
  lines.push(`*Subtotal:*               ₹${data.subtotal.toFixed(2)}`);
  lines.push(`*Total GST:*              ₹${data.totalGST.toFixed(2)}`);
  if (data.discount && data.discount > 0) lines.push(`*Discount:*              -₹${data.discount.toFixed(2)}`);
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push(`💰 *GRAND TOTAL:    ₹${data.grandTotal.toFixed(2)}*`);
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━');
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
