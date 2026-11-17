/**
 * Local data service shared by Android and web.
 * Storage is selected by the platform-specific kvStore implementation.
 */
import { kvStore } from '../offline/kvStore';
import { getActiveStoreId } from '../activeStoreId';
import { PIN_MAP } from '../../config/constants';
import { Product } from '../../models/Product';
import { Customer } from '../../models/Customer';
import { Transaction, TransactionItem } from '../../models/Transaction';
import type { StaffRole } from '../../models/Staff';
import type {
    PurchaseFilter, SaleInput, SaleResult, StaffLoginResult,
} from '../database/supabaseDataService';
import type {
    NewPurchase, NewPurchaseItem, NewPurchaseResult, Purchase, PurchaseItem,
    Supplier, SupplierInput, SupplierPayment,
} from '../../models/Supplier';
import { sha256, shortCode } from '../../utils/ids';

const KEYS = {
    PRODUCTS: 'products',
    CUSTOMERS: 'customers',
    TRANSACTIONS: 'transactions',
    SUPPLIERS: 'suppliers',
    PURCHASES: 'purchases',
    SUPPLIER_PAYMENTS: 'supplier_payments',
    STAFF_PINS: 'staff_pins',
    SEEDED: 'seeded',
};

const key = (name: string, storeId = getActiveStoreId()) => `sms_local:${storeId}:${name}`;
const legacyKeys: Record<string, string> = {
    [KEYS.PRODUCTS]: '@familyos_products',
    [KEYS.CUSTOMERS]: '@familyos_customers',
    [KEYS.TRANSACTIONS]: '@familyos_transactions',
    [KEYS.SEEDED]: '@familyos_seeded',
};
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const id = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// ─── Seed Data ────────────────────────────────────────────────────────────────

const SEED_PRODUCTS: Product[] = [
    { id: 'p1', name: 'Basmati Rice', category: 'Grains', price: 150, gstPercent: 5, currentStock: 50, minThreshold: 10, unit: 'kg', imageUrl: '', supplierId: 'sup-1', supplierPhone: '9876543210', purchasePrice: 120, isWeightBased: true, isActive: true },
    { id: 'p2', name: 'Toor Dal', category: 'Pulses', price: 130, gstPercent: 5, currentStock: 30, minThreshold: 8, unit: 'kg', imageUrl: '', supplierId: 'sup-1', supplierPhone: '9876543210', purchasePrice: 100, isWeightBased: true, isActive: true },
    { id: 'p3', name: 'Amul Butter', category: 'Dairy', price: 56, gstPercent: 12, currentStock: 25, minThreshold: 5, unit: 'pcs', imageUrl: '', supplierId: 'sup-2', supplierPhone: '9876543211', purchasePrice: 48, isWeightBased: false, isActive: true },
    { id: 'p4', name: 'Aashirvaad Atta', category: 'Grains', price: 320, gstPercent: 5, currentStock: 15, minThreshold: 5, unit: 'bag', imageUrl: '', supplierId: 'sup-1', supplierPhone: '9876543210', purchasePrice: 280, isWeightBased: false, isActive: true },
    { id: 'p5', name: 'Sugar', category: 'Essentials', price: 45, gstPercent: 5, currentStock: 40, minThreshold: 10, unit: 'kg', imageUrl: '', supplierId: 'sup-3', supplierPhone: '9876543212', purchasePrice: 38, isWeightBased: true, isActive: true },
    { id: 'p6', name: 'Sunflower Oil', category: 'Oils', price: 180, gstPercent: 5, currentStock: 3, minThreshold: 5, unit: 'ltr', imageUrl: '', supplierId: 'sup-3', supplierPhone: '9876543212', purchasePrice: 155, isWeightBased: false, isActive: true },
    { id: 'p7', name: 'Red Chilli Powder', category: 'Spices', price: 220, gstPercent: 12, currentStock: 12, minThreshold: 3, unit: 'kg', imageUrl: '', supplierId: 'sup-4', supplierPhone: '9876543213', purchasePrice: 180, isWeightBased: true, isActive: true },
    { id: 'p8', name: 'Maggi Noodles', category: 'Snacks', price: 14, gstPercent: 18, currentStock: 100, minThreshold: 20, unit: 'pcs', imageUrl: '', supplierId: 'sup-5', supplierPhone: '9876543214', purchasePrice: 11, isWeightBased: false, isActive: true },
    { id: 'p9', name: 'Parle-G Biscuit', category: 'Snacks', price: 10, gstPercent: 18, currentStock: 2, minThreshold: 15, unit: 'pcs', imageUrl: '', supplierId: 'sup-5', supplierPhone: '9876543214', purchasePrice: 8, isWeightBased: false, isActive: true },
    { id: 'p10', name: 'Haldi Powder', category: 'Spices', price: 200, gstPercent: 5, currentStock: 8, minThreshold: 3, unit: 'kg', imageUrl: '', supplierId: 'sup-4', supplierPhone: '9876543213', purchasePrice: 160, isWeightBased: true, isActive: true },
];

