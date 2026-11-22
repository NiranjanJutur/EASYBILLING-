/**
 * pdfService.web.ts — Web PDF generation via HTML blob.
 *
 * Replaces jsPDF approach which had:
 *  - Missing ₹ glyph (jsPDF default fonts don't include it)
 *  - No CGST/SGST split
 *  - No Unicode support for Kannada/Hindi item names
 *
 * Now uses buildInvoiceHTML → Blob URL. The user opens it in a tab and
 * uses browser "Save as PDF" (Ctrl+P → Save as PDF) for a full A4 PDF.
 * This approach gives perfect ₹ rendering and supports any Unicode characters.
 */

import { buildInvoiceHTML, InvoiceData } from '../billing/invoiceTemplate';
import { InvoiceStoreInfo } from '../billing/invoiceTemplate';

export type { InvoiceStoreInfo };
// Re-export so callers that import from pdfService.web don't break
export type PdfStoreInfo = InvoiceStoreInfo;

/**
 * Generates an HTML invoice and returns a blob: URL that can be opened in a
 * new browser tab. The user saves as PDF via the browser's print dialog.
 *
 * @returns blob URL string, or null on error
 */
export const generateGSTBillPDF = async (
  billData: InvoiceData,
  _storeName?: string,       // kept for backwards-compat; use billData.storeName
  _storeInfo?: InvoiceStoreInfo, // kept for backwards-compat; use billData.storeInfo
): Promise<string | null> => {
  try {
    const html = buildInvoiceHTML(billData);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    return URL.createObjectURL(blob);
  } catch (err) {
    console.error('[pdfService.web] Failed to generate invoice HTML', err);
    return null;
  }
};

/**
 * Open the invoice in a new browser tab. The browser's native print dialog
 * lets the user save it as a PDF.
 */
export const openInvoiceInTab = async (billData: InvoiceData): Promise<void> => {
  const url = await generateGSTBillPDF(billData);
  if (url) {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
};
