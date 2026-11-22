/**
 * pdfService.ts — Native (Android) PDF generation via react-native-html-to-pdf.
 *
 * Uses the shared buildInvoiceHTML template so the invoice layout is
 * identical to the web version. Correctly renders ₹ and Unicode item names
 * because react-native-html-to-pdf uses the system WebView to render HTML.
 */

import { generatePDF } from 'react-native-html-to-pdf';
import { buildInvoiceHTML, InvoiceData } from '../billing/invoiceTemplate';
import type { InvoiceStoreInfo } from '../billing/invoiceTemplate';

export type { InvoiceStoreInfo };
export type PdfStoreInfo = InvoiceStoreInfo;

/**
 * Generate a GST invoice PDF on Android.
 * @returns File path string (file://…), or null on error.
 */
export const generateGSTBillPDF = async (
  billData: InvoiceData,
  _storeName?: string,       // kept for backwards-compat
  _storeInfo?: InvoiceStoreInfo, // kept for backwards-compat
): Promise<string | null> => {
  try {
    const html = buildInvoiceHTML(billData);
    const safeBillNo = String(billData.billNo ?? 'Invoice').replace(/[^a-z0-9_-]/gi, '_');

    const file = await generatePDF({
      html,
      fileName: `Invoice_${safeBillNo}`,
      directory: 'Documents',
      base64: false,
    });

    return file.filePath ?? null;
  } catch (err) {
    console.error('[pdfService] Failed to generate PDF', err);
    return null;
  }
};
