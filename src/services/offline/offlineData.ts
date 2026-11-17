/**
 * offlineData.ts — the Supabase data layer with offline support.
 *
 * Same functions as supabaseDataService, but:
 *  • reads save a copy on the device and fall back to it without internet;
 *  • changes are sent straight away when online, or queued when offline
 *    (or when older changes are still waiting, to keep the order);
 *  • queued changes are shown in every list immediately (stock, Udhaar,
 *    supplier dues, bills, purchases), so the app behaves the same offline.
 */
import * as DB from '../database/supabaseDataService';
import type { SaleInput, SaleResult, StaffLoginResult, PurchaseFilter } from '../database/supabaseDataService';
import { getActiveStoreId } from '../activeStoreId';
import {
  readCache, writeCache, isNetworkError, reportOnline, enqueue, pendingOps, registerSyncHandler,
  getOutbox, discardOp, type OutboxOp,
} from './offlineStore';
import { kvStore } from './kvStore';
import { uuid, shortCode, sha256 } from '../../utils/ids';
import { PIN_MAP } from '../../config/constants';
import type { Product } from '../../models/Product';
import type { Customer } from '../../models/Customer';
import type { Transaction, TransactionItem } from '../../models/Transaction';
import type {
  Supplier, SupplierInput, Purchase, PurchaseItem, SupplierPayment, NewPurchase, NewPurchaseResult,
} from '../../models/Supplier';
import type { StaffRole } from '../../models/Staff';

const storeId = () => getActiveStoreId();
const round2 = (n: number) => Math.round(n * 100) / 100;
const todayIST = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const dateIST = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const isDuplicate = (e: unknown) => /duplicate key|already exists/i.test(e instanceof Error ? e.message : String(e));

export const OFFLINE_MESSAGE = 'You are offline. This needs an internet connection — try again when connected.';

// ─── Reads with a saved copy ─────────────────────────────────────────────────

async function cached<T>(name: string, fetcher: () => Promise<T>, fallback: T, rethrow = false): Promise<T> {
  const sid = storeId();
  try {
    const data = await fetcher();
    reportOnline(true);
    writeCache(sid, name, data);
    return data;
  } catch (err) {
    if (isNetworkError(err)) {
      reportOnline(false);
      const copy = await readCache<T>(sid, name);
      return copy ? copy.data : fallback;
    }
    if (rethrow) throw err;
    console.error(`[data] ${name}:`, err instanceof Error ? err.message : err);
    const copy = await readCache<T>(sid, name);
    return copy ? copy.data : fallback;
  }
}

/** Changes still waiting to sync for the current store (failed ones are not shown as applied). */
const waiting = async (): Promise<OutboxOp[]> => (await pendingOps(storeId())).filter(o => o.status === 'pending');

// ─── Send now, or queue ──────────────────────────────────────────────────────

async function sendOrQueue<T>(opts: {
  kind: OutboxOp['kind'];
  label: string;
  payload: any;
  ref?: string;
  online: (ref: string) => Promise<T>;
  offline: () => T;
}): Promise<T> {
  const ref = opts.ref ?? uuid();
  if ((await waiting()).length === 0) {
    try {
      const r = await opts.online(ref);
      reportOnline(true);
      return r;
    } catch (err) {
      if (!isNetworkError(err)) throw err;
      reportOnline(false);
    }
  }
  await enqueue({ id: ref, storeId: storeId(), kind: opts.kind, payload: opts.payload, label: opts.label });
  return opts.offline();
}

/** Changes that need the cloud (deleting, GST, PIN changes) fail with a clear message offline. */
async function onlineOnly<T>(fn: () => Promise<T>): Promise<T> {
  try {
    const r = await fn();
    reportOnline(true);
    return r;
  } catch (err) {
    if (isNetworkError(err)) {
      reportOnline(false);
      throw new Error(OFFLINE_MESSAGE);
    }
    throw err;
  }
}

// ─── Overlays: show queued changes on top of saved data ─────────────────────

