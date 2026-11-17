/**
 * supabaseDataService.ts
 * ──────────────────────
 * Atomic, type-safe data access layer for Supabase.
 * All column mappings between snake_case (DB) and camelCase (TS) live here.
 */

import { supabase } from '../../config/supabase';
import type { Product } from '../../models/Product';
import type { Customer } from '../../models/Customer';
import type { Transaction, TransactionItem, PaymentType, OrderType } from '../../models/Transaction';
import type {
  Supplier, SupplierInput, Purchase, PurchaseItem, SupplierPayment,
  NewPurchase, NewPurchaseResult, PurchasePaymentStatus,
} from '../../models/Supplier';
import type { StaffRole } from '../../models/Staff';
import { getActiveStoreId } from '../activeStoreId';

/**
 * Turns Supabase/PostgREST errors into a message a shop owner can act on.
 * A missing function or table means the SQL migrations have not been run.
 */
export function friendlyDbError(error: { code?: string; message?: string } | null | undefined): string {
  if (!error) return 'Unknown database error';
  const msg = error.message ?? '';
  if (error.code === 'PGRST202' || error.code === '42883' || error.code === '42P01' || /does not exist|Could not find the function/i.test(msg)) {
    return 'The database is not set up for this feature yet. Run the SQL files in supabase/migrations (see SUPABASE_SETUP.md).';
  }
  if (/Failed to fetch|NetworkError|Network request failed/i.test(msg)) {
    return 'No internet connection. Check the network and try again.';
  }
  return msg || 'Database error';
}

const fail = (error: { code?: string; message?: string }): never => {
  throw new Error(friendlyDbError(error));
};