const SEED_CUSTOMERS: Customer[] = [
    { id: 'c1', udhaarId: 'UDH-001', name: 'Rajesh Kumar', phone: '9001234567', houseNo: 'H-12', type: 'house', creditLimit: 2000, totalOutstanding: 450, whatsappNumber: '919001234567', firstPurchaseDate: '2025-01-15', slipImages: [], isActive: true },
    { id: 'c2', udhaarId: 'UDH-002', name: 'Priya Sharma', phone: '9001234568', houseNo: 'H-45', type: 'house', creditLimit: 2000, totalOutstanding: 0, whatsappNumber: '919001234568', firstPurchaseDate: '2025-02-10', slipImages: [], isActive: true },
    { id: 'c3', udhaarId: 'UDH-003', name: 'Sai Krishna Store', phone: '9001234569', type: 'small_shop', creditLimit: 5000, totalOutstanding: 1200, whatsappNumber: '919001234569', firstPurchaseDate: '2025-01-01', slipImages: [], isActive: true },
    { id: 'c4', udhaarId: 'UDH-004', name: 'Hotel Spice Garden', phone: '9001234570', type: 'hotel', creditLimit: 10000, totalOutstanding: 3500, whatsappNumber: '919001234570', firstPurchaseDate: '2024-12-01', slipImages: [], isActive: true },
    { id: 'c5', udhaarId: 'UDH-005', name: 'Meena Devi', phone: '9001234571', houseNo: 'H-78', type: 'vip', creditLimit: 5000, totalOutstanding: 200, whatsappNumber: '919001234571', firstPurchaseDate: '2024-11-20', slipImages: [], isActive: true },
];

const SEED_TRANSACTIONS: Transaction[] = [
    {
        id: 't1', billNo: '#9001',
        items: [
            { productId: 'p1', name: 'Basmati Rice', qty: 2, unit: 'kg', price: 150, gst: 5, gstAmount: 15, total: 315 },
            { productId: 'p5', name: 'Sugar', qty: 1, unit: 'kg', price: 45, gst: 5, gstAmount: 2.25, total: 47.25 },
        ],
        subtotal: 345, totalGST: 17.25, grandTotal: 362.25,
        paymentType: 'CASH', customerId: 'c1', cashierId: 'cashier-1',
        timestamp: new Date().toISOString(), isReturn: false,
    },
    {
        id: 't2', billNo: '#9002',
        items: [
            { productId: 'p3', name: 'Amul Butter', qty: 3, unit: 'pcs', price: 56, gst: 12, gstAmount: 20.16, total: 188.16 },
        ],
        subtotal: 168, totalGST: 20.16, grandTotal: 188.16,
        paymentType: 'UPI', customerId: 'c2', cashierId: 'cashier-1',
        timestamp: new Date().toISOString(), isReturn: false,
    },
    {
        id: 't3', billNo: '#9003',
        items: [
            { productId: 'p4', name: 'Aashirvaad Atta', qty: 5, unit: 'bag', price: 320, gst: 5, gstAmount: 80, total: 1680 },
            { productId: 'p6', name: 'Sunflower Oil', qty: 3, unit: 'ltr', price: 180, gst: 5, gstAmount: 27, total: 567 },
        ],
        subtotal: 2140, totalGST: 107, grandTotal: 2247,
        paymentType: 'UDHAAR', customerId: 'c4', cashierId: 'cashier-1',
        timestamp: new Date().toISOString(), isReturn: false,
    },
];

