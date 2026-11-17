/**
 * NewPurchaseScreen — Record a purchase from a supplier (stock-in).
 * Picks supplier, adds items (from existing products or new), sets charges and payment.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  TextInput, Alert, ActivityIndicator, ScrollView, Modal, FlatList,
} from 'react-native';
import {
  getProducts, getSuppliers, addSupplier, createPurchase,
} from '../../services/firebase/firestoreService';
import { supplierService } from '../../services/supplier/supplierService';
const validateSupplier = (s: any) => supplierService.validateSupplier(s);
import type { Product } from '../../models/Product';
import type { Supplier, SupplierInput, NewPurchaseItem, SUPPLIER_PAYMENT_MODES } from '../../models/Supplier';
import { useSession } from '../../context/SessionContext';

const round2 = (n: number) => Math.round(n * 100) / 100;
const GST_RATES = [0, 5, 12, 18, 28];
const PAY_MODES = ['CASH', 'UPI', 'BANK', 'CHEQUE'] as const;

interface ItemLine extends NewPurchaseItem {
  _key: string; // local key for FlatList
}

const NewPurchaseScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const { staff } = useSession();

  // Data
  const [products, setProducts]   = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading]     = useState(true);

  // Form
  const [supplier, setSupplier]         = useState<Supplier | null>(null);
  const [showSupplierPicker, setShowSupplierPicker] = useState(false);
  const [showNewSupplier, setShowNewSupplier]       = useState(false);
  const [supplierSearch, setSupplierSearch]         = useState('');
  const [invoiceNo, setInvoiceNo]       = useState('');
  const [invoiceDate, setInvoiceDate]   = useState(new Date().toISOString().slice(0, 10));
  const [items, setItems]               = useState<ItemLine[]>([]);
  const [otherCharges, setOtherCharges] = useState('');
  const [discount, setDiscount]         = useState('');
  const [amountPaid, setAmountPaid]     = useState('');
  const [paymentMode, setPaymentMode]   = useState<typeof PAY_MODES[number]>('CASH');
  const [notes, setNotes]               = useState('');
  const [submitting, setSubmitting]     = useState(false);

  // Product picker
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [productSearch, setProductSearch]         = useState('');

  // New supplier form
  const [newSup, setNewSup] = useState<SupplierInput>({
    name: '', phone: '', address: '', city: '', paymentTerms: 'credit', creditDays: 30,
  });

  useEffect(() => {
    Promise.all([getProducts(), getSuppliers()])
      .then(([p, s]) => { setProducts(p); setSuppliers(s); })
      .finally(() => setLoading(false));
  }, []);

  // Totals
  const totals = useMemo(() => {
    const sub = round2(items.reduce((s, i) => s + round2(i.costPrice * i.qty), 0));
    const gst = round2(items.reduce((s, i) => s + round2((i.costPrice * i.qty * i.gstPercent) / 100), 0));
    const other = parseFloat(otherCharges) || 0;
    const disc  = parseFloat(discount) || 0;
    const grand = round2(Math.max(0, sub + gst + other - disc));
    return { sub, gst, other, disc, grand };
  }, [items, otherCharges, discount]);

  // Add product from picker
  const addProductItem = useCallback((p: Product) => {
    setItems(prev => {
      const existing = prev.find(i => i.productId === p.id);
      if (existing) {
        return prev.map(i => i.productId === p.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, {
        _key: `${p.id}-${Date.now()}`,
        productId: p.id,
        name: p.name,
        qty: 1,
        unit: p.unit,
        costPrice: p.purchasePrice ?? p.price,
        gstPercent: p.gstPercent,
        sellingPrice: p.price,
        category: p.category,
      }];
    });
    setShowProductPicker(false);
    setProductSearch('');
  }, []);

  // Add blank new item
  const addBlankItem = useCallback(() => {
    setItems(prev => [...prev, {
      _key: `new-${Date.now()}`,
      isNew: true,
      name: '',
      qty: 1,
      unit: 'pcs',
      costPrice: 0,
      gstPercent: 0,
      sellingPrice: undefined,
      category: '',
    }]);
  }, []);

  const removeItem = useCallback((key: string) => {
    setItems(prev => prev.filter(i => i._key !== key));
  }, []);

  const updateItem = useCallback((key: string, patch: Partial<ItemLine>) => {
    setItems(prev => prev.map(i => i._key === key ? { ...i, ...patch } : i));
  }, []);

  // Save new supplier
  const saveNewSupplier = useCallback(async () => {
    const errs = validateSupplier(newSup);
    if (errs.length > 0) { Alert.alert('Fix these', errs.join('\n')); return; }
    try {
      const s = await addSupplier(newSup);
      setSuppliers(prev => [...prev, s]);
      setSupplier(s);
      setShowNewSupplier(false);
      setNewSup({ name: '', phone: '', address: '', city: '', paymentTerms: 'credit', creditDays: 30 });
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : String(e));
    }
  }, [newSup]);

  // Submit
  const handleSubmit = useCallback(async () => {
    if (!supplier) { Alert.alert('Select a supplier'); return; }
    if (items.length === 0) { Alert.alert('Add items', 'Add at least one item to this purchase.'); return; }
    for (const i of items) {
      if (!i.name.trim()) { Alert.alert('Item name missing', 'Every item needs a name.'); return; }
      if (!(i.qty > 0)) { Alert.alert('Quantity', `Set quantity for ${i.name}`); return; }
      if (!(i.costPrice >= 0)) { Alert.alert('Cost price', `Set cost price for ${i.name}`); return; }
    }
    setSubmitting(true);
    try {
      const result = await createPurchase({
        supplierId: supplier.id,
        invoiceNo: invoiceNo.trim() || undefined,
        invoiceDate: invoiceDate || undefined,
        items: items.map(({ _key, ...rest }) => rest),
        otherCharges: parseFloat(otherCharges) || 0,
        discount: parseFloat(discount) || 0,
        amountPaid: parseFloat(amountPaid) || 0,
        paymentMode,
        notes: notes.trim() || undefined,
      }, staff?.name ?? 'Staff');
      Alert.alert(
        result.offline ? '⏳ Purchase saved (offline)' : '✅ Purchase saved',
        `${result.purchaseNo}\nTotal: ₹${result.grandTotal.toFixed(2)}\nPaid: ₹${result.amountPaid.toFixed(2)}`,
        [{ text: 'OK', onPress: () => navigation?.goBack() }],
      );
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }, [supplier, items, invoiceNo, invoiceDate, otherCharges, discount, amountPaid, paymentMode, notes, staff, navigation]);

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color="#3B5BDB" />
    </View>
  );

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation?.goBack()}>
          <Text style={styles.backBtn}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Purchase</Text>
      </View>

      {/* Supplier */}
      <View style={styles.section}>
        <Text style={styles.label}>Supplier *</Text>
        <View style={styles.row}>
          <TouchableOpacity style={[styles.input, { flex: 1 }]} onPress={() => setShowSupplierPicker(true)}>
            <Text style={{ color: supplier ? '#333' : '#aaa' }}>
              {supplier ? supplier.name : 'Choose supplier…'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowNewSupplier(true)}>
            <Text style={styles.addBtnText}>+ New</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Invoice */}
      <View style={styles.section}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Invoice No</Text>
            <TextInput style={styles.input} value={invoiceNo} onChangeText={setInvoiceNo} placeholder="Supplier's bill no." placeholderTextColor="#aaa" />
          </View>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={styles.label}>Date</Text>
            <TextInput style={styles.input} value={invoiceDate} onChangeText={setInvoiceDate} placeholder="YYYY-MM-DD" placeholderTextColor="#aaa" />
          </View>
        </View>
      </View>

      {/* Items */}
      <View style={styles.section}>
        <Text style={styles.label}>Items</Text>
        {items.map((item, idx) => (
          <View key={item._key} style={styles.itemCard}>
            <View style={styles.row}>
              {item.isNew ? (
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={item.name}
                  onChangeText={v => updateItem(item._key, { name: v })}
                  placeholder="Item name *"
                  placeholderTextColor="#aaa"
                />
              ) : (
                <Text style={[styles.input, { flex: 1, paddingTop: 10 }]}>{item.name}</Text>
              )}
              <TouchableOpacity onPress={() => removeItem(item._key)} style={styles.removeBtn}>
                <Text style={styles.removeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.miniLabel}>Qty</Text>
                <TextInput
                  style={styles.miniInput}
                  value={item.qty > 0 ? String(item.qty) : ''}
                  onChangeText={v => updateItem(item._key, { qty: parseFloat(v) || 0 })}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="#aaa"
                />
              </View>
              <View style={{ flex: 1, marginLeft: 6 }}>
                <Text style={styles.miniLabel}>Unit</Text>
                <TextInput
                  style={styles.miniInput}
                  value={item.unit}
                  onChangeText={v => updateItem(item._key, { unit: v })}
                  placeholder="pcs"
                  placeholderTextColor="#aaa"
                />
              </View>
              <View style={{ flex: 1.2, marginLeft: 6 }}>
                <Text style={styles.miniLabel}>Cost ₹</Text>
                <TextInput
                  style={styles.miniInput}
                  value={item.costPrice > 0 ? String(item.costPrice) : ''}
                  onChangeText={v => updateItem(item._key, { costPrice: parseFloat(v) || 0 })}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="#aaa"
                />
              </View>
              <View style={{ flex: 1, marginLeft: 6 }}>
                <Text style={styles.miniLabel}>GST %</Text>
                <View style={styles.gstRow}>
                  {GST_RATES.map(r => (
                    <TouchableOpacity
                      key={r}
                      style={[styles.gstChip, item.gstPercent === r && styles.gstChipActive]}
                      onPress={() => updateItem(item._key, { gstPercent: r })}
                    >
                      <Text style={[styles.gstChipText, item.gstPercent === r && styles.gstChipTextActive]}>
                        {r}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
            {item.isNew && (
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.miniLabel}>Selling ₹</Text>
                  <TextInput
                    style={styles.miniInput}
                    value={item.sellingPrice != null ? String(item.sellingPrice) : ''}
                    onChangeText={v => updateItem(item._key, { sellingPrice: parseFloat(v) || undefined })}
                    keyboardType="numeric"
                    placeholder="optional"
                    placeholderTextColor="#aaa"
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 6 }}>
                  <Text style={styles.miniLabel}>Category</Text>
                  <TextInput
                    style={styles.miniInput}
                    value={item.category ?? ''}
                    onChangeText={v => updateItem(item._key, { category: v })}
                    placeholder="optional"
                    placeholderTextColor="#aaa"
                  />
                </View>
              </View>
            )}
            <Text style={styles.itemTotal}>
              Line: ₹{round2(item.costPrice * item.qty).toFixed(2)} + GST ₹{round2((item.costPrice * item.qty * item.gstPercent) / 100).toFixed(2)}
            </Text>
          </View>
        ))}
        <View style={styles.row}>
          <TouchableOpacity style={styles.addItemBtn} onPress={() => setShowProductPicker(true)}>
            <Text style={styles.addItemBtnText}>+ From inventory</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.addItemBtn, { marginLeft: 8 }]} onPress={addBlankItem}>
            <Text style={styles.addItemBtnText}>+ New item</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Charges & totals */}
      <View style={styles.section}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Other charges ₹</Text>
            <TextInput style={styles.input} value={otherCharges} onChangeText={setOtherCharges} keyboardType="numeric" placeholder="0" placeholderTextColor="#aaa" />
          </View>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={styles.label}>Discount ₹</Text>
            <TextInput style={styles.input} value={discount} onChangeText={setDiscount} keyboardType="numeric" placeholder="0" placeholderTextColor="#aaa" />
          </View>
        </View>
        <View style={styles.totalsBox}>
          <View style={styles.totalRow}><Text style={styles.totalLabel}>Subtotal</Text><Text>₹{totals.sub.toFixed(2)}</Text></View>
          <View style={styles.totalRow}><Text style={styles.totalLabel}>GST</Text><Text>₹{totals.gst.toFixed(2)}</Text></View>
          {totals.other > 0 && <View style={styles.totalRow}><Text style={styles.totalLabel}>Other</Text><Text>₹{totals.other.toFixed(2)}</Text></View>}
          {totals.disc > 0 && <View style={styles.totalRow}><Text style={styles.totalLabel}>Discount</Text><Text style={{color:'#e03131'}}>−₹{totals.disc.toFixed(2)}</Text></View>}
          <View style={[styles.totalRow, { borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 6, marginTop: 4 }]}>
            <Text style={{ fontWeight: '700', fontSize: 16 }}>Grand Total</Text>
            <Text style={{ fontWeight: '700', fontSize: 16, color: '#3B5BDB' }}>₹{totals.grand.toFixed(2)}</Text>
          </View>
        </View>
      </View>

      {/* Payment */}
      <View style={styles.section}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Amount paid now ₹</Text>
            <TextInput style={styles.input} value={amountPaid} onChangeText={setAmountPaid} keyboardType="numeric" placeholder="0" placeholderTextColor="#aaa" />
          </View>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={styles.label}>Payment mode</Text>
            <View style={styles.chipRow}>
              {PAY_MODES.map(m => (
                <TouchableOpacity key={m} style={[styles.chip, paymentMode === m && styles.chipActive]} onPress={() => setPaymentMode(m)}>
                  <Text style={[styles.chipText, paymentMode === m && styles.chipTextActive]}>{m}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
        <Text style={styles.label}>Notes</Text>
        <TextInput style={[styles.input, { height: 60 }]} value={notes} onChangeText={setNotes} multiline placeholder="optional" placeholderTextColor="#aaa" />
      </View>

      {/* Submit */}
      <TouchableOpacity
        style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        {submitting
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.submitBtnText}>Save Purchase — ₹{totals.grand.toFixed(2)}</Text>
        }
      </TouchableOpacity>
      <View style={{ height: 60 }} />

      {/* Product picker modal */}
      <Modal visible={showProductPicker} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Pick Product</Text>
              <TouchableOpacity onPress={() => { setShowProductPicker(false); setProductSearch(''); }}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.modalSearch}
              placeholder="Search products…"
              value={productSearch}
              onChangeText={setProductSearch}
              placeholderTextColor="#aaa"
              autoFocus
            />
            <FlatList
              data={products.filter(p => p.isActive !== false && p.name.toLowerCase().includes(productSearch.toLowerCase()))}
              keyExtractor={p => p.id}
              renderItem={({ item: p }) => (
                <TouchableOpacity style={styles.pickerRow} onPress={() => addProductItem(p)}>
                  <Text style={styles.pickerName}>{p.name}</Text>
                  <Text style={styles.pickerSub}>₹{p.price} · {p.currentStock} {p.unit} · GST {p.gstPercent}%</Text>
                </TouchableOpacity>
              )}
              style={{ maxHeight: 400 }}
            />
          </View>
        </View>
      </Modal>

      {/* Supplier picker modal */}
      <Modal visible={showSupplierPicker} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Pick Supplier</Text>
              <TouchableOpacity onPress={() => { setShowSupplierPicker(false); setSupplierSearch(''); }}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.modalSearch}
              placeholder="Search suppliers…"
              value={supplierSearch}
              onChangeText={setSupplierSearch}
              placeholderTextColor="#aaa"
              autoFocus
            />
            <FlatList
              data={suppliers.filter(s => s.isActive && s.name.toLowerCase().includes(supplierSearch.toLowerCase()))}
              keyExtractor={s => s.id}
              renderItem={({ item: s }) => (
                <TouchableOpacity
                  style={styles.pickerRow}
                  onPress={() => { setSupplier(s); setShowSupplierPicker(false); setSupplierSearch(''); }}
                >
                  <Text style={styles.pickerName}>{s.name}</Text>
                  <Text style={styles.pickerSub}>{s.city} · ₹{s.totalDue.toFixed(0)} due</Text>
                </TouchableOpacity>
              )}
              style={{ maxHeight: 400 }}
              ListEmptyComponent={<Text style={styles.emptyText}>No suppliers — add one first</Text>}
            />
          </View>
        </View>
      </Modal>

      {/* New supplier modal */}
      <Modal visible={showNewSupplier} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Supplier</Text>
              <TouchableOpacity onPress={() => setShowNewSupplier(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView>
              <Text style={styles.miniLabel}>Name *</Text>
              <TextInput style={styles.input} value={newSup.name} onChangeText={v => setNewSup(p => ({...p, name: v}))} placeholder="Supplier name" placeholderTextColor="#aaa" />
              <Text style={styles.miniLabel}>Phone *</Text>
              <TextInput style={styles.input} value={newSup.phone} onChangeText={v => setNewSup(p => ({...p, phone: v}))} placeholder="10 digits" keyboardType="phone-pad" placeholderTextColor="#aaa" />
              <Text style={styles.miniLabel}>City</Text>
              <TextInput style={styles.input} value={newSup.city} onChangeText={v => setNewSup(p => ({...p, city: v}))} placeholder="City" placeholderTextColor="#aaa" />
              <Text style={styles.miniLabel}>Address</Text>
              <TextInput style={styles.input} value={newSup.address} onChangeText={v => setNewSup(p => ({...p, address: v}))} placeholder="Address" placeholderTextColor="#aaa" />
              <Text style={styles.miniLabel}>GSTIN</Text>
              <TextInput style={styles.input} value={newSup.gstNumber ?? ''} onChangeText={v => setNewSup(p => ({...p, gstNumber: v || null}))} placeholder="15 characters" placeholderTextColor="#aaa" />
              <TouchableOpacity style={styles.submitBtn} onPress={saveNewSupplier}>
                <Text style={styles.submitBtnText}>Save Supplier</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#f8f9fa' },
  center:       { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:       { backgroundColor: '#3B5BDB', paddingHorizontal: 16, paddingVertical: 14, paddingTop: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn:      { color: '#fff', fontSize: 16 },
  headerTitle:  { fontSize: 18, fontWeight: '700', color: '#fff' },
  section:      { backgroundColor: '#fff', margin: 10, marginBottom: 0, borderRadius: 10, padding: 14 },
  label:        { fontSize: 13, fontWeight: '500', color: '#555', marginBottom: 6 },
  miniLabel:    { fontSize: 11, color: '#888', marginTop: 6, marginBottom: 2 },
  input:        { backgroundColor: '#f2f2f2', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: '#333' },
  miniInput:    { backgroundColor: '#f2f2f2', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6, fontSize: 13, color: '#333' },
  row:          { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
  addBtn:       { backgroundColor: '#3B5BDB', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, marginLeft: 8 },
  addBtnText:   { color: '#fff', fontWeight: '500', fontSize: 13 },
  itemCard:     { backgroundColor: '#f8f9fa', borderRadius: 8, padding: 10, marginBottom: 8, borderWidth: 0.5, borderColor: '#eee' },
  removeBtn:    { paddingHorizontal: 10, paddingVertical: 8 },
  removeBtnText:{ fontSize: 18, color: '#e03131' },
  itemTotal:    { fontSize: 12, color: '#3B5BDB', fontWeight: '500', marginTop: 4, textAlign: 'right' },
  gstRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
  gstChip:      { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4, borderWidth: 0.5, borderColor: '#ddd', backgroundColor: '#fff' },
  gstChipActive:{ backgroundColor: '#3B5BDB', borderColor: '#3B5BDB' },
  gstChipText:  { fontSize: 10, color: '#555' },
  gstChipTextActive: { color: '#fff' },
  addItemBtn:   { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#3B5BDB', borderStyle: 'dashed', alignItems: 'center' },
  addItemBtnText: { color: '#3B5BDB', fontWeight: '500', fontSize: 13 },
  chipRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip:         { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 0.5, borderColor: '#ddd' },
  chipActive:   { backgroundColor: '#3B5BDB', borderColor: '#3B5BDB' },
  chipText:     { fontSize: 12, color: '#555' },
  chipTextActive: { color: '#fff', fontWeight: '500' },
  totalsBox:    { marginTop: 10, padding: 10, backgroundColor: '#f8f9fa', borderRadius: 8 },
  totalRow:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  totalLabel:   { fontSize: 13, color: '#666' },
  submitBtn:    { marginHorizontal: 10, marginTop: 14, backgroundColor: '#2f9e44', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  submitBtnText:{ color: '#fff', fontSize: 16, fontWeight: '600' },
  emptyText:    { textAlign: 'center', color: '#999', padding: 20 },
  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 12, width: '100%', maxWidth: 500, maxHeight: '85%', padding: 16 },
  modalHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle:   { fontSize: 17, fontWeight: '600', color: '#333' },
  modalClose:   { fontSize: 22, color: '#999', paddingHorizontal: 8 },
  modalSearch:  { height: 38, backgroundColor: '#f2f2f2', borderRadius: 8, paddingHorizontal: 12, fontSize: 14, marginBottom: 8, color: '#333' },
  pickerRow:    { paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: '#f0f0f0' },
  pickerName:   { fontSize: 14, fontWeight: '500', color: '#333' },
  pickerSub:    { fontSize: 12, color: '#888', marginTop: 2 },
});

export default NewPurchaseScreen;