// We enforce strict store isolation. No graceful degradation.
// The `store_id` column MUST exist in products, customers, and transactions.
function attachStoreId(row: Record<string, any>): Record<string, any> {
  row.store_id = getActiveStoreId();
  return row;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns today's date in IST as a YYYY-MM-DD string.
 * Using en-CA locale gives ISO format; timeZone ensures IST, not UTC.
 * This prevents the "₹0 after 6:30 PM" bug caused by UTC vs IST date mismatch.
 */
const getTodayIST = (): string =>
    new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

// ─── Mappers ─────────────────────────────────────────────────────────────────

/** DB row → TS Product */
function rowToProduct(row: Record<string, any>): Product {
  return {
    id:                   row.id,
    name:                 row.name,
    category:             row.category ?? '',
    imageUrl:             row.image_url ?? '',
    price:                Number(row.price),
    gstPercent:           row.gst_percent as Product['gstPercent'],
    currentStock:         Number(row.current_stock),
    minThreshold:         Number(row.min_threshold),
    unit:                 row.unit ?? 'pcs',
    packSize:             row.pack_size != null ? Number(row.pack_size) : undefined,
    supplierId:           row.supplier_id ?? null,
    supplierPhone:        row.supplier_phone ?? '',
    purchasePrice:        Number(row.purchase_price),
    competitorPriceNote:  row.competitor_price_note ?? null,
    isWeightBased:        Boolean(row.is_weight_based),
    barcode:              row.barcode ?? null,
    sku:                  row.sku ?? null,
    hsnCode:              row.hsn_code ?? null,
    expiryDate:           row.expiry_date ?? null,
    isActive:             Boolean(row.is_active),
    createdAt:            row.created_at ?? undefined,
    updatedAt:            row.updated_at ?? undefined,
  };
}

/** TS Product (insert) → DB row (omit id — Supabase generates UUID) */
function productToRow(p: Omit<Product, 'id'>): Record<string, any> {
  return {
    name:                  p.name,
    category:              p.category,
    image_url:             p.imageUrl,
    price:                 p.price,
    gst_percent:           p.gstPercent,
    current_stock:         p.currentStock,
    min_threshold:         p.minThreshold,
    unit:                  p.unit,
    pack_size:             p.packSize ?? null,
    supplier_id:           p.supplierId || null,
    supplier_phone:        p.supplierPhone,
    purchase_price:        p.purchasePrice,
    competitor_price_note: p.competitorPriceNote || null,
    is_weight_based:       p.isWeightBased,
    hsn_code:              p.hsnCode || null,
    expiry_date:           p.expiryDate || null,
    is_active:             p.isActive,
  };
}

/** TS Product (update patch) → DB row patch */
function productPatchToRow(patch: Partial<Product>): Record<string, any> {
  const row: Record<string, any> = {};
  if (patch.name             !== undefined) row.name                  = patch.name;
  if (patch.category         !== undefined) row.category              = patch.category;
  if (patch.imageUrl         !== undefined) row.image_url             = patch.imageUrl;
  if (patch.price            !== undefined) row.price                 = patch.price;
  if (patch.gstPercent       !== undefined) row.gst_percent           = patch.gstPercent;
  if (patch.currentStock     !== undefined) row.current_stock         = patch.currentStock;
  if (patch.minThreshold     !== undefined) row.min_threshold         = patch.minThreshold;
  if (patch.unit             !== undefined) row.unit                  = patch.unit;
  if (patch.packSize         !== undefined) row.pack_size             = patch.packSize;
  if (patch.supplierId       !== undefined) row.supplier_id           = patch.supplierId;
  if (patch.supplierPhone    !== undefined) row.supplier_phone        = patch.supplierPhone;
  if (patch.purchasePrice    !== undefined) row.purchase_price        = patch.purchasePrice;
  if (patch.competitorPriceNote !== undefined) row.competitor_price_note = patch.competitorPriceNote;
  if (patch.isWeightBased    !== undefined) row.is_weight_based       = patch.isWeightBased;
  if (patch.hsnCode          !== undefined) row.hsn_code              = patch.hsnCode;
  if (patch.expiryDate       !== undefined) row.expiry_date           = patch.expiryDate;
  if (patch.isActive         !== undefined) row.is_active             = patch.isActive;
  return row;
}

/** DB row → TS Customer */
function rowToCustomer(row: Record<string, any>): Customer {
  return {
    id:                 row.id,
    udhaarId:           row.udhaar_id || null,
    gstNumber:          row.gst_number || null,
    name:               row.name || 'Unknown',
    phone:              row.phone || '',
    houseNo:            row.house_no || null,
    type:               (row.type || 'house') as Customer['type'],
    creditLimit:        Number(row.credit_limit) || 0,
    totalOutstanding:   Number(row.total_outstanding) || 0,
    whatsappNumber:     row.whatsapp_number || '',
    firstPurchaseDate:  row.first_purchase_date || null,
    slipImages:         row.slip_images || [],
    notes:              row.notes || null,
    photoUrl:           row.photo_url || null,
    isActive:           Boolean(row.is_active),
    createdAt:          row.created_at || undefined,
    updatedAt:          row.updated_at || undefined,
  };
}

/** TS Customer (insert) → DB row */
function customerToRow(c: Omit<Customer, 'id'>): Record<string, any> {
  return {
    udhaar_id:           c.udhaarId || null,
    gst_number:          c.gstNumber || null,
    name:                c.name,
    phone:               c.phone,
    house_no:            c.houseNo || null,
    type:                c.type,
    credit_limit:        c.creditLimit,
    total_outstanding:   c.totalOutstanding,
    whatsapp_number:     c.whatsappNumber,
    first_purchase_date: c.firstPurchaseDate || null,
    slip_images:         c.slipImages ?? [],
    notes:               c.notes || null,
    photo_url:           c.photoUrl || null,
    is_active:           c.isActive,
  };
}

/** TS Transaction (insert) → DB row */
function transactionToRow(t: Omit<Transaction, 'id'>): Record<string, any> {
  const row: Record<string, any> = {
    bill_no:          t.billNo,
    items:            t.items,
    subtotal:         t.subtotal,
    total_gst:        t.totalGST,
    grand_total:      t.grandTotal,
    payment_type:     t.paymentType,
    payment_split:    t.paymentSplit ?? null,
    customer_id:      t.customerId || null,
    customer_name:    t.customerName || null,
    cashier_id:       t.cashierId,
    cashier_name:     t.cashierName || null,
    order_type:       t.orderType || 'in_store',
    delivery_address: t.deliveryAddress || null,
    bill_pdf_url:     t.billPdfUrl || null,
    timestamp:        t.timestamp,
    is_return:        t.isReturn,
  };
  // Only include compliance/discount fields when they have values.
  // This prevents INSERT failures if these columns don't yet exist in the table.
  if (t.irn) row.irn = t.irn;
  if (t.ewayBillNo) row.eway_bill_no = t.ewayBillNo;
  if (t.discountAmount && t.discountAmount > 0) row.discount_amount = t.discountAmount;
  return row;
}

/** DB row → TS Transaction */
function rowToTransaction(t: Record<string, any>): Transaction {
  return {
    id:              t.id,
    billNo:          t.bill_no || 'N/A',
    items:           t.items || [],
    subtotal:        Number(t.subtotal) || 0,
    totalGST:        Number(t.total_gst) || 0,
    grandTotal:      Number(t.grand_total) || 0,
    paymentType:     (t.payment_type || 'CASH') as Transaction['paymentType'],
    paymentSplit:    t.payment_split || undefined,
    customerId:      t.customer_id || undefined,
    customerName:    t.customer_name || undefined,
    cashierId:       t.cashier_id,
    cashierName:     t.cashier_name || undefined,
    orderType:       (t.order_type || 'in_store') as Transaction['orderType'],
    deliveryAddress: t.delivery_address || undefined,
    billPdfUrl:      t.bill_pdf_url || undefined,
    timestamp:       t.timestamp,
    isReturn:        Boolean(t.is_return),
    irn:             t.irn || null,
    ewayBillNo:      t.eway_bill_no || null,
  };
}

// ─── Products ─────────────────────────────────────────────────────────────────

export const getProducts = async (): Promise<Product[]> => {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .eq('store_id', getActiveStoreId())
    .order('name');
  
  if (error) fail(error);
  return (data as Record<string, any>[]).map(rowToProduct);
};

export const addProduct = async (product: Omit<Product, 'id'>, id?: string): Promise<string> => {
  if (product.price < 0)         throw new Error('Price cannot be negative');
  if (product.currentStock < 0)  throw new Error('Stock cannot be negative');

  const row = attachStoreId(productToRow(product));
  if (id) row.id = id;
  const { data, error } = await supabase
    .from('products')
    .insert([row])
    .select('id')
    .single();
  if (error) fail(error);
  return data.id;
};

export const updateProduct = async (id: string, patch: Partial<Product>): Promise<void> => {
  if (patch.price !== undefined && patch.price < 0) throw new Error('Price cannot be negative');
  if (patch.currentStock !== undefined && patch.currentStock < 0) patch.currentStock = 0;

  const { error } = await supabase
    .from('products')
    .update(productPatchToRow(patch))
    .eq('id', id);
  if (error) fail(error);
};

/** Atomically decrement stock via RPC — avoids race conditions on concurrent sales */
export const decrementStock = async (productId: string, qty: number): Promise<void> => {
  const { error } = await supabase.rpc('decrement_product_stock', {
    p_product_id: productId,
    p_qty: qty,
  });
  if (error) fail(error);
};

/** Soft-delete: sets is_active = false */
export const deleteProduct = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('products')
    .update({ is_active: false })
    .eq('id', id);
  if (error) fail(error);
};

