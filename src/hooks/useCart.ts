import { useState, useEffect } from 'react';
import { Product } from '../models/Product';
import { Customer } from '../models/Customer';
import { calculateCartTotals } from '../utils/billingUtils';
import { addTransaction, updateStock, updateCustomerBalance, updateTransaction } from '../services/firebase/firestoreService';
import { eInvoiceService } from '../services/gst/eInvoiceService';
import { eWayBillService } from '../services/gst/eWayBillService';
import { generateGSTBillPDF } from '../services/pdf/pdfService';
import { sendWhatsAppBill } from '../services/whatsapp/whatsappService';

export interface CartItem {
    product: Product;
    quantity: number;
}

export const useCart = (currentUserId: string, cashierName = 'Staff') => {
    const [items, setItems] = useState<CartItem[]>([]);
    const [customer, setCustomer] = useState<Customer | null>(null);
    const [billNo] = useState(() => `#${Date.now().toString().slice(-4)}`);

    const addItem = (product: Product, qty = 1) => {
        setItems(prev => {
            const existing = prev.find(i => i.product.id === product.id);
            if (existing) {
                return prev.map(i =>
                    i.product.id === product.id ? { ...i, quantity: i.quantity + qty } : i,
                );
            }
            return [...prev, { product, quantity: qty }];
        });
    };

    const removeItem = (productId: string) => {
        setItems(prev => prev.filter(i => i.product.id !== productId));
    };

    const updateQty = (productId: string, qty: number) => {
        if (qty <= 0) {
            removeItem(productId);
            return;
        }
        setItems(prev =>
            prev.map(i => (i.product.id === productId ? { ...i, quantity: qty } : i)),
        );
    };

    const clearCart = () => {
        setItems([]);
        setCustomer(null);
    };

    const checkout = async (
        paymentType: string,
        splitAmounts?: { cash: number; upi: number; card: number; udhaar: number },
        orderType?: string,
        deliveryAddress?: string,
        discountAmount?: number,
        discountedGrandTotal?: number,
        generateEInvoiceFlag?: boolean,
        ewayBillVehicleNo?: string | null,
    ) => {
        const customerType = customer?.type ?? 'house';
        const totals = calculateCartTotals(items, customerType);

        // Use the discounted grand total if provided (discounts applied at screen level)
        const finalGrandTotal = discountedGrandTotal ?? totals.grandTotal;
        const finalDiscount = discountAmount ?? 0;

        const txnItems = items.map(i => {
            const rowTotal = i.product.price * i.quantity;
            return {
                productId: i.product.id,
                name: i.product.name,
                qty: i.quantity,
                unit: i.product.unit,
                price: i.product.price,
                gst: i.product.gstPercent ?? 0,
                gstAmount: rowTotal * ((i.product.gstPercent ?? 0) / 100),
                total: rowTotal,
            };
        });

        // Determine effective payment type
        const isSplit = splitAmounts &&
            [splitAmounts.cash, splitAmounts.upi, splitAmounts.card, splitAmounts.udhaar]
                .filter(v => v > 0).length > 1;

        const txn = {
            billNo,
            items: txnItems,
            subtotal: totals.subtotal,
            totalGST: totals.totalGst,
            // Always persist the final (post-discount) grand total
            grandTotal: finalGrandTotal,
            discountAmount: finalDiscount > 0 ? finalDiscount : 0,
            paymentType: (isSplit ? 'SPLIT' : paymentType) as any,
            paymentSplit: splitAmounts ?? undefined,
            customerId: customer?.id ?? undefined,
            customerName: customer?.name ?? undefined,
            cashierId: currentUserId,
            cashierName,
            orderType: (orderType ?? 'in_store') as any,
            deliveryAddress: deliveryAddress ?? undefined,
            timestamp: new Date().toISOString(),
            isReturn: false,
        };

        let txnId: string;
        let pdfUrl: any;
        let generatedIrn = null;
        let generatedEwb = null;

        try {
            txnId = await addTransaction(txn);

            // ==========================================
            // Compliance Generation (E-Invoice / E-Way Bill)
            // ==========================================
            if (generateEInvoiceFlag) {
                try {
                    const record = await eInvoiceService.generateIRN(
                        { ...txn, id: txnId } as any,
                        undefined, // gstin not mapped on Customer yet
                        customer?.name,
                        customer?.houseNo ?? undefined
                    );
                    generatedIrn = record.irn;
                    if (record.ewayBillNo) generatedEwb = record.ewayBillNo;
                    
                    await updateTransaction(txnId, { irn: generatedIrn, ewayBillNo: generatedEwb } as any);
                } catch (gspErr) {
                    console.error('[useCart] E-Invoice generation failed (non-fatal):', gspErr);
                }
            } else if (ewayBillVehicleNo) {
                try {
                    const record = await eWayBillService.generateEWB(
                        { ...txn, id: txnId } as any,
                        { vehicleNo: ewayBillVehicleNo, transDistance: 50 }
                    );
                    generatedEwb = record.ewayBillNo;
                    
                    await updateTransaction(txnId, { ewayBillNo: generatedEwb } as any);
                } catch (ewbErr) {
                    console.error('[useCart] EWB generation failed:', ewbErr);
                }
            }

            // Update stock (clamp to 0 minimum — never go negative)
            await Promise.all(
                items.map(item => {
                    const newStock = Math.max(0, item.product.currentStock - item.quantity);
                    return updateStock(item.product.id, newStock);
                })
            );

            // Update udhaar: full UDHAAR payment or split udhaar portion
            const udhaarAmt = isSplit
                ? (splitAmounts?.udhaar || 0)
                : (paymentType === 'UDHAAR' ? finalGrandTotal : 0);
            if (udhaarAmt > 0 && customer?.id) {
                await updateCustomerBalance(customer.id, udhaarAmt);
            }

            // Generate PDF (non-fatal: don't block checkout on PDF failure)
            try {
                pdfUrl = await generateGSTBillPDF({ ...txn, id: txnId, irn: generatedIrn, ewayBillNo: generatedEwb } as any);
                if (customer?.whatsappNumber) {
                    await sendWhatsAppBill(customer.whatsappNumber, billNo, pdfUrl as string);
                }
            } catch (pdfErr) {
                console.warn('[useCart] PDF/WhatsApp failed (non-fatal):', pdfErr);
                pdfUrl = null;
            }

            // Only clear cart if transaction succeeded
            clearCart();
        } catch (err) {
            console.error('[useCart] Checkout failed:', err);
            throw err;
        }

        return { txnId: txnId!, pdfUrl, irn: generatedIrn, ewayBillNo: generatedEwb };
    };

    const totals = calculateCartTotals(items, customer?.type ?? 'house');

    return { items, customer, setCustomer, addItem, removeItem, updateQty, clearCart, checkout, totals, billNo };
};
