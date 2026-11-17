/**
 * firestoreService.ts  (Data-access barrel)
 * ──────────────────────────────────────────
 * Central hub that every screen imports from.
 * Routes to the active backend based on DATA_MODE (.env):
 *   LOCAL    — on-device data, including purchases and PIN login (default)
 *   SUPABASE — optional cloud database with offline support
 */

import * as OfflineData from '../offline/offlineData';
import * as LocalService from '../local/localDataService';
import { ENV } from '../../config/env';
import { PIN_MAP } from '../../config/constants';
import type { SaleInput, SaleResult, PurchaseFilter } from '../database/supabaseDataService';
import type { TransactionItem } from '../../models/Transaction';
import type { StaffRole } from '../../models/Staff';

// ─── Resolve active backend ──────────────────────────────────────────────────
export type DataMode = 'SUPABASE' | 'LOCAL';

export const DATA_MODE: DataMode =
  ENV.DATA_MODE === 'SUPABASE' ? 'SUPABASE' : 'LOCAL';

/** Local storage service used when cloud sync is disabled. */
const FallbackService = LocalService;

const needsSupabase = (feature: string) => async (..._args: any[]): Promise<never> => {
  throw new Error(`${feature} needs the Supabase database (DATA_MODE=SUPABASE).`);
};

// ─── Products ────────────────────────────────────────────────────────────────
export const getProducts = DATA_MODE === 'SUPABASE' ? OfflineData.getProducts : FallbackService.getProducts;
export const getProduct  = DATA_MODE === 'SUPABASE'
  ? OfflineData.getProduct
  : (FallbackService as any).getProduct
    ?? (async (id: string) => {
      const all = await FallbackService.getProducts();
      return all.find((p: any) => p.id === id) ?? null;
    });
export const addProduct    = DATA_MODE === 'SUPABASE' ? OfflineData.addProduct    : FallbackService.addProduct;
export const updateProduct = DATA_MODE === 'SUPABASE' ? OfflineData.updateProduct : FallbackService.updateProduct;
export const deleteProduct = DATA_MODE === 'SUPABASE'
  ? OfflineData.deleteProduct
  : LocalService.deleteProduct;

// ─── Stock ───────────────────────────────────────────────────────────────────
export const updateStock = async (productId: string, newStock: number): Promise<void> => {
  await updateProduct(productId, { currentStock: newStock } as any);
};
export const decrementStock = DATA_MODE === 'SUPABASE'
  ? OfflineData.decrementStock
  : ((FallbackService as any).decrementStock ?? (async (productId: string, qty: number) => {
    const all = await FallbackService.getProducts();
    const p = all.find((prod: any) => prod.id === productId);
    if (p) await FallbackService.updateProduct(productId, { currentStock: Math.max(0, (p as any).currentStock - qty) } as any);
  }));

// ─── Customers ───────────────────────────────────────────────────────────────
export const getCustomers          = DATA_MODE === 'SUPABASE' ? OfflineData.getCustomers          : FallbackService.getCustomers;
export const getCustomer           = DATA_MODE === 'SUPABASE' ? OfflineData.getCustomer           : FallbackService.getCustomer;
export const addCustomer           = DATA_MODE === 'SUPABASE' ? OfflineData.addCustomer           : FallbackService.addCustomer;
export const updateCustomer        = DATA_MODE === 'SUPABASE' ? OfflineData.updateCustomer        : FallbackService.updateCustomer;
export const updateCustomerBalance = DATA_MODE === 'SUPABASE' ? OfflineData.updateCustomerBalance : FallbackService.updateCustomerBalance;

// ─── Transactions ────────────────────────────────────────────────────────────
export const addTransaction          = DATA_MODE === 'SUPABASE' ? OfflineData.addTransaction          : FallbackService.addTransaction;
export const updateTransaction       = DATA_MODE === 'SUPABASE' ? OfflineData.updateTransaction       : ((FallbackService as any).updateTransaction ?? (async () => {}));
export const getTransactions         = DATA_MODE === 'SUPABASE' ? OfflineData.getTransactions         : FallbackService.getTransactions;
export const getCustomerTransactions = DATA_MODE === 'SUPABASE' ? OfflineData.getCustomerTransactions : FallbackService.getCustomerTransactions;