export const getLowStockProducts = async (): Promise<Product[]> => {
  const { data, error } = await supabase.rpc('get_low_stock_products', {
    p_store_id: getActiveStoreId(),
  });
  if (error) fail(error);
  return (data as Record<string, any>[]).map(rowToProduct);
};

// ─── Customers ────────────────────────────────────────────────────────────────

export const getCustomers = async (): Promise<Customer[]> => {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('is_active', true)
    .eq('store_id', getActiveStoreId())
    .order('name');
  if (error) fail(error);
  return (data as Record<string, any>[]).map(rowToCustomer);
};

export const getCustomer = async (id: string): Promise<Customer | null> => {
  const { data, error } = await supabase
    .from('customers').select('*').eq('id', id).single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    fail(error);
  }
  return rowToCustomer(data as Record<string, any>);
};

export const addCustomer = async (customer: Omit<Customer, 'id'>, id?: string): Promise<string> => {
  const row = attachStoreId(customerToRow(customer));
  if (id) row.id = id;
  const { data, error } = await supabase
    .from('customers').insert([row]).select('id').single();
  if (error) fail(error);
  return data.id;
};

export const updateCustomer = async (id: string, patch: Partial<Customer>): Promise<void> => {
  const row: Record<string, any> = {};
  if (patch.name             !== undefined) row.name               = patch.name;
  if (patch.phone            !== undefined) row.phone              = patch.phone;
  if (patch.gstNumber        !== undefined) row.gst_number         = patch.gstNumber;
  if (patch.houseNo          !== undefined) row.house_no           = patch.houseNo;
  if (patch.type             !== undefined) row.type               = patch.type;
  if (patch.creditLimit      !== undefined) row.credit_limit       = patch.creditLimit;
  if (patch.whatsappNumber   !== undefined) row.whatsapp_number    = patch.whatsappNumber;
  if (patch.firstPurchaseDate !== undefined) row.first_purchase_date = patch.firstPurchaseDate;
  if (patch.slipImages       !== undefined) row.slip_images        = patch.slipImages;
  if (patch.notes            !== undefined) row.notes              = patch.notes;
  if (patch.photoUrl         !== undefined) row.photo_url          = patch.photoUrl;
  if (patch.isActive         !== undefined) row.is_active          = patch.isActive;

  if (Object.keys(row).length === 0) return;

  const { error } = await supabase.from('customers').update(row).eq('id', id);
  if (error) fail(error);
};