const SEED_SUPPLIERS: Supplier[] = [
    { id: 'sup-1', name: 'Sri Lakshmi Traders', phone: '9876543210', address: 'Main Market', city: 'City Center', paymentTerms: 'credit', creditDays: 30, totalDue: 0, isActive: true },
    { id: 'sup-2', name: 'Fresh Dairy Distributors', phone: '9876543211', address: 'Dairy Road', city: 'City Center', paymentTerms: 'cash', creditDays: 0, totalDue: 0, isActive: true },
    { id: 'sup-3', name: 'Sunrise Essentials', phone: '9876543212', address: 'Wholesale Market', city: 'City Center', paymentTerms: 'credit', creditDays: 15, totalDue: 0, isActive: true },
    { id: 'sup-4', name: 'Spice World', phone: '9876543213', address: 'Spice Market', city: 'City Center', paymentTerms: 'credit', creditDays: 30, totalDue: 0, isActive: true },
    { id: 'sup-5', name: 'Daily Needs Distributors', phone: '9876543214', address: 'North Market', city: 'City Center', paymentTerms: 'cash', creditDays: 0, totalDue: 0, isActive: true },
];

// ─── Init / Seed ──────────────────────────────────────────────────────────────

const seedPromises = new Map<string, Promise<void>>();

const initialTable = async <T>(storeId: string, name: string, seed: T[]): Promise<T[]> => {
    const stored = await kvStore.get<T[]>(key(name, storeId));
    if (Array.isArray(stored)) return stored;

    // On-device Supabase caches are a better starting point than demo data.
    const cached = await kvStore.get<{ data?: T[] }>(`sms_cache:${storeId}:${name}`);
    if (Array.isArray(cached?.data)) {
        await kvStore.set(key(name, storeId), cached.data);
        return cached.data;
    }

    // Keep data from earlier local-mode installs on the main store.
    const legacyKey = storeId === 'sms' ? legacyKeys[name] : undefined;
    const legacy = legacyKey ? await kvStore.get<T[]>(legacyKey) : null;
    const data = Array.isArray(legacy) ? legacy : seed;
    await kvStore.set(key(name, storeId), data);
    return data;
};

const seedForStore = async (storeId: string): Promise<void> => {
    if (await kvStore.get<boolean>(key(KEYS.SEEDED, storeId))) return;
    await initialTable(storeId, KEYS.PRODUCTS, SEED_PRODUCTS);
    await initialTable(storeId, KEYS.CUSTOMERS, SEED_CUSTOMERS);
    await initialTable(storeId, KEYS.TRANSACTIONS, SEED_TRANSACTIONS);
    await initialTable(storeId, KEYS.SUPPLIERS, SEED_SUPPLIERS);
    await initialTable<Purchase>(storeId, KEYS.PURCHASES, []);
    await initialTable<SupplierPayment>(storeId, KEYS.SUPPLIER_PAYMENTS, []);
    await kvStore.set(key(KEYS.SEEDED, storeId), true);
};

export const seedDataIfNeeded = async (): Promise<void> => {
    const storeId = getActiveStoreId();
    const existing = seedPromises.get(storeId);
    if (existing) return existing;
    const pending = seedForStore(storeId).finally(() => seedPromises.delete(storeId));
    seedPromises.set(storeId, pending);
    return pending;
};

// ─── Generic helpers ──────────────────────────────────────────────────────────

const getAll = async <T>(name: string): Promise<T[]> => {
    await seedDataIfNeeded();
    return (await kvStore.get<T[]>(key(name))) ?? [];
};

const saveAll = async <T>(name: string, data: T[]): Promise<void> => {
    await kvStore.set(key(name), data);
};

const genId = id;

// ─── Staff PINs ───────────────────────────────────────────────────────────────

interface LocalPinRecord { id: string; name: string; role: StaffRole; hash: string }
const pinHash = (storeId: string, role: StaffRole, pin: string) => sha256(`sms-local-v1|${storeId}|${role}|${pin}`);
const failKey = (storeId: string) => `sms_local:${storeId}:login_fail`;