// ─── Sale checkout ───────────────────────────────────────────────────────────
// Supabase: atomic cloud call or offline queue with provisional bill number.
// LOCAL: best-effort steps on the device.
const localSale = async (input: SaleInput): Promise<SaleResult> => {
  const items: TransactionItem[] = input.items.map(i => {
    const line = Math.round(i.price * i.qty * 100) / 100;
    const gstAmount = Math.round(line * i.gst) / 100;
    return { ...i, gstAmount, total: line + gstAmount };
  });
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const totalGST = items.reduce((s, i) => s + i.gstAmount, 0);
  const discount = input.discount ?? 0;
  const grandTotal = Math.round((subtotal + totalGST - discount) * 100) / 100;
  const udhaar = input.paymentType === 'UDHAAR' ? grandTotal
    : input.paymentType === 'SPLIT' ? input.paymentSplit?.udhaar ?? 0 : 0;
  if (udhaar > 0 && !input.customerId) throw new Error('Choose a customer to give Udhaar');
  if (input.paymentType === 'SPLIT') {
    const split = input.paymentSplit ?? { cash: 0, upi: 0, card: 0, udhaar: 0 };
    const paid = split.cash + split.upi + split.card + split.udhaar;
    if (Math.abs(paid - grandTotal) > 0.01) throw new Error(`Split amounts must add up to ₹${grandTotal.toFixed(2)}`);
  }

  const customer = input.customerId ? await FallbackService.getCustomer(input.customerId) : null;
  const timestampNow = new Date();
  const fyStart = timestampNow.getMonth() >= 3 ? timestampNow.getFullYear() : timestampNow.getFullYear() - 1;
  const fy = `${String(fyStart).slice(-2)}${String(fyStart + 1).slice(-2)}`;
  const recent = await FallbackService.getTransactions(5000);
  const prefix = `SMS/${fy}/`;
  const sequence = recent.reduce((max, t) => {
    if (!t.billNo.startsWith(prefix)) return max;
    const number = Number(t.billNo.slice(prefix.length));
    return Number.isFinite(number) ? Math.max(max, number) : max;
  }, 0) + 1;
  const billNo = `${prefix}${String(sequence).padStart(4, '0')}`;
  const timestamp = new Date().toISOString();
  const id = await FallbackService.addTransaction({
    billNo, items, subtotal, totalGST, grandTotal, discountAmount: discount,
    paymentType: input.paymentType, paymentSplit: input.paymentSplit,
    customerId: input.customerId ?? undefined, customerName: customer?.name, customerGstNumber: customer?.gstNumber,
    cashierId: input.cashierId, cashierName: input.cashierName,
    orderType: input.orderType ?? 'in_store', timestamp, isReturn: false,
  });
  for (const i of input.items) await decrementStock(i.productId, i.qty);
  if (udhaar > 0 && input.customerId) await FallbackService.updateCustomerBalance(input.customerId, udhaar);
  return {
    id, billNo, items, subtotal, totalGST, discount, grandTotal,
    udhaarAdded: udhaar, customerName: customer?.name ?? null, stockWarnings: [], timestamp,
  };
};

export const createSale = DATA_MODE === 'SUPABASE' ? OfflineData.createSale : localSale;

// Re-export types so screens don't need to know about the offline layer.
export type { SaleInput, SaleResult, PurchaseFilter };

// ─── Staff login ─────────────────────────────────────────────────────────────
const localPinLogin = async (storeId: string, pin: string) => {
  const entry = PIN_MAP[pin];
  if (!entry) return { ok: false, error: 'Wrong PIN' };
  return { ok: true, id: `local-${entry.role.toLowerCase()}`, name: entry.name, role: entry.role as StaffRole, storeId };
};
export const staffLogin  = DATA_MODE === 'SUPABASE' ? OfflineData.staffLogin
  : LocalService.staffLogin;
export const setStaffPin = DATA_MODE === 'SUPABASE' ? OfflineData.setStaffPin
  : LocalService.setStaffPin;

// ─── Suppliers & purchases ───────────────────────────────────────────────────
const S = DATA_MODE === 'SUPABASE';
const L = DATA_MODE === 'LOCAL';
export const getSuppliers          = S ? OfflineData.getSuppliers          : L ? LocalService.getSuppliers : async () => [];
export const getSupplier           = S ? OfflineData.getSupplier           : L ? LocalService.getSupplier : async (_id: string) => null;
export const addSupplier           = S ? OfflineData.addSupplier           : L ? LocalService.addSupplier : needsSupabase('Suppliers');
export const updateSupplier        = S ? OfflineData.updateSupplier        : L ? LocalService.updateSupplier : needsSupabase('Suppliers');
export const archiveSupplier       = S ? OfflineData.archiveSupplier       : L ? LocalService.archiveSupplier : needsSupabase('Suppliers');
export const getPurchases          = S ? OfflineData.getPurchases          : L ? LocalService.getPurchases : async (_f?: PurchaseFilter) => [];
export const getPurchase           = S ? OfflineData.getPurchase           : L ? LocalService.getPurchase : async (_id: string) => null;
export const createPurchase        = S ? OfflineData.createPurchase        : L ? LocalService.createPurchase : needsSupabase('Purchases');
export const deletePurchase        = S ? OfflineData.deletePurchase        : L ? LocalService.deletePurchase : needsSupabase('Purchases');
export const getSupplierPayments   = S ? OfflineData.getSupplierPayments   : L ? LocalService.getSupplierPayments : async (_o: { supplierId?: string; purchaseId?: string; limit?: number }) => [];
export const recordSupplierPayment = S ? OfflineData.recordSupplierPayment : L ? LocalService.recordSupplierPayment : needsSupabase('Supplier payments');

// ─── Analytics (graceful fallback) ───────────────────────────────────────────
export const getDailySalesSummary = DATA_MODE === 'SUPABASE'
  ? OfflineData.getDailySalesSummary
  : DATA_MODE === 'LOCAL' ? LocalService.getDailySalesSummary : async (_date?: string) => ({
      total_transactions: 0, total_revenue: 0, total_gst: 0,
      cash_sales: 0, upi_sales: 0, card_sales: 0, udhaar_sales: 0,
      e_invoice_count: 0, permit_count: 0,
    });

export const getLowStockProducts = DATA_MODE === 'SUPABASE'
  ? OfflineData.getLowStockProducts
  : async () => {
      const all = await FallbackService.getProducts();
      return all.filter((p: any) => p.currentStock <= p.minThreshold);
    };