export const updateCustomerBalance = async (
  customerId: string,
  amountDelta: number,
  clientRef?: string,
): Promise<void> => {
  const { error } = await supabase.rpc('increment_customer_balance', {
    p_customer_id: customerId,
    p_delta: amountDelta,
    p_client_ref: clientRef ?? null,
  });
  if (error) fail(error);
};

// ─── Transactions ─────────────────────────────────────────────────────────────

export const addTransaction = async (txn: Omit<Transaction, 'id'>, id?: string): Promise<string> => {
  const row = attachStoreId(transactionToRow(txn));
  if (id) row.id = id;
  const { data, error } = await supabase
    .from('transactions')
    .insert([row])
    .select('id')
    .single();
  if (error) {
    // Retry without compliance fields in case those columns don't exist yet
    console.warn('[DB] addTransaction first attempt failed, retrying without compliance columns:', error.message);
    const { irn, eway_bill_no, discount_amount, ...safeRow } = row;
    const { data: d2, error: e2 } = await supabase
      .from('transactions')
      .insert([safeRow])
      .select('id')
      .single();
    if (e2) fail(e2);
    return d2.id;
  }
  return data.id;
};

export const getTransactions = async (limit = 50): Promise<Transaction[]> => {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('store_id', getActiveStoreId())
    .order('timestamp', { ascending: false })
    .limit(limit);
  if (error) fail(error);
  return (data as Record<string, any>[]).map(rowToTransaction);
};

export const getCustomerTransactions = async (customerId: string): Promise<Transaction[]> => {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('customer_id', customerId)
    .eq('store_id', getActiveStoreId())
    .order('timestamp', { ascending: false });
  if (error) fail(error);
  return (data as Record<string, any>[]).map(rowToTransaction);
};

export const updateTransaction = async (id: string, patch: Partial<Transaction>): Promise<void> => {
  const rowPatch: Record<string, any> = {};
  if (patch.irn !== undefined) rowPatch.irn = patch.irn;
  if (patch.ewayBillNo !== undefined) rowPatch.eway_bill_no = patch.ewayBillNo;
  // Expand as needed for other compliance fields (ackNo, signedQRCode, etc)
  
  const { error } = await supabase.from('transactions').update(rowPatch).eq('id', id);
  if (error) fail(error);
};

/**
 * getDailySalesSummary
 * --------------------
 * FIXED: now uses IST local date instead of UTC .toISOString().
 * The old code used new Date().toISOString().split('T')[0] which gives the UTC
 * date — after 6:30 PM IST (= midnight UTC) it would query "tomorrow" and
 * return zero for everything. Now uses toLocaleDateString with Asia/Kolkata.
 */