const getPinRecords = async (storeId = getActiveStoreId()): Promise<LocalPinRecord[]> => {
    const saved = await kvStore.get<LocalPinRecord[]>(key(KEYS.STAFF_PINS, storeId));
    if (Array.isArray(saved)) return saved;
    const defaults = Object.entries(PIN_MAP).map(([pin, entry]) => {
        const role = entry.role as StaffRole;
        return { id: `local-${role.toLowerCase()}`, name: entry.name, role, hash: pinHash(storeId, role, pin) };
    });
    await kvStore.set(key(KEYS.STAFF_PINS, storeId), defaults);
    return defaults;
};

export const staffLogin = async (storeId: string, pin: string): Promise<StaffLoginResult> => {
    const fail = (await kvStore.get<{ count: number; since: number }>(failKey(storeId))) ?? { count: 0, since: Date.now() };
    if (Date.now() - fail.since > 5 * 60_000) { fail.count = 0; fail.since = Date.now(); }
    if (fail.count >= 5) return { ok: false, error: 'Too many wrong PINs. Wait 5 minutes and try again.', locked: true };

    const match = (await getPinRecords(storeId)).find(record => record.hash === pinHash(storeId, record.role, pin));
    if (!match) {
        fail.count += 1;
        await kvStore.set(failKey(storeId), fail);
        return { ok: false, error: 'Wrong PIN', attemptsLeft: Math.max(0, 5 - fail.count) };
    }
    await kvStore.remove(failKey(storeId));
    return { ok: true, id: match.id, name: match.name, role: match.role, storeId };
};

export const setStaffPin = async (ownerPin: string, role: StaffRole, newPin: string): Promise<void> => {
    if (!/^\d{4,8}$/.test(newPin)) throw new Error('PIN must contain 4 to 8 digits');
    const storeId = getActiveStoreId();
    const records = await getPinRecords(storeId);
    const owner = records.find(record => record.role === 'OWNER');
    if (!owner || owner.hash !== pinHash(storeId, 'OWNER', ownerPin)) throw new Error('Owner PIN is incorrect');
    if (!records.some(record => record.role === role)) throw new Error('Staff role not found');
    if (records.some(record => record.role !== role && record.hash === pinHash(storeId, record.role, newPin))) {
        throw new Error('That PIN is already assigned to another role');
    }
    const selected = records.find(record => record.role === role)!;
    selected.hash = pinHash(storeId, role, newPin);
    await kvStore.set(key(KEYS.STAFF_PINS, storeId), records);
};

// ─── Products ─────────────────────────────────────────────────────────────────

export const getProducts = async (): Promise<Product[]> => {
    await seedDataIfNeeded();
    return getAll<Product>(KEYS.PRODUCTS);
};

export const addProduct = async (product: Omit<Product, 'id'>): Promise<string> => {
    const products = await getAll<Product>(KEYS.PRODUCTS);
    const id = genId();
    products.push({ ...product, id } as Product);
    await saveAll(KEYS.PRODUCTS, products);
    return id;
};

export const updateProduct = async (id: string, data: Partial<Product>): Promise<void> => {
    // Security: Validate inputs at data layer
    if (data.price !== undefined && data.price < 0) {
        throw new Error('Price cannot be negative');
    }
    if (data.currentStock !== undefined && data.currentStock < 0) {
        data.currentStock = 0; // Clamp to 0
    }
    
    const products = await getAll<Product>(KEYS.PRODUCTS);
    const idx = products.findIndex(p => p.id === id);
    if (idx >= 0) {
        products[idx] = { ...products[idx], ...data };
        await saveAll(KEYS.PRODUCTS, products);
    }
};

export const updateStock = async (id: string, newStock: number): Promise<void> => {
    const safeStock = isNaN(newStock) ? 0 : Math.max(0, newStock);
    await updateProduct(id, { currentStock: safeStock });
};

export const deleteProduct = async (id: string): Promise<void> => {
    const products = await getAll<Product>(KEYS.PRODUCTS);
    await saveAll(KEYS.PRODUCTS, products.filter(p => p.id !== id));
};

// ─── Customers ────────────────────────────────────────────────────────────────

