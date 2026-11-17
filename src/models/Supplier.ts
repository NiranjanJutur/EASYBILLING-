/**
 * Supplier.ts — suppliers, purchases (stock bought) and supplier payments.
 * These match the Supabase tables in supabase/migrations/001_core_schema.sql.
 */

export type SupplierPaymentTerms = 'cash' | 'credit';

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  gstNumber?: string | null;
  address: string;
  city: string;
  paymentTerms: SupplierPaymentTerms;
  creditDays: number;
  /** Money the shop still owes this supplier. Changed only by purchases/payments. */
  totalDue: number;
  notes?: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/** Fields the user fills in when adding or editing a supplier. */
export interface SupplierInput {
  name: string;
  phone: string;
  gstNumber?: string | null;
  address: string;
  city: string;
  paymentTerms: SupplierPaymentTerms;
  creditDays: number;
  notes?: string | null;
  /** Only when adding: money already owed from before this app. */
  openingDue?: number;
}

export type PurchasePaymentStatus = 'paid' | 'partial' | 'unpaid';

export interface PurchaseItem {
  productId: string;
  name: string;
  qty: number;
  unit: string;
  costPrice: number;          // per unit, before GST
  gstPercent: number;
  gstAmount: number;
  total: number;              // qty × costPrice + GST
  sellingPrice?: number | null;
}

export interface Purchase {
  id: string;
  purchaseNo: string;         // our number, e.g. PUR/SMS/26-27/0001
  supplierId: string;
  supplierName: string;
  invoiceNo?: string | null;  // the supplier's bill number
  invoiceDate: string;        // YYYY-MM-DD
  items: PurchaseItem[];
  subtotal: number;
  totalGst: number;
  otherCharges: number;
  discount: number;
  grandTotal: number;
  amountPaid: number;
  paymentStatus: PurchasePaymentStatus;
  notes?: string | null;
  createdBy?: string | null;
  createdAt?: string;
}

export interface SupplierPayment {
  id: string;
  supplierId: string;
  purchaseId?: string | null;
  amount: number;
  mode: string;
  reference?: string | null;
  note?: string | null;
  paidBy?: string | null;
  paidAt: string;
}

/** One line on a new purchase. No productId = new item (or matched by name). */
export interface NewPurchaseItem {
  productId?: string | null;
  /** A new item: productId is an id made on the device. */
  isNew?: boolean;
  name: string;
  qty: number;
  unit: string;
  costPrice: number;
  gstPercent: number;
  sellingPrice?: number | null;
  category?: string;
}

export interface NewPurchase {
  supplierId: string;
  invoiceNo?: string;
  invoiceDate?: string;       // YYYY-MM-DD
  items: NewPurchaseItem[];
  otherCharges?: number;
  discount?: number;
  amountPaid?: number;
  paymentMode?: string;
  notes?: string;
}

export interface NewPurchaseResult {
  id: string;
  purchaseNo: string;
  grandTotal: number;
  amountPaid: number;
  paymentStatus: PurchasePaymentStatus;
  items: PurchaseItem[];
  /** True when saved on this device and waiting to sync. */
  offline?: boolean;
}

export const SUPPLIER_PAYMENT_MODES = ['CASH', 'UPI', 'BANK', 'CHEQUE'] as const;
export type SupplierPaymentMode = typeof SUPPLIER_PAYMENT_MODES[number];
