import { generatePDF } from 'react-native-html-to-pdf';
import { STORE_INFO } from '../../config/constants';
import { makeUpiPaymentLink } from '../whatsapp/billMessage';

export interface PdfStoreInfo {
  name: string;
  gstin: string;
  phone: string;
  email: string;
  address: string;
  upiId?: string;
}

const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]!));

export const generateGSTBillPDF = async (
  billData: any,
  storeName = STORE_INFO.name,
  storeInfo?: PdfStoreInfo,
): Promise<string | null> => {
  try {
    const store = storeInfo ?? STORE_INFO;
    const discount = Number(billData.discount ?? billData.discountAmount ?? 0);
    const items = (billData.items ?? []).map((item: any, index: number) => `
      <tr><td>${index + 1}</td><td>${escapeHtml(item.name)}<small>Includes ${Number(item.gst ?? 0)}% GST</small></td>
      <td>${escapeHtml(item.qty)} ${escapeHtml(item.unit)}</td><td>₹${Number(item.price ?? 0).toFixed(2)}</td>
      <td>₹${(Number(item.price ?? 0) * Number(item.qty ?? 0)).toFixed(2)}</td></tr>`).join('');
    const upiAmount = billData.paymentType === 'SPLIT'
      ? Number(billData.paymentSplit?.upi ?? 0)
      : billData.paymentType === 'UPI' ? Number(billData.grandTotal) : 0;
    const upiLink = makeUpiPaymentLink(store.upiId ?? STORE_INFO.upiId, upiAmount, billData.billNo, storeName);
    const date = new Date(billData.timestamp ?? Date.now()).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata',
    });
    const html = `<!doctype html><html><head><meta charset="utf-8"/><style>
      *{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#1f2937;padding:28px;font-size:12px}
      header{text-align:center;border-bottom:2px solid #216e4e;padding-bottom:14px}h1{font-size:21px;margin:0 0 6px;color:#216e4e}
      header p{margin:3px 0;color:#4b5563}.title{text-align:center;margin:18px 0;font-weight:bold;font-size:16px}
      .meta{display:grid;grid-template-columns:1fr 1fr;gap:7px 24px;margin-bottom:16px}.meta b{display:inline-block;min-width:94px}
      table{width:100%;border-collapse:collapse;margin:14px 0}th{background:#216e4e;color:white;text-align:left}
      th,td{padding:9px 7px;border:1px solid #d1d5db}td:first-child,td:nth-child(3){text-align:center}
      td:nth-child(n+4){text-align:right}small{display:block;color:#6b7280;margin-top:3px}
      .totals{width:280px;margin:16px 0 0 auto}.row{display:flex;justify-content:space-between;padding:5px 0}
      .grand{border-top:2px solid #216e4e;font-size:16px;font-weight:bold;color:#216e4e;margin-top:4px;padding-top:10px}
      .pay{margin-top:18px;padding:10px;background:#f0fdf4;border-radius:8px}.foot{text-align:center;margin-top:28px;color:#6b7280}
      a{color:#216e4e;word-break:break-all}
    </style></head><body>
      <header><h1>${escapeHtml(storeName)}</h1><p>${escapeHtml(store.address)}</p>
      <p>${escapeHtml(store.phone)} · ${escapeHtml(store.email)}</p><p><b>GSTIN:</b> ${escapeHtml(store.gstin)}</p></header>
      <div class="title">TAX INVOICE</div>
      <div class="meta"><div><b>Bill No:</b> ${escapeHtml(billData.billNo)}</div><div><b>Date:</b> ${escapeHtml(date)}</div>
      <div><b>Customer:</b> ${escapeHtml(billData.customerName || 'Walk-in')}</div><div><b>Biller:</b> ${escapeHtml(billData.cashierName || billData.cashierId || 'Staff')}</div>
      ${billData.customerGstNumber ? `<div><b>Customer GSTIN:</b> ${escapeHtml(billData.customerGstNumber)}</div>` : ''}</div>
      <table><thead><tr><th>#</th><th>Item</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead><tbody>${items}</tbody></table>
      <div class="totals"><div class="row"><span>Subtotal</span><b>₹${Number(billData.subtotal ?? 0).toFixed(2)}</b></div>
      <div class="row"><span>Total GST</span><b>₹${Number(billData.totalGST ?? 0).toFixed(2)}</b></div>
      ${discount > 0 ? `<div class="row"><span>Discount</span><b>-₹${discount.toFixed(2)}</b></div>` : ''}
      <div class="row grand"><span>GRAND TOTAL</span><span>₹${Number(billData.grandTotal ?? 0).toFixed(2)}</span></div></div>
      <div class="pay"><b>Payment Mode:</b> ${escapeHtml(billData.paymentType ?? 'CASH')}
      ${billData.paymentType === 'SPLIT' && billData.paymentSplit ? `<br/>Cash ₹${Number(billData.paymentSplit.cash).toFixed(2)} · UPI ₹${Number(billData.paymentSplit.upi).toFixed(2)} · Card ₹${Number(billData.paymentSplit.card).toFixed(2)} · Udhaar ₹${Number(billData.paymentSplit.udhaar).toFixed(2)}` : ''}
      ${upiLink ? `<br/><b>UPI payment link:</b> <a href="${escapeHtml(upiLink)}">${escapeHtml(upiLink)}</a>` : ''}</div>
      <div class="foot">Thank you for your visit!<br/>This is a computer-generated invoice and requires no signature.</div>
    </body></html>`;

    const file = await generatePDF({
      html,
      fileName: `Invoice_${String(billData.billNo ?? 'SMS').replace(/[^a-z0-9_-]/gi, '_')}`,
      base64: false,
    });
    return file.filePath || null;
  } catch (error) {
    console.error('Could not create invoice PDF', error);
    return null;
  }
};