export const getCustomers = async (): Promise<Customer[]> => {
    await seedDataIfNeeded();
    return getAll<Customer>(KEYS.CUSTOMERS);
};

export const getCustomer = async (id: string): Promise<Customer | null> => {
    const customers = await getAll<Customer>(KEYS.CUSTOMERS);
    return customers.find(c => c.id === id) || null;
};

export const addCustomer = async (customer: Omit<Customer, 'id'>): Promise<string> => {
    const customers = await getAll<Customer>(KEYS.CUSTOMERS);
    const id = genId();
    customers.push({ ...customer, id } as Customer);
    await saveAll(KEYS.CUSTOMERS, customers);
    return id;
};

export const updateCustomer = async (id: string, data: Partial<Customer>): Promise<void> => {
    const customers = await getAll<Customer>(KEYS.CUSTOMERS);
    const idx = customers.findIndex(c => c.id === id);
    if (idx >= 0) {
        customers[idx] = { ...customers[idx], ...data };
        await saveAll(KEYS.CUSTOMERS, customers);
    }
};

export const updateCustomerBalance = async (customerId: string, amountDelta: number): Promise<void> => {
    const customers = await getAll<Customer>(KEYS.CUSTOMERS);
    const idx = customers.findIndex(c => c.id === customerId);
    if (idx >= 0) {
        // Clamp to 0 — outstanding balance cannot go negative
        customers[idx].totalOutstanding = Math.max(0, customers[idx].totalOutstanding + amountDelta);
        await saveAll(KEYS.CUSTOMERS, customers);
    }
};

// ─── Transactions ─────────────────────────────────────────────────────────────

export const addTransaction = async (txn: Omit<Transaction, 'id'>): Promise<string> => {
    const transactions = await getAll<Transaction>(KEYS.TRANSACTIONS);
    const id = genId();
    transactions.unshift({ ...txn, id } as Transaction);
    await saveAll(KEYS.TRANSACTIONS, transactions);
    return id;
};

export const getTransactions = async (limit = 50): Promise<Transaction[]> => {
    await seedDataIfNeeded();
    const txns = await getAll<Transaction>(KEYS.TRANSACTIONS);
    return txns.slice(0, limit);
};

export const getCustomerTransactions = async (customerId: string): Promise<Transaction[]> => {
    const txns = await getAll<Transaction>(KEYS.TRANSACTIONS);
    return txns.filter(t => t.customerId === customerId);
};

// ─── Suppliers and purchases ─────────────────────────────────────────────────

export const getSuppliers = async (): Promise<Supplier[]> =>
    (await getAll<Supplier>(KEYS.SUPPLIERS)).filter(s => s.isActive !== false).sort((a, b) => a.name.localeCompare(b.name));

export const getSupplier = async (supplierId: string): Promise<Supplier | null> =>
    (await getAll<Supplier>(KEYS.SUPPLIERS)).find(s => s.id === supplierId) ?? null;

export const addSupplier = async (input: SupplierInput): Promise<Supplier> => {
    const supplier: Supplier = {
        id: genId(), name: input.name.trim(), phone: input.phone.trim(), gstNumber: input.gstNumber || null,
        address: input.address, city: input.city, paymentTerms: input.paymentTerms, creditDays: input.creditDays,
        totalDue: round2(Math.max(0, input.openingDue ?? 0)), notes: input.notes || null, isActive: true,
        createdAt: new Date().toISOString(),
    };
    const suppliers = await getAll<Supplier>(KEYS.SUPPLIERS);
    suppliers.push(supplier);
    await saveAll(KEYS.SUPPLIERS, suppliers);
    return supplier;
};

export const updateSupplier = async (supplierId: string, input: SupplierInput): Promise<void> => {
    const suppliers = await getAll<Supplier>(KEYS.SUPPLIERS);
    const index = suppliers.findIndex(s => s.id === supplierId);
    if (index < 0) throw new Error('Supplier not found');
    suppliers[index] = {
        ...suppliers[index], name: input.name.trim(), phone: input.phone.trim(), gstNumber: input.gstNumber || null,
        address: input.address, city: input.city, paymentTerms: input.paymentTerms, creditDays: input.creditDays,
        notes: input.notes || null, updatedAt: new Date().toISOString(),
    };
    await saveAll(KEYS.SUPPLIERS, suppliers);
};