function overlayProducts(list: Product[], ops: OutboxOp[]): Product[] {
  const byId = new Map<string, Product>(list.map(p => [p.id, { ...p }]));
  for (const op of ops) {
    const p = op.payload;
    if (op.kind === 'product_insert') byId.set(p.id, { ...p.product, id: p.id });
    else if (op.kind === 'product_update') { const x = byId.get(p.id); if (x) Object.assign(x, p.patch); }
    else if (op.kind === 'sale') {
      for (const l of p.input.items as SaleInput['items']) {
        const x = byId.get(l.productId);
        if (x) x.currentStock = Math.max(0, x.currentStock - l.qty);
      }
    } else if (op.kind === 'purchase') {
      for (const it of p.purchase.items as NewPurchase['items']) {
        const x = (it.productId && byId.get(it.productId))
          || [...byId.values()].find(v => v.name.trim().toLowerCase() === it.name.trim().toLowerCase());
        if (x) {
          x.currentStock += it.qty;
          x.purchasePrice = it.costPrice;
          x.gstPercent = it.gstPercent as Product['gstPercent'];
          if (it.sellingPrice != null) x.price = it.sellingPrice;
        } else if (it.productId) {
          byId.set(it.productId, {
            id: it.productId, name: it.name.trim(), category: it.category ?? '', imageUrl: '',
            price: it.sellingPrice ?? it.costPrice, gstPercent: it.gstPercent as Product['gstPercent'],
            currentStock: it.qty, minThreshold: 0, unit: it.unit, supplierId: p.purchase.supplierId,
            supplierPhone: '', purchasePrice: it.costPrice, isWeightBased: ['kg', 'g', 'ltr', 'ml'].includes(it.unit),
            isActive: true,
          });
        }
      }
    }
  }
  return [...byId.values()].filter(x => x.isActive !== false).sort((a, b) => a.name.localeCompare(b.name));
}

function overlayCustomers(list: Customer[], ops: OutboxOp[]): Customer[] {
  const byId = new Map<string, Customer>(list.map(c => [c.id, { ...c }]));
  for (const op of ops) {
    const p = op.payload;
    if (op.kind === 'customer_insert') byId.set(p.id, { ...p.customer, id: p.id });
    else if (op.kind === 'customer_update') { const x = byId.get(p.id); if (x) Object.assign(x, p.patch); }
    else if (op.kind === 'customer_balance') {
      const x = byId.get(p.customerId);
      if (x) x.totalOutstanding = Math.max(0, round2(x.totalOutstanding + p.delta));
    } else if (op.kind === 'sale' && p.input.customerId && p.provisional.udhaarAdded > 0) {
      const x = byId.get(p.input.customerId);
      if (x) x.totalOutstanding = round2(x.totalOutstanding + p.provisional.udhaarAdded);
    }
  }
  return [...byId.values()].filter(c => c.isActive !== false).sort((a, b) => a.name.localeCompare(b.name));
}

const saleToTransaction = (op: OutboxOp): Transaction => {
  const r: SaleResult = op.payload.provisional;
  const input: SaleInput = op.payload.input;
  return {
    id: r.id, billNo: r.billNo, items: r.items, subtotal: r.subtotal, totalGST: r.totalGST,
    grandTotal: r.grandTotal, discountAmount: r.discount, paymentType: input.paymentType,
    paymentSplit: input.paymentType === 'SPLIT' ? input.paymentSplit : undefined,
    customerId: input.customerId ?? undefined, customerName: r.customerName ?? undefined,
    cashierId: input.cashierId, cashierName: input.cashierName, orderType: input.orderType ?? 'in_store',
    timestamp: r.timestamp, isReturn: false,
  };
};