export const getDailySalesSummary = async (date?: string) => {
  const istDate = date ?? getTodayIST();

  const { data, error } = await supabase.rpc('get_daily_sales_summary', {
    p_date: istDate,
    p_store_id: getActiveStoreId(),
  });
  if (error) fail(error);
  return data;
};

// ─── Staff login (PIN checked inside the database) ───────────────────────────

export interface StaffLoginResult {
  ok: boolean;
  id?: string;
  name?: string;
  role?: StaffRole;
  storeId?: string;
  error?: string;
  attemptsLeft?: number;
  locked?: boolean;
}

export const staffLogin = async (storeId: string, pin: string): Promise<StaffLoginResult> => {
  const { data, error } = await supabase.rpc('staff_login', { p_store_id: storeId, p_pin: pin });
  if (error) fail(error);
  return data as StaffLoginResult;
};

export const setStaffPin = async (ownerPin: string, role: StaffRole, newPin: string): Promise<void> => {
  const { data, error } = await supabase.rpc('set_staff_pin', {
    p_store_id: getActiveStoreId(),
    p_owner_pin: ownerPin,
    p_role: role,
    p_new_pin: newPin,
  });
  if (error) fail(error);
  if (!data?.ok) throw new Error(data?.error ?? 'Could not change the PIN');
};

// ─── Sales (one atomic database call) ────────────────────────────────────────

export interface SaleLine {
  productId: string;
  name: string;
  qty: number;
  unit: string;
  /** Unit price before GST, after any customer-type discount. */
  price: number;
  gst: number;
}

export interface SaleInput {
  items: SaleLine[];
  paymentType: PaymentType;
  paymentSplit?: { cash: number; upi: number; card: number; udhaar: number };
  customerId?: string | null;
  discount?: number;
  cashierId: string;
  cashierName: string;
  orderType?: OrderType;
  deliveryAddress?: string;
}

export interface SaleResult {
  id: string;
  billNo: string;
  items: TransactionItem[];
  subtotal: number;
  totalGST: number;
  discount: number;
  grandTotal: number;
  udhaarAdded: number;
  customerName: string | null;
  stockWarnings: { name: string; had: number; sold: number }[];
  timestamp: string;
  /** True when saved on this device and waiting to sync (bill number is provisional). */
  offline?: boolean;
}

/**
 * Saves the bill, reduces stock and adds Udhaar in ONE database transaction.
 * If anything fails, nothing is saved.
 */
export const createSale = async (input: SaleInput, clientRef?: string): Promise<SaleResult> => {
  const { data, error } = await supabase.rpc('create_sale', {
    p_store_id: getActiveStoreId(),
    p_items: input.items,
    p_payment_type: input.paymentType,
    p_payment_split: input.paymentType === 'SPLIT' ? input.paymentSplit ?? null : null,
    p_customer_id: input.customerId || null,
    p_discount: input.discount ?? 0,
    p_cashier_id: input.cashierId,
    p_cashier_name: input.cashierName,
    p_order_type: input.orderType ?? 'in_store',
    p_delivery_address: input.deliveryAddress ?? null,
    p_client_ref: clientRef ?? null,
  });
  if (error) fail(error);
  const r = data as Record<string, any>;
  return {
    id: r.id,
    billNo: r.billNo,
    items: (r.items ?? []).map((i: any) => ({
      productId: i.productId, name: i.name, qty: Number(i.qty), unit: i.unit,
      price: Number(i.price), gst: Number(i.gst), gstAmount: Number(i.gstAmount), total: Number(i.total),
    })),
    subtotal: Number(r.subtotal),
    totalGST: Number(r.totalGST),
    discount: Number(r.discount),
    grandTotal: Number(r.grandTotal),
    udhaarAdded: Number(r.udhaarAdded),
    customerName: r.customerName ?? null,
    stockWarnings: r.stockWarnings ?? [],
    timestamp: r.timestamp,
  };
};

// ─── Suppliers ───────────────────────────────────────────────────────────────