export const archiveSupplier = async (supplierId: string): Promise<void> => {
    const suppliers = await getAll<Supplier>(KEYS.SUPPLIERS);
    const supplier = suppliers.find(s => s.id === supplierId);
    if (supplier) { supplier.isActive = false; await saveAll(KEYS.SUPPLIERS, suppliers); }
};

export const getPurchases = async (filter: PurchaseFilter = {}): Promise<Purchase[]> => {
    const purchases = (await getAll<Purchase>(KEYS.PURCHASES)).filter(p =>
        (!filter.supplierId || p.supplierId === filter.supplierId) &&
        (!filter.status || (filter.status === 'due' ? p.paymentStatus !== 'paid' : p.paymentStatus === filter.status)) &&
        (!filter.fromDate || p.invoiceDate >= filter.fromDate),
    );
    purchases.sort((a, b) => (b.invoiceDate + (b.createdAt ?? '')).localeCompare(a.invoiceDate + (a.createdAt ?? '')));
    return purchases.slice(0, filter.limit ?? 500);
};

export const getPurchase = async (purchaseId: string): Promise<Purchase | null> =>
    (await getAll<Purchase>(KEYS.PURCHASES)).find(p => p.id === purchaseId) ?? null;

export const createPurchase = async (input: NewPurchase, createdBy: string): Promise<NewPurchaseResult> => {
    if (!input.items.length) throw new Error('Add at least one item to the purchase');
    const suppliers = await getAll<Supplier>(KEYS.SUPPLIERS);
    const supplier = suppliers.find(s => s.id === input.supplierId && s.isActive !== false);
    if (!supplier) throw new Error('Supplier not found');
    const purchases = await getAll<Purchase>(KEYS.PURCHASES);
    const invoiceNo = input.invoiceNo?.trim();
    if (invoiceNo && purchases.some(p => p.supplierId === supplier.id && (p.invoiceNo ?? '').trim().toLowerCase() === invoiceNo.toLowerCase())) {
        throw new Error(`Invoice ${invoiceNo} from ${supplier.name} is already entered`);
    }

    const products = await getAll<Product>(KEYS.PRODUCTS);
    const now = new Date().toISOString();
    const purchaseItems: PurchaseItem[] = input.items.map(item => {
        if (!(item.qty > 0) || !(item.costPrice >= 0)) throw new Error(`Check quantity and cost for ${item.name || 'item'}`);
        const matchedByName = !item.productId
            ? products.find(p => p.name.trim().toLowerCase() === item.name.trim().toLowerCase())
            : undefined;
        const productId = item.productId || matchedByName?.id || genId();
        const costPrice = round2(item.costPrice);
        const line = round2(costPrice * item.qty);
        const gstAmount = round2(line * item.gstPercent / 100);
        return {
            productId, name: item.name.trim(), qty: item.qty, unit: item.unit, costPrice,
            gstPercent: item.gstPercent, gstAmount, total: round2(line + gstAmount), sellingPrice: item.sellingPrice ?? null,
        };
    });
    if (purchaseItems.some(item => !item.name)) throw new Error('Every item needs a name');

    for (let i = 0; i < purchaseItems.length; i++) {
        const purchased = purchaseItems[i];
        const inputItem = input.items[i];
        const existing = products.find(p => p.id === purchased.productId);
        if (existing) {
            existing.currentStock = round2(existing.currentStock + purchased.qty);
            existing.purchasePrice = purchased.costPrice;
            existing.gstPercent = purchased.gstPercent as Product['gstPercent'];
            existing.supplierId = supplier.id;
            existing.supplierPhone = supplier.phone;
            if (purchased.sellingPrice != null) existing.price = purchased.sellingPrice;
        } else {
            products.push({
                id: purchased.productId, name: purchased.name, category: inputItem.category ?? '', imageUrl: '',
                price: purchased.sellingPrice ?? purchased.costPrice, gstPercent: purchased.gstPercent as Product['gstPercent'],
                currentStock: purchased.qty, minThreshold: 0, unit: purchased.unit, supplierId: supplier.id,
                supplierPhone: supplier.phone, purchasePrice: purchased.costPrice,
                isWeightBased: ['kg', 'g', 'ltr', 'ml'].includes(purchased.unit), isActive: true,
            });
        }
    }

    const subtotal = round2(purchaseItems.reduce((sum, item) => sum + round2(item.costPrice * item.qty), 0));
    const totalGst = round2(purchaseItems.reduce((sum, item) => sum + item.gstAmount, 0));
    const otherCharges = round2(Math.max(0, input.otherCharges ?? 0));
    const discount = round2(Math.max(0, input.discount ?? 0));
    const grandTotal = round2(subtotal + totalGst + otherCharges - discount);
    if (grandTotal < 0) throw new Error('Discount is more than the purchase total');
    const amountPaid = round2(Math.min(Math.max(0, input.amountPaid ?? 0), grandTotal));
    const paymentStatus = amountPaid >= grandTotal ? 'paid' : amountPaid > 0 ? 'partial' : 'unpaid';
    const purchaseId = genId();
    const purchase: Purchase = {
        id: purchaseId, purchaseNo: `PUR-${shortCode(6)}`, supplierId: supplier.id, supplierName: supplier.name,
        invoiceNo: invoiceNo || null, invoiceDate: input.invoiceDate || today(), items: purchaseItems,
        subtotal, totalGst, otherCharges, discount, grandTotal, amountPaid, paymentStatus,
        notes: input.notes || null, createdBy, createdAt: now,
    };

    supplier.totalDue = round2(Math.max(0, supplier.totalDue + grandTotal - amountPaid));
    purchases.unshift(purchase);
    await Promise.all([
        saveAll(KEYS.PRODUCTS, products), saveAll(KEYS.SUPPLIERS, suppliers), saveAll(KEYS.PURCHASES, purchases),
    ]);
    if (amountPaid > 0) {
        const payments = await getAll<SupplierPayment>(KEYS.SUPPLIER_PAYMENTS);
        payments.unshift({
            id: genId(), supplierId: supplier.id, purchaseId, amount: amountPaid,
            mode: input.paymentMode ?? 'CASH', note: 'Paid at purchase', paidBy: createdBy, paidAt: now,
        });
        await saveAll(KEYS.SUPPLIER_PAYMENTS, payments);
    }
    return { id: purchaseId, purchaseNo: purchase.purchaseNo, grandTotal, amountPaid, paymentStatus, items: purchaseItems };
};

