/**
 * billShareService.ts — Unified multi-format bill sharing.
 *
 * Provides 5 share paths:
 *   shareAsText       → WhatsApp / clipboard text
 *   downloadPDF       → opens blob URL in new tab (web)
 *   printBill         → hidden iframe print (not window.open — avoids popup blockers)
 *   shareViaWhatsApp  → wa.me deep link with bill text
 *   shareViaNativeShare → Web Share API + clipboard fallback
 *
 * Platform.OS check keeps Android path separate (uses react-native-share).
 * UPI ID always read from storeInfo — never hardcoded.
 */

import { Platform } from 'react-native';
import { buildInvoiceHTML, InvoiceData, InvoiceStoreInfo } from './invoiceTemplate';
import { buildBillMessage } from '../whatsapp/billMessage';
import type { BillShareData } from '../whatsapp/billMessage';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ShareOptions {
  invoiceData: InvoiceData;
  /** Pre-built text message (from buildBillMessage) — built lazily if omitted */
  textMessage?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function htmlToBlob(html: string): Blob {
  return new Blob([html], { type: 'text/html;charset=utf-8' });
}

/** Opens a hidden <iframe>, writes HTML, triggers window.print() inside it.
 *  This avoids popup-blocker issues with window.open() and works on HTTPS. */
function printViaIframe(html: string): void {
  // Remove old iframe if present
  const old = document.getElementById('__invoice_print_frame__');
  old?.remove();

  const iframe = document.createElement('iframe');
  iframe.id = '__invoice_print_frame__';
  iframe.style.cssText = 'position:fixed;width:0;height:0;border:none;visibility:hidden';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) return;
  doc.open();
  doc.write(html);
  doc.close();

  // Wait for resources to load, then print
  iframe.onload = () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    // Keep iframe alive until print dialog closes — browser handles cleanup
  };
}

/** Build a wa.me URL for a phone number and message */
function waUrl(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, '');
  const formatted = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${formatted}?text=${encodeURIComponent(message)}`;
}

// ─── Share actions ────────────────────────────────────────────────────────────

/** 1. Text share — WhatsApp text bill */
export function buildTextMessage(opts: ShareOptions): string {
  if (opts.textMessage) return opts.textMessage;
  const inv = opts.invoiceData;
  const tax = inv.tax;

  const data: BillShareData = {
    billNo: inv.billNo,
    timestamp: String(inv.timestamp ?? Date.now()),
    customerName: inv.customerName,
    customerGstNumber: inv.customerGstin,
    items: tax.lines.map(l => ({
      name: l.name,
      qty: l.qty,
      unit: l.unit,
      price: l.price,
      total: l.total,
      gst: l.gst,
    })),
    subtotal: tax.taxableValue,
    totalGST: tax.totalTax,
    grandTotal: tax.grandTotal,
    discount: tax.discountAmount > 0 ? tax.discountAmount : undefined,
    paymentType: inv.paymentType,
    paymentSplit: inv.paymentSplit,
    billerName: inv.billerName,
    upiId: inv.storeInfo?.upiId,
  };
  return buildBillMessage(data);
}

/** 2. PDF download — web only: opens in new tab */
export async function downloadPDF(opts: ShareOptions): Promise<void> {
  const html = buildInvoiceHTML(opts.invoiceData);

  // Create a blob and open in a new tab — the user can "Save as PDF" via browser print
  const blob = htmlToBlob(html);
  const url  = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener';
  link.click();
  // Revoke after a delay
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** 3. Print — via hidden iframe (not window.open, avoids popup blockers) */
export function printBill(opts: ShareOptions): void {
  const html = buildInvoiceHTML(opts.invoiceData);
  printViaIframe(html);
}

/** 4. WhatsApp — opens wa.me deep link */
export function shareViaWhatsApp(opts: ShareOptions, customerPhone?: string): void {
  const message = buildTextMessage(opts);
  const phone = customerPhone ?? '';

  if (Platform.OS === 'web') {
    window.open(waUrl(phone, message), '_blank', 'noopener');
  } else {
    // On Android, use Linking
    const { Linking } = require('react-native');
    Linking.openURL(waUrl(phone, message));
  }
}

/** 5. Web Share API → clipboard fallback */
export async function shareViaNativeShare(opts: ShareOptions): Promise<'shared' | 'copied' | 'unavailable'> {
  const message = buildTextMessage(opts);
  const title   = `Invoice ${opts.invoiceData.billNo}`;

  if (Platform.OS !== 'web') {
    // Android: use react-native Share
    const { Share } = require('react-native');
    await Share.share({ title, message });
    return 'shared';
  }

  // Web: try navigator.share first (HTTPS only, Chrome/Safari)
  if (navigator.share) {
    try {
      await navigator.share({ title, text: message });
      return 'shared';
    } catch (err: any) {
      // AbortError = user dismissed — not a real failure
      if (err?.name === 'AbortError') return 'unavailable';
    }
  }

  // Fallback: clipboard
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(message);
    return 'copied';
  }

  return 'unavailable';
}

/** Android: share generated PDF file via react-native-share */
export async function shareNativePDF(pdfPath: string, billNo: string, customerName?: string): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const Share = require('react-native-share').default;
    const fileUrl = pdfPath.startsWith('file://') ? pdfPath : `file://${pdfPath}`;
    await Share.open({
      url:               fileUrl,
      type:              'application/pdf',
      filename:          `Invoice_${billNo.replace(/[^a-z0-9_-]/gi, '_')}.pdf`,
      title:             `Invoice ${billNo}`,
      message:           `Invoice ${billNo}${customerName ? ` for ${customerName}` : ''}`,
      useInternalStorage: true,
      failOnCancel:      false,
    });
  } catch (err: any) {
    if (err?.message !== 'User did not share') console.warn('shareNativePDF:', err);
  }
}