function overlayTransactions(list: Transaction[], ops: OutboxOp[]): Transaction[] {
  const extra: Transaction[] = [];
  for (const op of ops) {
    if (op.kind === 'sale') extra.push(saleToTransaction(op));
    else if (op.kind === 'transaction_insert') extra.push({ ...op.payload.txn, id: op.payload.id });
  }
  const seen = new Set(list.map(t => t.id));
  return [...extra.filter(t => !seen.has(t.id)), ...list]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

function overlaySuppliers(list: Supplier[], ops: OutboxOp[]): Supplier[] {
  const byId = new Map<string, Supplier>(list.map(s => [s.id, { ...s }]));
  for (const op of ops) {
    const p = op.payload;
    if (op.kind === 'supplier_insert') {
      const { openingDue, ...rest } = p.input as SupplierInput;
      byId.set(p.id, { ...rest, id: p.id, totalDue: Math.max(0, openingDue ?? 0), isActive: true, gstNumber: rest.gstNumber ?? null, notes: rest.notes ?? null });
    } else if (op.kind === 'supplier_update') {
      const x = byId.get(p.id);
      if (x) { if (p.archive) x.isActive = false; else Object.assign(x, p.input, { openingDue: undefined }); }
    } else if (op.kind === 'purchase') {
      const x = byId.get(p.purchase.supplierId);
      const r: NewPurchaseResult = p.provisional;
      if (x) x.totalDue = round2(x.totalDue + r.grandTotal - r.amountPaid);
    } else if (op.kind === 'supplier_payment') {
      const x = byId.get(p.opts.supplierId);
      if (x) x.totalDue = Math.max(0, round2(x.totalDue - p.opts.amount));
    }
  }
  return [...byId.values()].filter(s => s.isActive).sort((a, b) => a.name.localeCompare(b.name));
}

const purchaseFromOp = (op: OutboxOp, suppliers: Supplier[]): Purchase => {
  const np: NewPurchase = op.payload.purchase;
  const r: NewPurchaseResult = op.payload.provisional;
  const sub = round2(r.items.reduce((s, i) => s + i.costPrice * i.qty, 0));
  const gst = round2(r.items.reduce((s, i) => s + i.gstAmount, 0));
  return {
    id: r.id, purchaseNo: r.purchaseNo, supplierId: np.supplierId,
    supplierName: suppliers.find(s => s.id === np.supplierId)?.name ?? op.payload.supplierName ?? 'Supplier',
    invoiceNo: np.invoiceNo || null, invoiceDate: np.invoiceDate || todayIST(), items: r.items,
    subtotal: sub, totalGst: gst, otherCharges: np.otherCharges ?? 0, discount: np.discount ?? 0,
    grandTotal: r.grandTotal, amountPaid: r.amountPaid, paymentStatus: r.paymentStatus,
    notes: np.notes ?? null, createdBy: op.payload.createdBy, createdAt: new Date(op.createdAt).toISOString(),
  };
};

const statusOf = (p: Purchase): Purchase['paymentStatus'] =>
  p.amountPaid >= p.grandTotal - 0.009 ? 'paid' : p.amountPaid > 0 ? 'partial' : 'unpaid';

function overlayPurchases(list: Purchase[], ops: OutboxOp[], suppliers: Supplier[]): Purchase[] {
  const all = list.map(p => ({ ...p }));
  for (const op of ops) {
    if (op.kind === 'purchase') all.push(purchaseFromOp(op, suppliers));
    else if (op.kind === 'supplier_payment') {
      const o = op.payload.opts;
      if (o.purchaseId) {
        const x = all.find(p => p.id === o.purchaseId);
        if (x) { x.amountPaid = round2(x.amountPaid + o.amount); x.paymentStatus = statusOf(x); }
      } else {
        let left = o.amount;
        const unpaid = all
          .filter(p => p.supplierId === o.supplierId && p.paymentStatus !== 'paid')
          .sort((a, b) => (a.invoiceDate + (a.createdAt ?? '')).localeCompare(b.invoiceDate + (b.createdAt ?? '')));
        for (const x of unpaid) {
          if (left <= 0.009) break;
          const apply = Math.min(left, round2(x.grandTotal - x.amountPaid));
          x.amountPaid = round2(x.amountPaid + apply);
          x.paymentStatus = statusOf(x);
          left = round2(left - apply);
        }
      }
    }
  }
  return all.sort((a, b) => (b.invoiceDate + (b.createdAt ?? '')).localeCompare(a.invoiceDate + (a.createdAt ?? '')));
}

// ─── Products ────────────────────────────────────────────────────────────────

export const getProducts = async (): Promise<Product[]> =>
  overlayProducts(await cached('products', DB.getProducts, [] as Product[]), await waiting());

export const getProduct = async (id: string): Promise<Product | null> =>
  (await getProducts()).find(p => p.id === id) ?? null;

export const addProduct = async (product: Omit<Product, 'id'>): Promise<string> => {
  if (product.price < 0) throw new Error('Price cannot be negative');
  const id = uuid();
  return sendOrQueue({
    kind: 'product_insert', label: `New item: ${product.name}`, payload: { id, product },
    online: () => DB.addProduct(product, id),
    offline: () => id,
  });
};

export const updateProduct = async (id: string, patch: Partial<Product>): Promise<void> => {
  if (patch.price !== undefined && patch.price < 0) throw new Error('Price cannot be negative');
  if (patch.currentStock !== undefined && patch.currentStock < 0) patch = { ...patch, currentStock: 0 };
  return sendOrQueue({
    kind: 'product_update', label: `Item update${patch.name ? `: ${patch.name}` : ''}`, payload: { id, patch },
    online: () => DB.updateProduct(id, patch),
    offline: () => undefined,
  });
};

export const deleteProduct = (id: string) => updateProduct(id, { isActive: false });

export const decrementStock = async (productId: string, qty: number): Promise<void> => {
  const p = await getProduct(productId);
  if (p) await updateProduct(productId, { currentStock: Math.max(0, p.currentStock - qty) });
};

export const getLowStockProducts = async (): Promise<Product[]> =>
  (await getProducts())
    .filter(p => p.currentStock <= p.minThreshold)
    .sort((a, b) => a.currentStock - b.currentStock || a.name.localeCompare(b.name));

// ─── Customers ───────────────────────────────────────────────────────────────

export const getCustomers = async (): Promise<Customer[]> =>
  overlayCustomers(await cached('customers', DB.getCustomers, [] as Customer[]), await waiting());

export const getCustomer = async (id: string): Promise<Customer | null> => {
  try {
    const c = await DB.getCustomer(id);
    reportOnline(true);
    if (c) return overlayCustomers([c], await waiting())[0] ?? c;
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    reportOnline(false);
  }
  return (await getCustomers()).find(c => c.id === id) ?? null;
};

export const addCustomer = async (customer: Omit<Customer, 'id'>): Promise<string> => {
  const id = uuid();
  return sendOrQueue({
    kind: 'customer_insert', label: `New customer: ${customer.name}`, payload: { id, customer },
    online: () => DB.addCustomer(customer, id),
    offline: () => id,
  });
};

export const updateCustomer = async (id: string, patch: Partial<Customer>): Promise<void> =>
  sendOrQueue({
    kind: 'customer_update', label: `Customer update${patch.name ? `: ${patch.name}` : ''}`, payload: { id, patch },
    online: () => DB.updateCustomer(id, patch),
    offline: () => undefined,
  });

export const updateCustomerBalance = async (customerId: string, delta: number): Promise<void> =>
  sendOrQueue({
    kind: 'customer_balance',
    label: delta < 0 ? `Udhaar payment ₹${Math.abs(delta).toFixed(2)}` : `Udhaar added ₹${delta.toFixed(2)}`,
    payload: { customerId, delta },
    online: ref => DB.updateCustomerBalance(customerId, delta, ref),
    offline: () => undefined,
  });

// ─── Bills ───────────────────────────────────────────────────────────────────

export const getTransactions = async (limit = 50): Promise<Transaction[]> =>
  overlayTransactions(await cached('transactions', () => DB.getTransactions(Math.max(limit, 100)), [] as Transaction[]), await waiting())
    .slice(0, limit);

export const getCustomerTransactions = async (customerId: string): Promise<Transaction[]> =>
  overlayTransactions(
    await cached(`customer_txns:${customerId}`, () => DB.getCustomerTransactions(customerId), [] as Transaction[]),
    (await waiting()).filter(o =>
      (o.kind === 'sale' && o.payload.input.customerId === customerId) ||
      (o.kind === 'transaction_insert' && o.payload.txn.customerId === customerId)),
  );

export const addTransaction = async (txn: Omit<Transaction, 'id'>): Promise<string> => {
  const id = uuid();
  return sendOrQueue({
    kind: 'transaction_insert', label: `Record ${txn.billNo}`, payload: { id, txn },
    online: () => DB.addTransaction(txn, id),
    offline: () => id,
  });
};

export const updateTransaction = (id: string, patch: Partial<Transaction>) => onlineOnly(() => DB.updateTransaction(id, patch));

/** Works out a bill on the device exactly like the create_sale database function. */
const provisionalSale = async (input: SaleInput, id: string): Promise<SaleResult> => {
  const items: TransactionItem[] = input.items.map(i => {
    const price = round2(i.price);
    const line = round2(price * i.qty);
    const gstAmount = round2((line * i.gst) / 100);
    return { productId: i.productId, name: i.name, qty: i.qty, unit: i.unit, price, gst: i.gst, gstAmount, total: round2(line + gstAmount) };
  });
  const subtotal = round2(items.reduce((s, i) => s + round2(i.price * i.qty), 0));
  const totalGST = round2(items.reduce((s, i) => s + i.gstAmount, 0));
  const discount = round2(Math.max(0, input.discount ?? 0));
  const grandTotal = round2(subtotal + totalGST - discount);
  const udhaarAdded = input.paymentType === 'UDHAAR' ? grandTotal
    : input.paymentType === 'SPLIT' ? round2(input.paymentSplit?.udhaar ?? 0) : 0;
  const customer = input.customerId ? (await getCustomers()).find(c => c.id === input.customerId) : undefined;
  const stock = await getProducts();
  return {
    id, billNo: `OFF-${shortCode()}`, items, subtotal, totalGST, discount, grandTotal, udhaarAdded,
    customerName: customer?.name ?? null,
    stockWarnings: input.items
      .map(l => ({ l, p: stock.find(p => p.id === l.productId) }))
      .filter(({ l, p }) => p && p.currentStock < l.qty)
      .map(({ l, p }) => ({ name: p!.name, had: p!.currentStock, sold: l.qty })),
    timestamp: new Date().toISOString(),
    offline: true,
  };
};

const validateSale = (input: SaleInput, grandTotal: number) => {
  if (input.items.length === 0) throw new Error('The bill has no items');
  for (const i of input.items) {
    if (!(i.qty > 0)) throw new Error(`Quantity must be more than 0 for ${i.name}`);
    if (!(i.price >= 0)) throw new Error(`Price cannot be negative for ${i.name}`);
  }
  if (input.paymentType === 'UDHAAR' && !input.customerId) throw new Error('Choose a customer to give Udhaar');
  if (input.paymentType === 'SPLIT') {
    const s = input.paymentSplit ?? { cash: 0, upi: 0, card: 0, udhaar: 0 };
    const sum = round2(s.cash + s.upi + s.card + s.udhaar);
    if (Math.abs(sum - grandTotal) > 0.5) throw new Error(`Split amounts (₹${sum}) must add up to the bill total (₹${grandTotal})`);
    if (s.udhaar > 0 && !input.customerId) throw new Error('Choose a customer to give Udhaar');
  }
};

/** Saves a bill: in the cloud when online (real bill number), else on the device. */
export const createSale = async (input: SaleInput): Promise<SaleResult> => {
  const ref = uuid();
  const provisional = await provisionalSale(input, ref);
  validateSale(input, provisional.grandTotal);
  return sendOrQueue({
    kind: 'sale', ref,
    label: `Bill ${provisional.billNo} · ₹${provisional.grandTotal.toFixed(2)}${provisional.customerName ? ` · ${provisional.customerName}` : ''}`,
    payload: { input, provisional },
    online: r => DB.createSale(input, r),
    offline: () => provisional,
  });
};

// ─── Staff login (works offline after one online login on this device) ──────

const CRED_KEY = 'sms_offline_staff_v1';
const FAIL_KEY = (sid: string) => `sms_offline_login_fail:${sid}`;
interface SavedCred { storeId: string; id: string; name: string; role: StaffRole; hash: string; savedAt: number }
const credHash = (sid: string, id: string, pin: string) => sha256(`sms-offline-v1|${sid}|${id}|${pin}`);

const pinMapLogin = (pin: string, sid: string): StaffLoginResult | null => {
  const entry = PIN_MAP[pin];
  if (!entry) return null;
  return { ok: true, id: `local-${entry.role.toLowerCase()}`, name: entry.name, role: entry.role as StaffRole, storeId: sid };
};

const offlineLogin = async (sid: string, pin: string): Promise<StaffLoginResult> => {
  const creds = ((await kvStore.get<SavedCred[]>(CRED_KEY)) ?? []).filter(c => c.storeId === sid);
  if (creds.length === 0) {
    const local = pinMapLogin(pin, sid);
    if (local) return local;
    return { ok: false, error: 'No internet. Log in once while online on this device, then offline login will work.' };
  }
  const fail = (await kvStore.get<{ count: number; since: number }>(FAIL_KEY(sid))) ?? { count: 0, since: Date.now() };
  if (Date.now() - fail.since > 5 * 60_000) { fail.count = 0; fail.since = Date.now(); }
  if (fail.count >= 5) return { ok: false, error: 'Too many wrong PINs. Wait 5 minutes and try again.', locked: true };

  const match = creds.find(c => c.hash === credHash(sid, c.id, pin));
  if (!match) {
    fail.count += 1;
    await kvStore.set(FAIL_KEY(sid), fail);
    return { ok: false, error: 'Wrong PIN (offline login)', attemptsLeft: Math.max(0, 5 - fail.count) };
  }
  await kvStore.remove(FAIL_KEY(sid));
  return { ok: true, id: match.id, name: match.name, role: match.role, storeId: sid };
};

export const staffLogin = async (sid: string, pin: string): Promise<StaffLoginResult> => {
  try {
    const r = await DB.staffLogin(sid, pin);
    reportOnline(true);
    if (r.ok && r.id && r.role) {
      const creds = ((await kvStore.get<SavedCred[]>(CRED_KEY)) ?? []).filter(c => !(c.storeId === sid && c.id === r.id));
      creds.push({ storeId: sid, id: r.id, name: r.name ?? r.role, role: r.role, hash: credHash(sid, r.id, pin), savedAt: Date.now() });
      await kvStore.set(CRED_KEY, creds);
    }
    if (!r.ok) {
      const local = pinMapLogin(pin, sid);
      if (local) return local;
    }
    return r;
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    reportOnline(false);
    return offlineLogin(sid, pin);
  }
};

export const setStaffPin = async (ownerPin: string, role: StaffRole, newPin: string) => {
  await onlineOnly(() => DB.setStaffPin(ownerPin, role, newPin));
  // Old offline copies of that role's PIN must not keep working.
  const sid = storeId();
  const creds = ((await kvStore.get<SavedCred[]>(CRED_KEY)) ?? []).filter(c => !(c.storeId === sid && c.role === role));
  await kvStore.set(CRED_KEY, creds);
};

// ─── Daily summary ───────────────────────────────────────────────────────────

const summarise = (txns: Transaction[]) => {
  const part = (t: Transaction, key: 'cash' | 'upi' | 'card' | 'udhaar', type: string) =>
    t.paymentType === type ? t.grandTotal : t.paymentType === 'SPLIT' ? Number(t.paymentSplit?.[key] ?? 0) : 0;
  return {
    total_transactions: txns.length,
    total_revenue: round2(txns.reduce((s, t) => s + t.grandTotal, 0)),
    total_gst: round2(txns.reduce((s, t) => s + t.totalGST, 0)),
    cash_sales: round2(txns.reduce((s, t) => s + part(t, 'cash', 'CASH'), 0)),
    upi_sales: round2(txns.reduce((s, t) => s + part(t, 'upi', 'UPI'), 0)),
    card_sales: round2(txns.reduce((s, t) => s + part(t, 'card', 'CARD'), 0)),
    udhaar_sales: round2(txns.reduce((s, t) => s + part(t, 'udhaar', 'UDHAAR'), 0)),
    e_invoice_count: txns.filter(t => t.irn).length,
    permit_count: txns.filter(t => t.ewayBillNo).length,
  };
};

export const getDailySalesSummary = async (date?: string) => {
  const day = date ?? todayIST();
  const queuedToday = (await waiting()).filter(o => o.kind === 'sale').map(saleToTransaction)
    .filter(t => dateIST(t.timestamp) === day);
  try {
    const server = await DB.getDailySalesSummary(day);
    reportOnline(true);
    const extra = summarise(queuedToday);
    const out: Record<string, number> = { ...(server ?? {}) };
    for (const [k, v] of Object.entries(extra)) out[k] = round2(Number(out[k] ?? 0) + v);
    return out;
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    reportOnline(false);
    const all = await getTransactions(500);
    return summarise(all.filter(t => !t.isReturn && dateIST(t.timestamp) === day));
  }
};

// ─── Suppliers ───────────────────────────────────────────────────────────────

const rawSuppliers = () => cached('suppliers', DB.getSuppliers, [] as Supplier[], true);

export const getSuppliers = async (): Promise<Supplier[]> => overlaySuppliers(await rawSuppliers(), await waiting());

export const getSupplier = async (id: string): Promise<Supplier | null> =>
  (await getSuppliers()).find(s => s.id === id) ?? null;

export const addSupplier = async (input: SupplierInput): Promise<Supplier> => {
  const id = uuid();
  const local: Supplier = {
    id, name: input.name.trim(), phone: input.phone, gstNumber: input.gstNumber || null, address: input.address,
    city: input.city, paymentTerms: input.paymentTerms, creditDays: input.creditDays, notes: input.notes || null,
    totalDue: Math.max(0, input.openingDue ?? 0), isActive: true,
  };
  return sendOrQueue({
    kind: 'supplier_insert', label: `New supplier: ${local.name}`, payload: { id, input },
    online: () => DB.addSupplier(input, id),
    offline: () => local,
  });
};

export const updateSupplier = async (id: string, input: SupplierInput): Promise<void> =>
  sendOrQueue({
    kind: 'supplier_update', label: `Supplier update: ${input.name}`, payload: { id, input },
    online: () => DB.updateSupplier(id, input),
    offline: () => undefined,
  });

export const archiveSupplier = async (id: string): Promise<void> =>
  sendOrQueue({
    kind: 'supplier_update', label: 'Remove supplier', payload: { id, archive: true },
    online: () => DB.archiveSupplier(id),
    offline: () => undefined,
  });

// ─── Purchases ───────────────────────────────────────────────────────────────

const allPurchases = async () => {
  const [list, suppliers, ops] = await Promise.all([
    cached('purchases', () => DB.getPurchases({ limit: 500 }), [] as Purchase[], true),
    rawSuppliers(),
    waiting(),
  ]);
  return overlayPurchases(list, ops, overlaySuppliers(suppliers, ops));
};

export const getPurchases = async (f: PurchaseFilter = {}): Promise<Purchase[]> =>
  (await allPurchases()).filter(p =>
    (!f.supplierId || p.supplierId === f.supplierId) &&
    (!f.status || (f.status === 'due' ? p.paymentStatus !== 'paid' : p.paymentStatus === f.status)) &&
    (!f.fromDate || p.invoiceDate >= f.fromDate),
  ).slice(0, f.limit ?? 500);

export const getPurchase = async (id: string): Promise<Purchase | null> =>
  (await allPurchases()).find(p => p.id === id) ?? null;

/** Works out a purchase on the device exactly like the create_purchase database function. */
const provisionalPurchase = (np: NewPurchase, id: string): NewPurchaseResult => {
  const items: PurchaseItem[] = np.items.map(i => {
    const cost = round2(i.costPrice);
    const line = round2(cost * i.qty);
    const gstAmount = round2((line * i.gstPercent) / 100);
    return {
      productId: i.productId ?? '', name: i.name.trim(), qty: i.qty, unit: i.unit, costPrice: cost,
      gstPercent: i.gstPercent, gstAmount, total: round2(line + gstAmount), sellingPrice: i.sellingPrice ?? null,
    };
  });
  const sub = round2(items.reduce((s, i) => s + round2(i.costPrice * i.qty), 0));
  const gst = round2(items.reduce((s, i) => s + i.gstAmount, 0));
  const grandTotal = round2(sub + gst + Math.max(0, np.otherCharges ?? 0) - Math.max(0, np.discount ?? 0));
  if (grandTotal < 0) throw new Error('Discount is more than the purchase total');
  const amountPaid = round2(Math.min(Math.max(0, np.amountPaid ?? 0), grandTotal));
  return {
    id, purchaseNo: `PENDING-${shortCode(4)}`, grandTotal, amountPaid, items, offline: true,
    paymentStatus: amountPaid >= grandTotal ? 'paid' : amountPaid > 0 ? 'partial' : 'unpaid',
  };
};

export const createPurchase = async (np: NewPurchase, createdBy: string): Promise<NewPurchaseResult> => {
  if (np.items.length === 0) throw new Error('Add at least one item to the purchase');
  // New items get their id now, so bills made offline can sell them before sync.
  const purchase: NewPurchase = {
    ...np,
    items: np.items.map(i => (i.productId ? i : { ...i, productId: uuid(), isNew: true })),
  };
  const ref = uuid();
  const provisional = provisionalPurchase(purchase, ref);
  const supplier = (await getSuppliers()).find(s => s.id === np.supplierId);
  if (np.invoiceNo?.trim()) {
    const dup = (await allPurchases()).find(p =>
      p.supplierId === np.supplierId && (p.invoiceNo ?? '').toLowerCase() === np.invoiceNo!.trim().toLowerCase());
    if (dup) throw new Error(`Invoice ${np.invoiceNo} from ${supplier?.name ?? 'this supplier'} is already entered (${dup.purchaseNo})`);
  }
  return sendOrQueue({
    kind: 'purchase', ref,
    label: `Purchase from ${supplier?.name ?? 'supplier'} · ₹${provisional.grandTotal.toFixed(2)}`,
    payload: { purchase, provisional, createdBy, supplierName: supplier?.name },
    online: r => DB.createPurchase(purchase, createdBy, r),
    offline: () => provisional,
  });
};

export const deletePurchase = async (id: string): Promise<void> => {
  const queued = (await getOutbox()).find(o => o.kind === 'purchase' && o.id === id);
  if (queued) {
    const paid = (await waiting()).some(o => o.kind === 'supplier_payment' && o.payload.opts.purchaseId === id);
    if (paid || queued.payload.provisional.amountPaid > 0) throw new Error('This purchase already has payments, so it cannot be deleted');
    return discardOp(id);
  }
  return onlineOnly(() => DB.deletePurchase(id));
};

const rawPayments = () => cached('supplier_payments', () => DB.getSupplierPayments({ limit: 500 }), [] as SupplierPayment[], true);

export const getSupplierPayments = async (opts: { supplierId?: string; purchaseId?: string }): Promise<SupplierPayment[]> => {
  const ops = await waiting();
  const queued: SupplierPayment[] = [];
  for (const op of ops) {
    if (op.kind === 'supplier_payment') {
      const o = op.payload.opts;
      queued.push({ id: op.id, supplierId: o.supplierId, purchaseId: o.purchaseId ?? null, amount: o.amount, mode: o.mode, reference: o.reference ?? null, note: o.note ?? null, paidBy: o.paidBy, paidAt: new Date(op.createdAt).toISOString() });
    } else if (op.kind === 'purchase' && op.payload.provisional.amountPaid > 0) {
      const np: NewPurchase = op.payload.purchase;
      queued.push({ id: `${op.id}-pay`, supplierId: np.supplierId, purchaseId: op.id, amount: op.payload.provisional.amountPaid, mode: np.paymentMode ?? 'CASH', note: 'Paid at purchase', paidBy: op.payload.createdBy, paidAt: new Date(op.createdAt).toISOString() });
    }
  }
  return [...queued, ...(await rawPayments())]
    .filter(p => (!opts.supplierId || p.supplierId === opts.supplierId) && (!opts.purchaseId || p.purchaseId === opts.purchaseId))
    .sort((a, b) => b.paidAt.localeCompare(a.paidAt));
};

export const recordSupplierPayment = async (opts: {
  supplierId: string; amount: number; mode: string; purchaseId?: string | null; reference?: string; note?: string; paidBy: string;
}): Promise<number> => {
  const amount = round2(opts.amount);
  if (!(amount > 0)) throw new Error('Enter an amount more than 0');
  const supplier = (await getSuppliers()).find(s => s.id === opts.supplierId);
  if (!supplier) throw new Error('Supplier not found');
  if (opts.purchaseId) {
    const p = await getPurchase(opts.purchaseId);
    const bal = p ? round2(p.grandTotal - p.amountPaid) : 0;
    if (amount > bal + 0.009) throw new Error(`Only ₹${bal.toFixed(2)} is left to pay on this purchase`);
  } else if (amount > supplier.totalDue + 0.009) {
    throw new Error(`Only ₹${supplier.totalDue.toFixed(2)} is due to ${supplier.name}`);
  }
  const payload = { opts: { ...opts, amount } };
  return sendOrQueue({
    kind: 'supplier_payment', label: `Paid ${supplier.name} ₹${amount.toFixed(2)}`, payload,
    online: ref => DB.recordSupplierPayment(payload.opts, ref),
    offline: () => Math.max(0, round2(supplier.totalDue - amount)),
  });
};

// ─── Sync handlers: how each queued change is sent when back online ─────────

const forStore = (fn: (op: OutboxOp) => Promise<unknown>) => async (op: OutboxOp): Promise<void | 'skip'> => {
  if (op.storeId !== getActiveStoreId()) return 'skip'; // synced when that store logs in
  await fn(op);
};
const ignoreDuplicate = (fn: (op: OutboxOp) => Promise<unknown>) => async (op: OutboxOp) => {
  try { await fn(op); } catch (e) { if (!isDuplicate(e)) throw e; }
};

registerSyncHandler('sale',               forStore(op => DB.createSale(op.payload.input, op.id)));
registerSyncHandler('purchase',           forStore(op => DB.createPurchase(op.payload.purchase, op.payload.createdBy, op.id)));
registerSyncHandler('supplier_payment',   forStore(op => DB.recordSupplierPayment(op.payload.opts, op.id)));
registerSyncHandler('customer_insert',    forStore(ignoreDuplicate(op => DB.addCustomer(op.payload.customer, op.payload.id))));
registerSyncHandler('customer_update',    forStore(op => DB.updateCustomer(op.payload.id, op.payload.patch)));
registerSyncHandler('customer_balance',   forStore(op => DB.updateCustomerBalance(op.payload.customerId, op.payload.delta, op.id)));
registerSyncHandler('product_insert',     forStore(ignoreDuplicate(op => DB.addProduct(op.payload.product, op.payload.id))));
registerSyncHandler('product_update',     forStore(op => DB.updateProduct(op.payload.id, op.payload.patch)));
registerSyncHandler('supplier_insert',    forStore(ignoreDuplicate(op => DB.addSupplier(op.payload.input, op.payload.id))));
registerSyncHandler('supplier_update',    forStore(op => op.payload.archive ? DB.archiveSupplier(op.payload.id) : DB.updateSupplier(op.payload.id, op.payload.input)));
registerSyncHandler('transaction_insert', forStore(ignoreDuplicate(op => DB.addTransaction(op.payload.txn, op.payload.id))));