export const deletePurchase = async (purchaseId: string): Promise<void> => {
    const purchases = await getAll<Purchase>(KEYS.PURCHASES);
    const purchase = purchases.find(p => p.id === purchaseId);
    if (!purchase) throw new Error('Purchase not found');
    if (purchase.amountPaid > 0 || purchase.paymentStatus !== 'unpaid') throw new Error('This purchase already has payments, so it cannot be deleted');
    const products = await getAll<Product>(KEYS.PRODUCTS);
    for (const item of purchase.items) {
        const product = products.find(p => p.id === item.productId);
        if (product) product.currentStock = Math.max(0, round2(product.currentStock - item.qty));
    }
    const suppliers = await getAll<Supplier>(KEYS.SUPPLIERS);
    const supplier = suppliers.find(s => s.id === purchase.supplierId);
    if (supplier) supplier.totalDue = Math.max(0, round2(supplier.totalDue - purchase.grandTotal));
    await Promise.all([
        saveAll(KEYS.PRODUCTS, products), saveAll(KEYS.SUPPLIERS, suppliers),
        saveAll(KEYS.PURCHASES, purchases.filter(p => p.id !== purchaseId)),
    ]);
};

export const getSupplierPayments = async (opts: { supplierId?: string; purchaseId?: string; limit?: number }): Promise<SupplierPayment[]> => {
    const payments = (await getAll<SupplierPayment>(KEYS.SUPPLIER_PAYMENTS))
        .filter(p => (!opts.supplierId || p.supplierId === opts.supplierId) && (!opts.purchaseId || p.purchaseId === opts.purchaseId))
        .sort((a, b) => b.paidAt.localeCompare(a.paidAt));
    return payments.slice(0, opts.limit ?? 500);
};

