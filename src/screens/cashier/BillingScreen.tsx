/**
 * BillingScreen.tsx — Full-featured billing screen with tablet-friendly layout.
 *
 * On wide screens (≥768px): side-by-side — products on the left, cart on the right.
 * On narrow screens: vertical scroll — products, then cart below.
 *
 * Features:
 *  - Product grid with search and barcode scan
 *  - Cart with per-item GST breakdown, editable qty
 *  - Customer selector (for Udhaar / Split / wholesale pricing)
 *  - Payment: Cash / UPI / Card / Udhaar / Split (amount entry per method)
 *  - Discount (₹ or %)
 *  - Atomic checkout via createSale (online or offline queue)
 *  - Receipt modal with offline/provisional notice, WhatsApp share
 *  - Accepts route params: importedItems (from slip scan), voiceCommand, items
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, Alert, ActivityIndicator, Modal, ScrollView,
  Platform, Dimensions, KeyboardAvoidingView, Share,
} from 'react-native';
import {
  getProducts, getCustomers, createSale,
} from '../../services/firebase/firestoreService';
import type { SaleInput, SaleResult } from '../../services/firebase/firestoreService';
import type { Product } from '../../models/Product';
import type { Customer } from '../../models/Customer';
import type { TransactionItem, PaymentType, OrderType } from '../../models/Transaction';
import { useSession } from '../../context/SessionContext';
import { useStore } from '../../context/StoreContext';
import UpiQrModal from '../../components/UpiQrModal';
import { buildBillMessage } from '../../services/whatsapp/whatsappService';

// ─── Types ───────────────────────────────────────────────────────────────────

interface CartItem extends TransactionItem { productId: string; stock: number }

interface RouteParams {
  importedItems?: { productId: string; name: string; qty: number; unit: string; price: number; gst: number }[];
  items?: { productId: string; name: string; qty: number; unit: string; price: number; gst: number }[];
  voiceCommand?: string;
}

type SplitAmounts = { cash: number; upi: number; card: number; udhaar: number };

// ─── Helpers ─────────────────────────────────────────────────────────────────

const round2 = (n: number) => Math.round(n * 100) / 100;
const WIDE_BREAKPOINT = 768;

const PAYMENT_METHODS: { key: PaymentType; label: string; icon: string }[] = [
  { key: 'CASH',   label: 'Cash',   icon: '💵' },
  { key: 'UPI',    label: 'UPI',    icon: '📱' },
  { key: 'CARD',   label: 'Card',   icon: '💳' },
  { key: 'UDHAAR', label: 'Udhaar', icon: '📒' },
  { key: 'SPLIT',  label: 'Split',  icon: '➗' },
];

const ORDER_TYPES: { key: OrderType; label: string }[] = [
  { key: 'in_store',  label: 'In-store' },
  { key: 'takeaway',  label: 'Takeaway' },
  { key: 'delivery',  label: 'Delivery' },
  { key: 'wholesale', label: 'Wholesale' },
];

const lineGST = (price: number, qty: number, gst: number) => round2((price * qty * gst) / 100);
const lineTotal = (price: number, qty: number, gst: number) => round2(price * qty + lineGST(price, qty, gst));

/** Hook to get current window width, responsive to resizing */
function useWindowWidth() {
  const [w, setW] = useState(Dimensions.get('window').width);
  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => setW(window.width));
    return () => sub?.remove?.();
  }, []);
  return w;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const BillingScreen: React.FC<{ route?: { params?: RouteParams }; navigation?: any }> = ({ route, navigation }) => {
  const { staff } = useSession();
  const { activeStore } = useStore();
  const windowWidth = useWindowWidth();
  const isWide = windowWidth >= WIDE_BREAKPOINT;

  // ── State ──────────────────────────────────────────────────────────────────
  const [products, setProducts]               = useState<Product[]>([]);
  const [customers, setCustomers]             = useState<Customer[]>([]);
  const [cart, setCart]                        = useState<CartItem[]>([]);
  const [search, setSearch]                   = useState('');
  const [payment, setPayment]                 = useState<PaymentType>('CASH');
  const [orderType, setOrderType]             = useState<OrderType>('in_store');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch]   = useState('');
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [billerName, setBillerName]               = useState(staff?.name ?? 'Staff');
  const [showBillerPicker, setShowBillerPicker]   = useState(false);
  const [showUpiQr, setShowUpiQr]                 = useState(false);
  const [discountText, setDiscountText]       = useState('');
  const [discountIsPercent, setDiscountIsPercent] = useState(false);
  const [splitText, setSplitText]             = useState<Record<keyof SplitAmounts, string>>({ cash: '', upi: '', card: '', udhaar: '' });
  const split: SplitAmounts = {
    cash: parseFloat(splitText.cash) || 0,
    upi: parseFloat(splitText.upi) || 0,
    card: parseFloat(splitText.card) || 0,
    udhaar: parseFloat(splitText.udhaar) || 0,
  };
  const [loading, setLoading]                 = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [receipt, setReceipt]                 = useState<SaleResult | null>(null);
  const [showReceipt, setShowReceipt]         = useState(false);
  const paramsApplied = useRef(false);
  const draftBillNo = useRef(`DRAFT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`);

  useEffect(() => {
    if (billerName === 'Staff' && staff?.name) setBillerName(staff.name);
  }, [staff?.name, billerName]);

  // ── Load data ──────────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([getProducts(), getCustomers()])
      .then(([p, c]) => { setProducts(p); setCustomers(c); })
      .finally(() => setLoadingProducts(false));
  }, []);

  // Apply imported items from route params (once)
  useEffect(() => {
    if (paramsApplied.current || !products.length) return;
    const params = route?.params;
    if (!params) return;
    paramsApplied.current = true;
    const incoming = params.importedItems ?? params.items;
    if (incoming && incoming.length > 0) {
      const newCart: CartItem[] = incoming.map(i => {
        const p = products.find(x => x.id === i.productId);
        const price = p ? p.price : i.price;
        const gst = p ? p.gstPercent : (i.gst ?? 0);
        const qty = i.qty || 1;
        return {
          productId: i.productId, name: p?.name ?? i.name, qty, unit: p?.unit ?? i.unit ?? 'pcs',
          price, gst, gstAmount: lineGST(price, qty, gst), total: lineTotal(price, qty, gst),
          stock: p?.currentStock ?? 999,
        };
      });
      setCart(newCart);
    }
    if (params.voiceCommand) {
      const spoken = params.voiceCommand.toLowerCase();
      const qty = Number(spoken.match(/\b\d+(?:\.\d+)?\b/)?.[0] ?? 1) || 1;
      const query = spoken
        .replace(/\b(add|select|choose|please|put|in|cart|of)\b/g, ' ')
        .replace(/\b\d+(?:\.\d+)?\b/g, ' ')
        .replace(/\b(kg|kgs|g|gm|gram|grams|ltr|litre|liter|ml|pcs|pieces|piece|dozen|bag|box|packet)\b/g, ' ')
        .replace(/\s+/g, ' ').trim();
      const exact = query ? products.find(p => query.includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(query)) : undefined;
      const queryTokens = query.split(/\s+/).filter(token => token.length > 1);
      const best = exact ?? products
        .map(product => {
          const productTokens = product.name.toLowerCase().split(/[^a-z0-9]+/).filter(token => token.length > 1);
          const overlap = queryTokens.filter(token => productTokens.some(nameToken => nameToken.includes(token) || token.includes(nameToken))).length;
          return { product, score: overlap / Math.max(1, productTokens.length) };
        })
        .filter(entry => entry.score > 0)
        .sort((a, b) => b.score - a.score)[0]?.product;
      if (best && !incoming?.length) {
        setCart([{
          productId: best.id, name: best.name, qty, unit: best.unit,
          price: best.price, gst: best.gstPercent,
          gstAmount: lineGST(best.price, qty, best.gstPercent),
          total: lineTotal(best.price, qty, best.gstPercent),
          stock: best.currentStock,
        }]);
      }
    }
  }, [products, route?.params]);

  // ── Computed ────────────────────────────────────────────────────────────────
  const filtered = useMemo(() =>
    products.filter(p => p.isActive !== false && p.name.toLowerCase().includes(search.toLowerCase())),
  [products, search]);

  const filteredCustomers = useMemo(() =>
    customers.filter(c =>
      c.isActive !== false &&
      (c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
       c.phone.includes(customerSearch))),
  [customers, customerSearch]);

  const discountAmount = useMemo(() => {
    const val = parseFloat(discountText) || 0;
    if (val <= 0) return 0;
    const sub = cart.reduce((s, i) => s + i.price * i.qty, 0);
    const gst = cart.reduce((s, i) => s + i.gstAmount, 0);
    const raw = sub + gst;
    if (discountIsPercent) return round2(Math.min(raw, (raw * val) / 100));
    return round2(Math.min(raw, val));
  }, [cart, discountText, discountIsPercent]);

  const totals = useMemo(() => {
    const subtotal   = round2(cart.reduce((s, i) => s + i.price * i.qty, 0));
    const totalGST   = round2(cart.reduce((s, i) => s + i.gstAmount, 0));
    const grandTotal = round2(Math.max(0, subtotal + totalGST - discountAmount));
    return { subtotal, totalGST, grandTotal };
  }, [cart, discountAmount]);

  // ── Cart operations ────────────────────────────────────────────────────────
  const addToCart = useCallback((product: Product) => {
    setCart(prev => {
      const idx = prev.findIndex(i => i.productId === product.id);
      if (idx >= 0) {
        const updated = [...prev];
        const item = updated[idx];
        const newQty = item.qty + 1;
        updated[idx] = {
          ...item, qty: newQty,
          gstAmount: lineGST(item.price, newQty, item.gst),
          total: lineTotal(item.price, newQty, item.gst),
        };
        return updated;
      }
      return [...prev, {
        productId: product.id, name: product.name, qty: 1, unit: product.unit,
        price: product.price, gst: product.gstPercent,
        gstAmount: lineGST(product.price, 1, product.gstPercent),
        total: lineTotal(product.price, 1, product.gstPercent),
        stock: product.currentStock,
      }];
    });
  }, []);

  const updateQty = useCallback((productId: string, delta: number) => {
    setCart(prev =>
      prev
        .map(item => {
          if (item.productId !== productId) return item;
          const newQty = Math.max(0, item.qty + delta);
          if (newQty === 0) return null as unknown as CartItem;
          return {
            ...item, qty: newQty,
            gstAmount: lineGST(item.price, newQty, item.gst),
            total: lineTotal(item.price, newQty, item.gst),
          };
        })
        .filter(Boolean),
    );
  }, []);

  const clearCart = useCallback(() => {
    setCart([]); setSearch(''); setDiscountText(''); setSelectedCustomer(null);
    setPayment('CASH'); setOrderType('in_store');
    setSplitText({ cash: '', upi: '', card: '', udhaar: '' });
  }, []);

  // ── Checkout ───────────────────────────────────────────────────────────────
  const handleCheckout = useCallback(async () => {
    if (cart.length === 0) { Alert.alert('Empty cart', 'Add items to the cart first.'); return; }
    if (payment === 'UDHAAR' && !selectedCustomer) {
      Alert.alert('Customer needed', 'Choose a customer to give Udhaar.'); return;
    }
    if (payment === 'SPLIT') {
      if (split.udhaar > 0 && !selectedCustomer) {
        Alert.alert('Customer needed', 'Choose a customer for the Udhaar part of the split.'); return;
      }
      const sum = round2(split.cash + split.upi + split.card + split.udhaar);
      if (Math.abs(sum - totals.grandTotal) > 0.01) {
        Alert.alert('Split mismatch', `Split amounts (₹${sum.toFixed(2)}) must add up to ₹${totals.grandTotal.toFixed(2)}.`);
        return;
      }
    }
    setLoading(true);
    try {
      const input: SaleInput = {
        items: cart.map(i => ({
          productId: i.productId, name: i.name, qty: i.qty, unit: i.unit,
          price: i.price, gst: i.gst,
        })),
        paymentType: payment,
        paymentSplit: payment === 'SPLIT' ? split : undefined,
        customerId: selectedCustomer?.id ?? null,
        discount: discountAmount,
        cashierId: staff?.id ?? 'unknown',
        cashierName: billerName,
        orderType,
      };
      const result = await createSale(input);
      setReceipt(result);
      setShowReceipt(true);
    } catch (err) {
      Alert.alert('Checkout failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [cart, totals, payment, split, selectedCustomer, discountAmount, orderType, staff, billerName]);

  const shareBill = useCallback(async () => {
    if (!receipt) return;
    const message = buildBillMessage({
      billNo: receipt.billNo,
      timestamp: receipt.timestamp,
      customerName: selectedCustomer?.name ?? receipt.customerName ?? 'Walk-in',
      customerGstNumber: selectedCustomer?.gstNumber,
      items: receipt.items,
      subtotal: receipt.subtotal,
      totalGST: receipt.totalGST,
      grandTotal: receipt.grandTotal,
      discount: receipt.discount,
      paymentType: payment,
      paymentSplit: payment === 'SPLIT' ? split : undefined,
      billerName,
      upiId: activeStore.upiId,
    });
    try {
      if (Platform.OS === 'web' && navigator.share) await navigator.share({ title: `Bill ${receipt.billNo}`, text: message });
      else if (Platform.OS !== 'web') await Share.share({ title: `Bill ${receipt.billNo}`, message });
      else if (navigator.clipboard) {
        await navigator.clipboard.writeText(message);
        Alert.alert('Bill copied', 'Bill details copied. You can paste and share them.');
      } else Alert.alert('Bill details', message);
    } catch (error) {
      if (!(error instanceof Error && error.name === 'AbortError')) Alert.alert('Share unavailable', 'Could not open the share options.');
    }
  }, [receipt, activeStore, selectedCustomer, payment, split, billerName]);

  // ── Sub-renders ────────────────────────────────────────────────────────────

  const renderProduct = (item: Product) => {
    const inCart = cart.find(c => c.productId === item.id);
    const lowStock = item.currentStock <= item.minThreshold;
    return (
      <TouchableOpacity
        key={item.id}
        style={[styles.productCard, inCart && styles.productCardInCart]}
        onPress={() => addToCart(item)}
        activeOpacity={0.75}
      >
        <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
        <View style={styles.productInfo}>
          <Text style={styles.productPrice}>₹{item.price}</Text>
          {item.gstPercent > 0 && <Text style={styles.productGst}>{item.gstPercent}%</Text>}
        </View>
        <Text style={styles.productStock}>
          Stock: {item.currentStock} {item.unit}
          {lowStock ? '  ⚠' : ''}
        </Text>
        {inCart && (
          <View style={styles.inCartBadge}>
            <Text style={styles.inCartText}>{inCart.qty}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderCartItem = (item: CartItem) => (
    <View key={item.productId} style={styles.cartRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.cartName}>{item.name}</Text>
        <Text style={styles.cartSub}>
          ₹{item.price} × {item.qty} {item.unit}
          {item.gst > 0 ? `  +${item.gst}% GST` : ''}
        </Text>
      </View>
      <View style={styles.qtyControl}>
        <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(item.productId, -1)}>
          <Text style={styles.qtyBtnText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.qtyNum}>{item.qty}</Text>
        <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(item.productId, 1)}>
          <Text style={styles.qtyBtnText}>+</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.cartTotal}>₹{item.total.toFixed(2)}</Text>
    </View>
  );

  // ── Products panel ─────────────────────────────────────────────────────────
  const ProductsPanel = () => (
    <View style={[styles.productsPanel, isWide && styles.productsPanelWide]}>
      {/* Search */}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="🔍 Search products…"
          value={search}
          onChangeText={setSearch}
          placeholderTextColor="#aaa"
        />
      </View>
      {/* Product grid */}
      <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
        <View style={styles.productGrid}>
          {filtered.length === 0 ? (
            <Text style={styles.emptyText}>No products found</Text>
          ) : (
            <View style={styles.productWrap}>
              {filtered.map(p => (
                <View key={p.id} style={[styles.productSlot, isWide && styles.productSlotWide]}>
                  {renderProduct(p)}
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );

  // ── Cart panel ─────────────────────────────────────────────────────────────
  const CartPanel = () => (
    <View style={[styles.cartPanel, isWide && styles.cartPanelWide]}>
      <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1 }}>
        {/* Cart header with item count and total */}
        <View style={styles.cartHeader}>
          <View style={styles.cartHeaderLeft}>
            <Text style={styles.cartTitle}>🛒 Cart</Text>
            <View style={styles.cartCountBadge}>
              <Text style={styles.cartCountText}>{cart.reduce((s, i) => s + i.qty, 0)}</Text>
            </View>
          </View>
          {cart.length > 0 && (
            <TouchableOpacity onPress={clearCart}>
              <Text style={styles.clearText}>Clear all</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Bill details stay visible throughout the sale, including an empty cart. */}
        <View style={styles.billDetails}>
          <View style={styles.billDetailRow}>
            <View style={styles.billNumberBox}>
              <Text style={styles.billDetailLabel}>Bill no.</Text>
              <Text style={styles.billNumber}>{draftBillNo.current}</Text>
            </View>
            <TouchableOpacity style={styles.detailPicker} onPress={() => setShowBillerPicker(true)}>
              <Text style={styles.billDetailLabel}>Biller</Text>
              <Text style={styles.detailPickerValue}>{billerName} ▾</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Customer</Text>
            <TouchableOpacity style={styles.customerBtn} onPress={() => setShowCustomerPicker(true)}>
              <Text style={styles.customerBtnText}>
                {selectedCustomer ? `${selectedCustomer.name} (${selectedCustomer.type})` : 'Select customer…'}
              </Text>
            </TouchableOpacity>
            {selectedCustomer && (
              <TouchableOpacity onPress={() => setSelectedCustomer(null)}>
                <Text style={styles.removeCustomer}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Order</Text>
            <View style={styles.chipRow}>
              {ORDER_TYPES.map(o => (
                <TouchableOpacity key={o.key} style={[styles.chip, orderType === o.key && styles.chipActive]} onPress={() => setOrderType(o.key)}>
                  <Text style={[styles.chipText, orderType === o.key && styles.chipTextActive]}>{o.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {cart.length === 0 ? (
          <View style={styles.emptyCart}>
            <Text style={styles.emptyCartIcon}>🛒</Text>
            <Text style={styles.emptyCartText}>Tap products to add them</Text>
          </View>
        ) : (
          <>
            {/* Cart items */}
            {cart.map(item => renderCartItem(item))}

            {/* Discount */}
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Discount</Text>
              <TextInput
                style={styles.discountInput}
                placeholder="0"
                value={discountText}
                onChangeText={setDiscountText}
                keyboardType="numeric"
                placeholderTextColor="#aaa"
              />
              <TouchableOpacity
                style={[styles.chip, styles.discountToggle]}
                onPress={() => setDiscountIsPercent(v => !v)}
              >
                <Text style={styles.chipText}>{discountIsPercent ? '%' : '₹'}</Text>
              </TouchableOpacity>
              {discountAmount > 0 && (
                <Text style={styles.discountPreview}>−₹{discountAmount.toFixed(2)}</Text>
              )}
            </View>

            {/* Totals — prominent box */}
            <View style={styles.totalsBox}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Subtotal</Text>
                <Text style={styles.totalValue}>₹{totals.subtotal.toFixed(2)}</Text>
              </View>
              {totals.totalGST > 0 && (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>GST</Text>
                  <Text style={styles.totalValue}>₹{totals.totalGST.toFixed(2)}</Text>
                </View>
              )}
              {discountAmount > 0 && (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Discount</Text>
                  <Text style={[styles.totalValue, { color: '#e03131' }]}>−₹{discountAmount.toFixed(2)}</Text>
                </View>
              )}
              <View style={[styles.totalRow, styles.grandRow]}>
                <Text style={styles.grandLabel}>Total</Text>
                <Text style={styles.grandValue}>₹{totals.grandTotal.toFixed(2)}</Text>
              </View>
            </View>

            {/* Payment method */}
            <Text style={[styles.sectionTitle, { marginTop: 12 }]}>Payment</Text>
            <View style={styles.paymentRow}>
              {PAYMENT_METHODS.map(m => (
                <TouchableOpacity
                  key={m.key}
                  style={[styles.paymentBtn, payment === m.key && styles.paymentBtnActive]}
                  onPress={() => {
                    setPayment(m.key);
                    if (m.key === 'UPI' && totals.grandTotal > 0) setShowUpiQr(true);
                    if (m.key === 'SPLIT') {
                      setSplitText({ cash: totals.grandTotal.toFixed(2), upi: '', card: '', udhaar: '' });
                    }
                  }}
                >
                  <Text style={styles.paymentIcon}>{m.icon}</Text>
                  <Text style={[styles.paymentBtnText, payment === m.key && styles.paymentBtnTextActive]}>
                    {m.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Split amounts */}
            {payment === 'SPLIT' && (
              <View style={styles.splitSection}>
                {(['cash', 'upi', 'card', 'udhaar'] as const).map(key => (
                  <View key={key} style={styles.splitRow}>
                    <Text style={styles.splitLabel}>{key.charAt(0).toUpperCase() + key.slice(1)}</Text>
                    <TextInput
                      style={styles.splitInput}
                      value={splitText[key]}
                      onChangeText={t => {
                        if (!/^\d*\.?\d{0,2}$/.test(t)) return;
                        setSplitText(prev => {
                          const next = { ...prev, [key]: t };
                          if (key !== 'cash') {
                            const otherAmounts = (['upi', 'card', 'udhaar'] as const)
                              .reduce((sum, part) => sum + (parseFloat(next[part]) || 0), 0);
                            next.cash = Math.max(0, Math.round((totals.grandTotal - otherAmounts) * 100) / 100).toFixed(2);
                          }
                          return next;
                        });
                      }}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor="#aaa"
                    />
                  </View>
                ))}
                <Text style={styles.splitTotal}>
                  Total: ₹{round2(split.cash + split.upi + split.card + split.udhaar).toFixed(2)}
                  {' '}/{' '}₹{totals.grandTotal.toFixed(2)}
                </Text>
                {split.upi > 0 && (
                  <TouchableOpacity style={styles.splitQrBtn} onPress={() => setShowUpiQr(true)}>
                    <Text style={styles.splitQrText}>📱 Show UPI QR · ₹{split.upi.toFixed(2)}</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Udhaar warning */}
            {(payment === 'UDHAAR' || (payment === 'SPLIT' && split.udhaar > 0)) && selectedCustomer && (
              <View style={styles.udhaarInfo}>
                <Text style={styles.udhaarText}>
                  {selectedCustomer.name}'s balance: ₹{selectedCustomer.totalOutstanding.toFixed(2)}
                  {selectedCustomer.creditLimit > 0
                    ? ` / limit ₹${selectedCustomer.creditLimit.toFixed(2)}`
                    : ' (no limit)'}
                </Text>
              </View>
            )}

            {/* Checkout button */}
            <TouchableOpacity
              style={[styles.checkoutBtn, loading && styles.disabled]}
              onPress={handleCheckout}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.checkoutText}>
                    {payment === 'UPI' ? `Payment received · Complete bill — ₹${totals.grandTotal.toFixed(2)}` : `Checkout — ₹${totals.grandTotal.toFixed(2)}`}
                  </Text>
              }
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loadingProducts) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3B5BDB" />
        <Text style={styles.loadingText}>Loading products…</Text>
      </View>
    );
  }

  // ── Main layout ────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>New Bill</Text>
          <Text style={styles.headerSub}>
            {staff?.name ?? 'Staff'} · {cart.reduce((s, i) => s + i.qty, 0)} items · ₹{totals.grandTotal.toFixed(2)}
          </Text>
        </View>
        {cart.length > 0 && (
          <View style={styles.headerTotal}>
            <Text style={styles.headerTotalLabel}>Total</Text>
            <Text style={styles.headerTotalValue}>₹{totals.grandTotal.toFixed(2)}</Text>
          </View>
        )}
      </View>

      {/* Body: side-by-side on wide, stacked on narrow */}
      {isWide ? (
        <View style={styles.wideBody}>
          <ProductsPanel />
          <CartPanel />
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
          <ProductsPanel />
          <CartPanel />
        </ScrollView>
      )}

      {/* ── Customer picker modal ─────────────────────────────────────────── */}
      <Modal visible={showCustomerPicker} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose Customer</Text>
              <TouchableOpacity onPress={() => { setShowCustomerPicker(false); setCustomerSearch(''); }}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.modalSearch}
              placeholder="Search by name or phone…"
              value={customerSearch}
              onChangeText={setCustomerSearch}
              placeholderTextColor="#aaa"
              autoFocus
            />
            <FlatList
              data={filteredCustomers}
              keyExtractor={c => c.id}
              renderItem={({ item: c }) => (
                <TouchableOpacity
                  style={styles.customerRow}
                  onPress={() => {
                    setSelectedCustomer(c);
                    setShowCustomerPicker(false);
                    setCustomerSearch('');
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.customerName}>{c.name}</Text>
                    <Text style={styles.customerPhone}>{c.phone} · {c.type}</Text>
                  </View>
                  {c.totalOutstanding > 0 && (
                    <Text style={styles.customerDue}>₹{c.totalOutstanding.toFixed(2)} due</Text>
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No customers found</Text>
              }
              style={{ maxHeight: 400 }}
            />
          </View>
        </View>
      </Modal>

      <UpiQrModal
        visible={showUpiQr}
        onClose={() => setShowUpiQr(false)}
        storeName={activeStore.name}
        defaultUpiId={activeStore.upiId || ''}
        amount={payment === 'SPLIT' ? split.upi : totals.grandTotal}
        customerPhone={selectedCustomer?.phone}
      />

      <Modal visible={showBillerPicker} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 420 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose Biller</Text>
              <TouchableOpacity onPress={() => setShowBillerPicker(false)}><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
            </View>
            {[staff?.name, 'Owner', 'Staff'].filter((name, index, all): name is string => Boolean(name) && all.indexOf(name) === index).map(name => (
              <TouchableOpacity key={name} style={styles.billerRow} onPress={() => { setBillerName(name); setShowBillerPicker(false); }}>
                <Text style={styles.customerName}>{name}</Text>
                {billerName === name && <Text style={styles.billerSelected}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* ── Receipt modal ─────────────────────────────────────────────────── */}
      <Modal visible={showReceipt} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 420 }]}>
            <ScrollView>
              {receipt && (
                <>
                  <Text style={styles.receiptHeader}>
                    {receipt.offline ? '⏳ Bill Saved (Offline)' : '✅ Bill Saved'}
                  </Text>
                  <Text style={styles.receiptBillNo}>{receipt.billNo}</Text>
                  {receipt.offline && (
                    <Text style={styles.offlineNotice}>
                      This bill is saved on your device and will sync to the cloud when internet returns.
                      The final bill number will be assigned after sync.
                    </Text>
                  )}
                  <View style={styles.receiptDivider} />
                  {receipt.items.map((it, idx) => (
                    <View key={idx} style={styles.receiptItemRow}>
                      <Text style={styles.receiptItemName}>{it.name} ×{it.qty}</Text>
                      <Text style={styles.receiptItemTotal}>₹{it.total.toFixed(2)}</Text>
                    </View>
                  ))}
                  <View style={styles.receiptDivider} />
                  <View style={styles.receiptTotalRow}>
                    <Text>Subtotal</Text>
                    <Text>₹{receipt.subtotal.toFixed(2)}</Text>
                  </View>
                  {receipt.totalGST > 0 && (
                    <View style={styles.receiptTotalRow}>
                      <Text>GST</Text>
                      <Text>₹{receipt.totalGST.toFixed(2)}</Text>
                    </View>
                  )}
                  {receipt.discount > 0 && (
                    <View style={styles.receiptTotalRow}>
                      <Text>Discount</Text>
                      <Text style={{ color: '#e03131' }}>−₹{receipt.discount.toFixed(2)}</Text>
                    </View>
                  )}
                  <View style={[styles.receiptTotalRow, { borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 8, marginTop: 4 }]}>
                    <Text style={{ fontWeight: '700', fontSize: 16 }}>Total</Text>
                    <Text style={{ fontWeight: '700', fontSize: 16, color: '#3B5BDB' }}>₹{receipt.grandTotal.toFixed(2)}</Text>
                  </View>
                  {receipt.customerName && (
                    <Text style={styles.receiptCustomer}>Customer: {receipt.customerName}</Text>
                  )}
                  {selectedCustomer?.gstNumber && (
                    <Text style={styles.receiptCustomer}>Customer GSTIN: {selectedCustomer.gstNumber}</Text>
                  )}
                  {receipt.udhaarAdded > 0 && (
                    <Text style={styles.receiptUdhaar}>Udhaar added: ₹{receipt.udhaarAdded.toFixed(2)}</Text>
                  )}
                  {receipt.stockWarnings && receipt.stockWarnings.length > 0 && (
                    <View style={styles.stockWarnings}>
                      <Text style={styles.warningTitle}>⚠ Stock warnings</Text>
                      {receipt.stockWarnings.map((w: any, i: number) => (
                        <Text key={i} style={styles.warningText}>
                          {w.name}: had {w.had}, sold {w.sold}
                        </Text>
                      ))}
                    </View>
                  )}
                </>
              )}
            </ScrollView>

            <View style={styles.receiptActions}>
              <TouchableOpacity style={styles.receiptActionBtn} onPress={shareBill}>
                <Text style={styles.receiptActionText}>📤 Share bill</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.receiptActionBtn, styles.receiptPrimaryBtn]}
                onPress={() => { setShowReceipt(false); clearCart(); }}
              >
                <Text style={[styles.receiptActionText, { color: '#fff' }]}>New Bill</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:            { flex: 1, backgroundColor: '#f8f9fa' },
  center:               { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText:          { marginTop: 12, color: '#666' },
  emptyText:            { textAlign: 'center', color: '#999', padding: 20, fontSize: 14 },

  // Header
  header:               { backgroundColor: '#3B5BDB', paddingHorizontal: 16, paddingVertical: 14, paddingTop: 20, flexDirection: 'row', alignItems: 'center' },
  headerTitle:          { fontSize: 20, fontWeight: '700', color: '#fff' },
  headerSub:            { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  headerTotal:          { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, alignItems: 'center' as const },
  headerTotalLabel:     { fontSize: 10, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  headerTotalValue:     { fontSize: 18, fontWeight: '700', color: '#fff' },

  // Wide (tablet) body layout
  wideBody:             { flex: 1, flexDirection: 'row' },

  // Products panel
  productsPanel:        { },
  productsPanelWide:    { flex: 3, borderRightWidth: 1, borderRightColor: '#e0e0e0' },

  // Search
  searchBar:            { backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: '#e0e0e0' },
  searchInput:          { height: 36, backgroundColor: '#f2f2f2', borderRadius: 8, paddingHorizontal: 12, fontSize: 14, color: '#333' },

  // Products
  productGrid:          { padding: 8 },
  productWrap:          { flexDirection: 'row', flexWrap: 'wrap' },
  productSlot:          { width: '50%', padding: 4 },
  productSlotWide:      { width: '33.33%' },
  productCard:          { backgroundColor: '#3B5BDB', borderRadius: 10, padding: 12, minHeight: 80, position: 'relative' as const },
  productCardInCart:     { backgroundColor: '#2f9e44' },
  productName:          { fontSize: 13, fontWeight: '600', color: '#fff' },
  productInfo:          { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  productPrice:         { fontSize: 14, color: '#fff', fontWeight: '700' },
  productGst:           { fontSize: 10, color: 'rgba(255,255,255,0.65)', backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
  productStock:         { fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 4 },
  inCartBadge:          { position: 'absolute' as const, top: 6, right: 6, backgroundColor: '#fff', borderRadius: 10, width: 22, height: 22, alignItems: 'center' as const, justifyContent: 'center' as const },
  inCartText:           { fontSize: 11, fontWeight: '700', color: '#2f9e44' },

  // Cart panel
  cartPanel:            { backgroundColor: '#fff', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 20, borderTopWidth: 0.5, borderTopColor: '#e0e0e0' },
  cartPanelWide:        { flex: 2, borderTopWidth: 0 },

  // Cart header
  cartHeader:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: '#eee' },
  cartHeaderLeft:       { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cartTitle:            { fontSize: 16, fontWeight: '700', color: '#333' },
  cartCountBadge:       { backgroundColor: '#3B5BDB', borderRadius: 10, minWidth: 22, height: 22, alignItems: 'center' as const, justifyContent: 'center' as const, paddingHorizontal: 6 },
  cartCountText:        { fontSize: 12, fontWeight: '700', color: '#fff' },
  clearText:            { fontSize: 13, color: '#e03131', fontWeight: '500' },

  billDetails:          { paddingTop: 8, paddingBottom: 4, borderBottomWidth: 0.5, borderBottomColor: '#eee' },
  billDetailRow:        { flexDirection: 'row', gap: 8, marginBottom: 2 },
  billNumberBox:        { flex: 1, backgroundColor: '#f0f4ff', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  detailPicker:         { flex: 1, backgroundColor: '#f2f2f2', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  billDetailLabel:      { fontSize: 10, color: '#777', fontWeight: '600', textTransform: 'uppercase' as const, letterSpacing: 0.4 },
  billNumber:           { fontSize: 12, color: '#3B5BDB', fontWeight: '700', marginTop: 2 },
  detailPickerValue:    { fontSize: 13, color: '#333', fontWeight: '600', marginTop: 2 },

  // Empty cart
  emptyCart:            { alignItems: 'center' as const, paddingVertical: 40 },
  emptyCartIcon:        { fontSize: 40, marginBottom: 8 },
  emptyCartText:        { fontSize: 14, color: '#999' },

  // Cart items
  sectionTitle:         { fontSize: 13, fontWeight: '600', color: '#666', textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 8 },
  cartRow:              { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: '#f0f0f0' },
  cartName:             { fontSize: 14, fontWeight: '500', color: '#333' },
  cartSub:              { fontSize: 12, color: '#888', marginTop: 2 },
  cartTotal:            { fontSize: 14, fontWeight: '600', color: '#3B5BDB', minWidth: 64, textAlign: 'right' as const },
  qtyControl:           { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 12 },
  qtyBtn:               { width: 28, height: 28, borderRadius: 14, borderWidth: 0.5, borderColor: '#ddd', alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: '#f8f9fa' },
  qtyBtnText:           { fontSize: 18, color: '#333', lineHeight: 22 },
  qtyNum:               { fontSize: 14, fontWeight: '600', minWidth: 20, textAlign: 'center' as const },

  // Fields
  fieldRow:             { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 8 },
  fieldLabel:           { fontSize: 13, fontWeight: '500', color: '#555', width: 72 },
  customerBtn:          { flex: 1, backgroundColor: '#f2f2f2', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  customerBtnText:      { fontSize: 13, color: '#333' },
  removeCustomer:       { fontSize: 18, color: '#e03131', paddingHorizontal: 8 },
  chipRow:              { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip:                 { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 0.5, borderColor: '#ddd', backgroundColor: '#f8f9fa' },
  chipActive:           { backgroundColor: '#3B5BDB', borderColor: '#3B5BDB' },
  chipText:             { fontSize: 12, color: '#555' },
  chipTextActive:       { color: '#fff', fontWeight: '500' },
  discountInput:        { width: 80, height: 32, backgroundColor: '#f2f2f2', borderRadius: 6, paddingHorizontal: 10, fontSize: 14, color: '#333' },
  discountToggle:       { minWidth: 32, alignItems: 'center' as const },
  discountPreview:      { fontSize: 13, color: '#e03131', fontWeight: '500' },

  // Totals
  totalsBox:            { marginTop: 10, padding: 12, backgroundColor: '#f0f4ff', borderRadius: 10, borderWidth: 1, borderColor: '#d0d8f0' },
  totalRow:             { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  totalLabel:           { fontSize: 13, color: '#666' },
  totalValue:           { fontSize: 13, color: '#333', fontWeight: '500' },
  grandRow:             { borderTopWidth: 1, borderTopColor: '#c0c8e0', marginTop: 6, paddingTop: 8 },
  grandLabel:           { fontSize: 17, fontWeight: '700', color: '#333' },
  grandValue:           { fontSize: 17, fontWeight: '700', color: '#3B5BDB' },

  // Payment
  paymentRow:           { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  paymentBtn:           { flex: 1, minWidth: 60, paddingVertical: 8, borderRadius: 8, borderWidth: 0.5, borderColor: '#ddd', alignItems: 'center' as const },
  paymentBtnActive:     { backgroundColor: '#3B5BDB', borderColor: '#3B5BDB' },
  paymentIcon:          { fontSize: 16, marginBottom: 2 },
  paymentBtnText:       { fontSize: 12, color: '#555' },
  paymentBtnTextActive: { color: '#fff', fontWeight: '500' },

  // Split
  splitSection:         { backgroundColor: '#f8f9fa', borderRadius: 8, padding: 10, marginTop: 8 },
  splitRow:             { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  splitLabel:           { width: 60, fontSize: 13, color: '#555' },
  splitInput:           { flex: 1, height: 32, backgroundColor: '#fff', borderRadius: 6, paddingHorizontal: 10, fontSize: 14, borderWidth: 0.5, borderColor: '#ddd', color: '#333' },
  splitTotal:           { textAlign: 'center' as const, fontSize: 13, color: '#666', marginTop: 4 },
  splitQrBtn:           { alignSelf: 'center' as const, marginTop: 10, backgroundColor: '#e6fcf5', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  splitQrText:          { color: '#087f5b', fontSize: 13, fontWeight: '700' as const },

  // Udhaar
  udhaarInfo:           { backgroundColor: '#fff9db', borderRadius: 8, padding: 10, marginTop: 8 },
  udhaarText:           { fontSize: 13, color: '#e67700' },

  // Checkout
  checkoutBtn:          { marginTop: 14, backgroundColor: '#2f9e44', borderRadius: 10, paddingVertical: 14, alignItems: 'center' as const },
  checkoutText:         { color: '#fff', fontSize: 16, fontWeight: '600' },
  disabled:             { opacity: 0.6 },

  // Modals
  modalOverlay:         { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center' as const, alignItems: 'center' as const, padding: 20 },
  modalContent:         { backgroundColor: '#fff', borderRadius: 12, width: '100%', maxWidth: 500, maxHeight: '85%', padding: 16 },
  modalHeader:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle:           { fontSize: 17, fontWeight: '600', color: '#333' },
  modalClose:           { fontSize: 22, color: '#999', paddingHorizontal: 8 },
  modalSearch:          { height: 38, backgroundColor: '#f2f2f2', borderRadius: 8, paddingHorizontal: 12, fontSize: 14, marginBottom: 8, color: '#333' },
  customerRow:          { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: '#f0f0f0' },
  customerName:         { fontSize: 14, fontWeight: '500', color: '#333' },
  customerPhone:        { fontSize: 12, color: '#888', marginTop: 2 },
  customerDue:          { fontSize: 13, color: '#e03131', fontWeight: '500' },
  billerRow:            { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 0.5, borderBottomColor: '#f0f0f0' },
  billerSelected:       { color: '#2f9e44', fontSize: 18, fontWeight: '700' },

  // Receipt
  receiptHeader:        { fontSize: 20, fontWeight: '700', textAlign: 'center' as const, marginBottom: 4, color: '#333' },
  receiptBillNo:        { fontSize: 14, textAlign: 'center' as const, color: '#666', marginBottom: 8 },
  offlineNotice:        { backgroundColor: '#fff3bf', padding: 10, borderRadius: 8, fontSize: 13, color: '#e67700', marginBottom: 8, textAlign: 'center' as const },
  receiptDivider:       { height: 1, backgroundColor: '#eee', marginVertical: 8 },
  receiptItemRow:       { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  receiptItemName:      { fontSize: 13, color: '#333', flex: 1 },
  receiptItemTotal:     { fontSize: 13, color: '#333', fontWeight: '500' },
  receiptTotalRow:      { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  receiptCustomer:      { fontSize: 13, color: '#555', marginTop: 8, textAlign: 'center' as const },
  receiptUdhaar:        { fontSize: 13, color: '#e67700', marginTop: 4, textAlign: 'center' as const },
  stockWarnings:        { backgroundColor: '#fff3bf', borderRadius: 8, padding: 10, marginTop: 8 },
  warningTitle:         { fontSize: 13, fontWeight: '600', color: '#e67700', marginBottom: 4 },
  warningText:          { fontSize: 12, color: '#e67700' },
  receiptActions:       { flexDirection: 'row', gap: 10, marginTop: 16 },
  receiptActionBtn:     { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' as const, borderWidth: 0.5, borderColor: '#ddd' },
  receiptPrimaryBtn:    { backgroundColor: '#3B5BDB', borderColor: '#3B5BDB' },
  receiptActionText:    { fontSize: 14, fontWeight: '500', color: '#333' },
});

export default BillingScreen;
