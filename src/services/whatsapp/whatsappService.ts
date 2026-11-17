/** Native sharing helpers for invoices and generated PDF files. */
import { Linking } from 'react-native';
import Share from 'react-native-share';
import { STORE_INFO } from '../../config/constants';
import { buildBillMessage, type BillShareData } from './billMessage';

export { buildBillMessage };
export type { BillShareData };

const whatsappUrl = (phone: string, message: string) => {
  const digits = phone.replace(/\D/g, '');
  const formattedPhone = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
};

export const sendWhatsAppBill = async (
  phone: string,
  billNumber: string,
  _pdfUrl: string,
  storeName = STORE_INFO.name,
): Promise<void> => {
  if (!phone) return;
  const message = `🙏 Thank you for shopping at ${storeName}!\n\nBill No: *${billNumber}*\n\nPlease keep this for your records.`;
  await Linking.openURL(whatsappUrl(phone, message));
};

export const shareDetailedBill = async (phone: string, billData: BillShareData): Promise<void> => {
  if (!phone) return;
  await Linking.openURL(whatsappUrl(phone, buildBillMessage(billData)));
};

export const sendWhatsAppMessage = sendWhatsAppBill;

/** Opens Android's share sheet with a generated invoice PDF attached. */
export const shareNativePDF = async (pdfPath: string, billNo: string, customerName: string) => {
  if (!pdfPath) return;
  const fileUrl = pdfPath.startsWith('file://') ? pdfPath : `file://${pdfPath}`;
  await Share.open({
    url: fileUrl,
    type: 'application/pdf',
    filename: `${billNo.replace(/[^a-z0-9_-]/gi, '_')}.pdf`,
    title: `Invoice ${billNo}`,
    message: `Invoice ${billNo}${customerName ? ` for ${customerName}` : ''}`,
    useInternalStorage: true,
    failOnCancel: false,
  });
};