export const recordSupplierPayment = async (opts: {
    supplierId: string; amount: number; mode: string; purchaseId?: string | null;
    reference?: string; note?: string; paidBy: string;
}): Promise<number> => {
    const amount = round2(opts.amount);
    if (!(amount > 0)) throw new Error('Enter an amount more than 0');
    const suppliers = await getAll<Supplier>(KEYS.SUPPLIERS);
    const supplier = suppliers.find(s => s.id === opts.supplierId);
    if (!supplier) throw new Error('Supplier not found');
    const purchases = await getAll<Purchase>(KEYS.PURCHASES);
    if (amount > supplier.totalDue + 0.009) throw new Error(`Only ₹${supplier.totalDue.toFixed(2)} is due to ${supplier.name}`);

    if (opts.purchaseId) {
        const purchase = purchases.find(p => p.id === opts.purchaseId && p.supplierId === supplier.id);
        if (!purchase) throw new Error('Purchase not found');
        const balance = round2(purchase.grandTotal - purchase.amountPaid);
        if (amount > balance + 0.009) throw new Error(`Only ₹${balance.toFixed(2)} is left to pay on this purchase`);
        purchase.amountPaid = round2(purchase.amountPaid + amount);
        purchase.paymentStatus = purchase.amountPaid >= purchase.grandTotal - 0.009 ? 'paid' : 'partial';
    } else {
        let left = amount;
        const unpaid = purchases.filter(p => p.supplierId === supplier.id && p.paymentStatus !== 'paid')
            .sort((a, b) => (a.invoiceDate + (a.createdAt ?? '')).localeCompare(b.invoiceDate + (b.createdAt ?? '')));
        for (const purchase of unpaid) {
            if (left <= 0.009) break;
            const apply = Math.min(left, round2(purchase.grandTotal - purchase.amountPaid));
            purchase.amountPaid = round2(purchase.amountPaid + apply);
            purchase.paymentStatus = purchase.amountPaid >= purchase.grandTotal - 0.009 ? 'paid' : 'partial';
            left = round2(left - apply);
        }
    }
    supplier.totalDue = Math.max(0, round2(supplier.totalDue - amount));
    const payments = await getAll<SupplierPayment>(KEYS.SUPPLIER_PAYMENTS);
    payments.unshift({
        id: genId(), supplierId: supplier.id, purchaseId: opts.purchaseId ?? null, amount,
        mode: opts.mode, reference: opts.reference || null, note: opts.note || null,
        paidBy: opts.paidBy, paidAt: new Date().toISOString(),
    });
    await Promise.all([
        saveAll(KEYS.PURCHASES, purchases), saveAll(KEYS.SUPPLIERS, suppliers), saveAll(KEYS.SUPPLIER_PAYMENTS, payments),
    ]);
    return supplier.totalDue;
};

// ─── Daily sales summary ──────────────────────────────────────────────────────

export const getDailySalesSummary = async (date?: string) => {
    const targetDate = date ?? today();
    const todays = (await getAll<Transaction>(KEYS.TRANSACTIONS)).filter(t =>
        !t.isReturn && new Date(t.timestamp).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) === targetDate,
    );
    const part = (t: Transaction, key: 'cash' | 'upi' | 'card' | 'udhaar', type: string) =>
        t.paymentType === type ? t.grandTotal : t.paymentType === 'SPLIT' ? Number(t.paymentSplit?.[key] ?? 0) : 0;
    return {
        total_transactions: todays.length,
        total_revenue: round2(todays.reduce((sum, t) => sum + t.grandTotal, 0)),
        total_gst: round2(todays.reduce((sum, t) => sum + t.totalGST, 0)),
        cash_sales: round2(todays.reduce((sum, t) => sum + part(t, 'cash', 'CASH'), 0)),
        upi_sales: round2(todays.reduce((sum, t) => sum + part(t, 'upi', 'UPI'), 0)),
        card_sales: round2(todays.reduce((sum, t) => sum + part(t, 'card', 'CARD'), 0)),
        udhaar_sales: round2(todays.reduce((sum, t) => sum + part(t, 'udhaar', 'UDHAAR'), 0)),
        e_invoice_count: todays.filter(t => t.irn).length,
        permit_count: todays.filter(t => t.ewayBillNo).length,
    };
};