function rowToSupplier(r: Record<string, any>): Supplier {
  return {
    id:           r.id,
    name:         r.name,
    phone:        r.phone ?? '',
    gstNumber:    r.gst_number ?? null,
    address:      r.address ?? '',
    city:         r.city ?? '',
    paymentTerms: r.payment_terms === 'credit' ? 'credit' : 'cash',
    creditDays:   Number(r.credit_days) || 0,
    totalDue:     Number(r.total_due) || 0,
    notes:        r.notes ?? null,
    isActive:     r.is_active !== false,
    createdAt:    r.created_at,
    updatedAt:    r.updated_at,
  };
}

function supplierInputToRow(s: SupplierInput): Record<string, any> {
  return {
    name:          s.name.trim(),
    phone:         s.phone.replace(/[^\d+]/g, ''),
    gst_number:    s.gstNumber?.trim().toUpperCase() || null,
    address:       s.address.trim(),
    city:          s.city.trim(),
    payment_terms: s.paymentTerms,
    credit_days:   s.paymentTerms === 'credit' ? Math.round(s.creditDays) : 0,
    notes:         s.notes?.trim() || null,
  };
}

export const getSuppliers = async (): Promise<Supplier[]> => {
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .eq('store_id', getActiveStoreId())
    .eq('is_active', true)
    .order('name');
  if (error) fail(error);
  return (data ?? []).map(rowToSupplier);
};

export const getSupplier = async (id: string): Promise<Supplier | null> => {
  const { data, error } = await supabase.from('suppliers').select('*').eq('id', id).maybeSingle();
  if (error) fail(error);
  return data ? rowToSupplier(data) : null;
};

export const addSupplier = async (s: SupplierInput, id?: string): Promise<Supplier> => {
  const row = attachStoreId({ ...supplierInputToRow(s), total_due: Math.max(0, s.openingDue ?? 0) });
  if (id) row.id = id;
  const { data, error } = await supabase.from('suppliers').insert([row]).select('*').single();
  if (error) fail(error);
  return rowToSupplier(data);
};

export const updateSupplier = async (id: string, s: SupplierInput): Promise<void> => {
  const { error } = await supabase.from('suppliers').update(supplierInputToRow(s)).eq('id', id);
  if (error) fail(error);
};

export const archiveSupplier = async (id: string): Promise<void> => {
  const { error } = await supabase.from('suppliers').update({ is_active: false }).eq('id', id);
  if (error) fail(error);
};

// ─── Purchases ───────────────────────────────────────────────────────────────

function rowToPurchase(r: Record<string, any>): Purchase {
  return {
    id:            r.id,
    purchaseNo:    r.purchase_no,
    supplierId:    r.supplier_id,
    supplierName:  r.supplier_name,
    invoiceNo:     r.invoice_no ?? null,
    invoiceDate:   r.invoice_date,
    items: (r.items ?? []).map((i: any): PurchaseItem => ({
      productId:    i.productId,
      name:         i.name,
      qty:          Number(i.qty),
      unit:         i.unit,
      costPrice:    Number(i.costPrice),
      gstPercent:   Number(i.gstPercent),
      gstAmount:    Number(i.gstAmount),
      total:        Number(i.total),
      sellingPrice: i.sellingPrice != null ? Number(i.sellingPrice) : null,
    })),
    subtotal:      Number(r.subtotal),
    totalGst:      Number(r.total_gst),
    otherCharges:  Number(r.other_charges),
    discount:      Number(r.discount),
    grandTotal:    Number(r.grand_total),
    amountPaid:    Number(r.amount_paid),
    paymentStatus: r.payment_status as PurchasePaymentStatus,
    notes:         r.notes ?? null,
    createdBy:     r.created_by ?? null,
    createdAt:     r.created_at,
  };
}

export interface PurchaseFilter {
  supplierId?: string;
  status?: PurchasePaymentStatus | 'due';
  fromDate?: string;   // YYYY-MM-DD
  limit?: number;
}

