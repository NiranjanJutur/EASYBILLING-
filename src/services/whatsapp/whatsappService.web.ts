/** Web sharing helpers for customer bills. */
import { STORE_INFO } from '../../config/constants';
import { buildBillMessage, type BillShareData } from './billMessage';

export { buildBillMessage };
export type { BillShareData };

export const sendWhatsAppBill = async (
  phone: string,
  billNumber: string,
  _pdfUrl: string,
  storeName = STORE_INFO.name,
): Promise<void> => {
  if (!phone) return;
  const digits = phone.replace(/\D/g, '');
  const formattedPhone = digits.length === 10 ? `91${digits}` : digits;
  const message = `🙏 Thank you for shopping at ${storeName}!\n\nBill No: *${billNumber}*\n\nPlease keep this for your records.`;
  window.open(`https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`, '_blank');
};

export const shareDetailedBill = async (phone: string, billData: BillShareData): Promise<void> => {
  if (!phone) return;
  const digits = phone.replace(/\D/g, '');
  const formattedPhone = digits.length === 10 ? `91${digits}` : digits;
  const url = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(buildBillMessage(billData))}`;
  window.open(url, '_blank');
};

export const sendWhatsAppMessage = sendWhatsAppBill;

/** Shares a generated PDF when supported, otherwise downloads it. */
export const shareNativePDF = async (pdfUrl: string, billNo: string, _customerName: string) => {
  try {
    const fileName = `${billNo.replace(/[^a-z0-9_-]/gi, '_')}.pdf`;
    const response = await fetch(pdfUrl);
    const blob = await response.blob();
    const file = new File([blob], fileName, { type: 'application/pdf' });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ title: `Invoice ${billNo}`, files: [file] });
      return;
    }
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error('Failed to share PDF:', error);
  }
};
