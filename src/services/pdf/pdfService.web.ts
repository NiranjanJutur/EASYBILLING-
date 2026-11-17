import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
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

export const generateGSTBillPDF = async (
    billData: any,
    storeName = STORE_INFO.name,
    storeInfo?: PdfStoreInfo,
): Promise<string | null> => {
    try {
        const store = storeInfo || STORE_INFO;
        const doc = new jsPDF();
        
        // 1. Header (Store Info)
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text(store.name, 105, 20, { align: 'center' });
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(store.address, 105, 28, { align: 'center' });
        doc.text(`Ph: ${store.phone} | email: ${store.email}`, 105, 34, { align: 'center' });
        doc.setFont('helvetica', 'bold');
        doc.text(`GSTIN: ${store.gstin}`, 105, 40, { align: 'center' });
        
        // Line break
        doc.setLineWidth(0.5);
        doc.line(14, 45, 196, 45);

        // 2. Bill Meta Information
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        
        // Left column
        doc.text(`Bill No: ${billData.billNo}`, 14, 53);
        const billDate = new Date(billData.timestamp || Date.now());
        doc.text(`Date: ${billDate.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}`, 14, 59);
        doc.text(`Time: ${billDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}`, 14, 65);
        
        // Right column
        doc.text(`Customer: ${billData.customerName || 'Walk-in'}`, 130, 53);
        doc.text(`Biller: ${billData.cashierName || billData.billerName || 'Staff'}`, 130, 59);
        doc.text(`Payment: ${billData.paymentType || 'CASH'}`, 130, 65);
        if (billData.customerGstNumber) doc.text(`Customer GSTIN: ${billData.customerGstNumber}`, 14, 71);

        // 3. Items Table
        const tableColumn = ["#", "Item Description", "Qty", "Unit Price", "GST", "Total"];
        const tableRows: any[] = [];

        billData.items.forEach((item: any, index: number) => {
            const itemData = [
                (index + 1).toString(),
                item.name,
                `${item.qty} ${item.unit || ''}`,
                `Rs. ${item.price.toFixed(2)}`,
                item.gst > 0 ? `${item.gst}%` : '-',
                `Rs. ${(Number(item.price) * Number(item.qty)).toFixed(2)}`
            ];
            tableRows.push(itemData);
        });

        autoTable(doc, {
            startY: 78,
            head: [tableColumn],
            body: tableRows,
            theme: 'striped',
            headStyles: { fillColor: [41, 128, 185], textColor: 255 },
            styles: { fontSize: 9, cellPadding: 3 },
            columnStyles: {
                0: { cellWidth: 10 },
                2: { halign: 'center' },
                3: { halign: 'right' },
                4: { halign: 'center' },
                5: { halign: 'right', fontStyle: 'bold' }
            }
        });

        // 4. Totals Calculation Area
        const finalY = (doc as any).lastAutoTable.finalY + 10;
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('Subtotal:', 140, finalY);
        doc.text(`Rs. ${billData.subtotal.toFixed(2)}`, 196, finalY, { align: 'right' });

        doc.text('Total GST:', 140, finalY + 6);
        doc.text(`Rs. ${billData.totalGST.toFixed(2)}`, 196, finalY + 6, { align: 'right' });

        const discount = billData.discount || 0;
        if (discount > 0) {
            doc.text('Discount:', 140, finalY + 12);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(39, 174, 96);
            doc.text(`-Rs. ${discount.toFixed(2)}`, 196, finalY + 12, { align: 'right' });
            doc.setTextColor(0, 0, 0); // reset
        }

        const grandY = discount > 0 ? finalY + 20 : finalY + 14;
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('GRAND TOTAL:', 130, grandY);
        doc.text(`Rs. ${billData.grandTotal.toFixed(2)}`, 196, grandY, { align: 'right' });

        if (billData.paymentType === 'SPLIT' && billData.paymentSplit) {
            doc.setFontSize(9);
            doc.text(`Cash ₹${billData.paymentSplit.cash.toFixed(2)} · UPI ₹${billData.paymentSplit.upi.toFixed(2)} · Card ₹${billData.paymentSplit.card.toFixed(2)} · Udhaar ₹${billData.paymentSplit.udhaar.toFixed(2)}`, 14, grandY + 8);
        }
        const upiAmount = billData.paymentType === 'SPLIT'
            ? Number(billData.paymentSplit?.upi ?? 0)
            : billData.paymentType === 'UPI' ? Number(billData.grandTotal) : 0;
        const upiLink = makeUpiPaymentLink(storeInfo?.upiId ?? STORE_INFO.upiId, upiAmount, billData.billNo, storeName);
        if (upiLink) {
            doc.setFontSize(8);
            doc.text(`UPI: ${upiLink}`, 14, grandY + 14, { maxWidth: 180 });
        }
        
        // 5. Footer Message
        doc.setFontSize(10);
        doc.setFont('helvetica', 'italic');
        const footerY = grandY + 20;
        doc.text('Thank you for your business!', 105, footerY, { align: 'center' });
        doc.text('This is a computer generated invoice.', 105, footerY + 6, { align: 'center' });

        // Generate Blob URL
        const pdfBlob = doc.output('blob');
        const pdfUrl = URL.createObjectURL(pdfBlob);
        
        return pdfUrl;

    } catch (err) {
        console.error('Failed to generate PDF invoice', err);
        return null;
    }
};