export const getPurchases = async (filter: PurchaseFilter = {}): Promise<Purchase[]> => {
  let q = supabase
    .from('purchases')
    .select('*')
    .eq('store_id', getActiveStoreId())
    .order('invoice_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(filter.limit ?? 200);
  if (filter.supplierId) q = q.eq('supplier_id', filter.supplierId);
  if (filter.status === 'due') q = q.neq('payment_status', 'paid');
  else if (filter.status) q = q.eq('payment_status', filter.status);
  if (filter.fromDate) q = q.gte('invoice_date', filter.fromDate);
  const { data, error } = await q;
  if (error) fail(error);
  return (data ?? []).map(rowToPurchase);
};

export const getPurchase = async (id: string): Promise<Purchase | null> => {
  const { data, error } = await supabase.from('purchases').select('*').eq('id', id).maybeSingle();
  if (error) fail(error);
  return data ? rowToPurchase(data) : null;
};

export const createPurchase = async (p: NewPurchase, createdBy: string, clientRef?: string): Promise<NewPurchaseResult> => {
  const { data, error } = await supabase.rpc('create_purchase', {
    p_store_id:      getActiveStoreId(),
    p_supplier_id:   p.supplierId,
    p_items:         p.items.map(i => ({
      productId:    i.productId || null,
      isNew:        Boolean(i.isNew),
      name:         i.name.trim(),
      qty:          i.qty,
      unit:         i.unit,
      costPrice:    i.costPrice,
      gstPercent:   i.gstPercent,
      sellingPrice: i.sellingPrice ?? null,
      category:     i.category ?? '',
    })),
    p_invoice_no:    p.invoiceNo?.trim() || null,
    p_invoice_date:  p.invoiceDate || null,
    p_other_charges: p.otherCharges ?? 0,
    p_discount:      p.discount ?? 0,
    p_amount_paid:   p.amountPaid ?? 0,
    p_payment_mode:  p.paymentMode ?? 'CASH',
    p_notes:         p.notes ?? null,
    p_created_by:    createdBy,
    p_client_ref:    clientRef ?? null,
  });
  if (error) fail(error);
  const r = data as Record<string, any>;
  return {
    id: r.id,
    purchaseNo: r.purchaseNo,
    grandTotal: Number(r.grandTotal),
    amountPaid: Number(r.amountPaid),
    paymentStatus: r.paymentStatus,
    items: (r.items ?? []) as PurchaseItem[],
  };
};

export const deletePurchase = async (id: string): Promise<void> => {
  const { error } = await supabase.rpc('delete_purchase', { p_store_id: getActiveStoreId(), p_purchase_id: id });
  if (error) fail(error);
};

export const getSupplierPayments = async (opts: { supplierId?: string; purchaseId?: string; limit?: number }): Promise<SupplierPayment[]> => {
  let q = supabase
    .from('supplier_payments')
    .select('*')
    .eq('store_id', getActiveStoreId())
    .order('paid_at', { ascending: false })
    .limit(opts.limit ?? 100);
  if (opts.supplierId) q = q.eq('supplier_id', opts.supplierId);
  if (opts.purchaseId) q = q.eq('purchase_id', opts.purchaseId);
  const { data, error } = await q;
  if (error) fail(error);
  return (data ?? []).map((r: Record<string, any>) => ({
    id: r.id,
    supplierId: r.supplier_id,
    purchaseId: r.purchase_id ?? null,
    amount: Number(r.amount),
    mode: r.mode,
    reference: r.reference ?? null,
    note: r.note ?? null,
    paidBy: r.paid_by ?? null,
    paidAt: r.paid_at,
  }));
};

export const recordSupplierPayment = async (opts: {
  supplierId: string;
  amount: number;
  mode: string;
  purchaseId?: string | null;
  reference?: string;
  note?: string;
  paidBy: string;
}, clientRef?: string): Promise<number> => {
  const { data, error } = await supabase.rpc('record_supplier_payment', {
    p_store_id:    getActiveStoreId(),
    p_supplier_id: opts.supplierId,
    p_amount:      opts.amount,
    p_mode:        opts.mode,
    p_purchase_id: opts.purchaseId ?? null,
    p_reference:   opts.reference?.trim() || null,
    p_note:        opts.note?.trim() || null,
    p_paid_by:     opts.paidBy,
    p_client_ref:  clientRef ?? null,
  });
  if (error) fail(error);
  return Number(data?.supplierDue ?? 0);
};
