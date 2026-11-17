/**
 * PurchaseDetailScreen — View a purchase, its items, payments, and record payments.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Alert, ActivityIndicator, TextInput, Modal,
} from 'react-native';
import {
  getPurchase, getSupplierPayments, recordSupplierPayment, deletePurchase,
} from '../../services/firebase/firestoreService';
import type { Purchase, SupplierPayment } from '../../models/Supplier';
import { SUPPLIER_PAYMENT_MODES } from '../../models/Supplier';
import { useSession } from '../../context/SessionContext';

const round2 = (n: number) => Math.round(n * 100) / 100;
const statusColor = (s: string) =>
  s === 'paid' ? '#2f9e44' : s === 'partial' ? '#e67700' : '#e03131';

const PurchaseDetailScreen: React.FC<{ route?: any; navigation?: any }> = ({ route, navigation }) => {
  const purchaseId = route?.params?.purchaseId;
  const { staff } = useSession();

  const [purchase, setPurchase]   = useState<Purchase | null>(null);
  const [payments, setPayments]   = useState<SupplierPayment[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showPay, setShowPay]     = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode]     = useState<string>('CASH');
  const [payRef, setPayRef]       = useState('');
  const [payNote, setPayNote]     = useState('');
  const [paying, setPaying]       = useState(false);

  const load = useCallback(async () => {
    if (!purchaseId) return;
    const [p, pays] = await Promise.all([
      getPurchase(purchaseId),
      getSupplierPayments({ purchaseId }),
    ]);
    setPurchase(p);
    setPayments(pays);
  }, [purchaseId]);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  const handlePay = useCallback(async () => {
    if (!purchase) return;
    const amount = parseFloat(payAmount);
    if (!(amount > 0)) { Alert.alert('Enter amount'); return; }
    setPaying(true);
    try {
      await recordSupplierPayment({
        supplierId: purchase.supplierId,
        amount,
        mode: payMode,
        purchaseId: purchase.id,
        reference: payRef.trim() || undefined,
        note: payNote.trim() || undefined,
        paidBy: staff?.name ?? 'Staff',
      });
      setShowPay(false);
      setPayAmount(''); setPayRef(''); setPayNote('');
      await load();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : String(e));
    } finally {
      setPaying(false);
    }
  }, [purchase, payAmount, payMode, payRef, payNote, staff, load]);

  const handleDelete = useCallback(() => {
    if (!purchase) return;
    Alert.alert(
      'Delete purchase?',
      'This will reverse the stock changes. Only unpaid purchases can be deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              await deletePurchase(purchase.id);
              Alert.alert('Deleted', '', [{ text: 'OK', onPress: () => navigation?.goBack() }]);
            } catch (e) {
              Alert.alert('Cannot delete', e instanceof Error ? e.message : String(e));
            }
          },
        },
      ],
    );
  }, [purchase, navigation]);

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color="#3B5BDB" />
    </View>
  );

  if (!purchase) return (
    <View style={styles.center}>
      <Text style={{ color: '#999' }}>Purchase not found</Text>
    </View>
  );

  const balance = round2(purchase.grandTotal - purchase.amountPaid);

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation?.goBack()}>
          <Text style={styles.backBtn}>← Back</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle}>{purchase.purchaseNo}</Text>
          <Text style={styles.headerSub}>{purchase.supplierName}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColor(purchase.paymentStatus) + '30' }]}>
          <Text style={[styles.statusText, { color: statusColor(purchase.paymentStatus) }]}>
            {purchase.paymentStatus.toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Info */}
      <View style={styles.section}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Invoice</Text>
          <Text style={styles.infoValue}>{purchase.invoiceNo || '—'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Date</Text>
          <Text style={styles.infoValue}>{purchase.invoiceDate}</Text>
        </View>
        {purchase.notes && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Notes</Text>
            <Text style={styles.infoValue}>{purchase.notes}</Text>
          </View>
        )}
      </View>

      {/* Items */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Items ({purchase.items.length})</Text>
        {purchase.items.map((it, idx) => (
          <View key={idx} style={styles.itemRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{it.name}</Text>
              <Text style={styles.itemSub}>{it.qty} {it.unit} × ₹{it.costPrice} + {it.gstPercent}% GST</Text>
            </View>
            <Text style={styles.itemTotal}>₹{it.total.toFixed(2)}</Text>
          </View>
        ))}
      </View>

      {/* Totals */}
      <View style={styles.section}>
        <View style={styles.totalRow}><Text style={styles.totalLabel}>Subtotal</Text><Text>₹{purchase.subtotal.toFixed(2)}</Text></View>
        <View style={styles.totalRow}><Text style={styles.totalLabel}>GST</Text><Text>₹{purchase.totalGst.toFixed(2)}</Text></View>
        {purchase.otherCharges > 0 && <View style={styles.totalRow}><Text style={styles.totalLabel}>Other charges</Text><Text>₹{purchase.otherCharges.toFixed(2)}</Text></View>}
        {purchase.discount > 0 && <View style={styles.totalRow}><Text style={styles.totalLabel}>Discount</Text><Text style={{color:'#e03131'}}>−₹{purchase.discount.toFixed(2)}</Text></View>}
        <View style={[styles.totalRow, styles.grandRow]}>
          <Text style={styles.grandLabel}>Grand Total</Text>
          <Text style={styles.grandValue}>₹{purchase.grandTotal.toFixed(2)}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Paid</Text>
          <Text style={{ color: '#2f9e44', fontWeight: '600' }}>₹{purchase.amountPaid.toFixed(2)}</Text>
        </View>
        {balance > 0.009 && (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Balance due</Text>
            <Text style={{ color: '#e03131', fontWeight: '600' }}>₹{balance.toFixed(2)}</Text>
          </View>
        )}
      </View>

      {/* Payments */}
      {payments.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment History</Text>
          {payments.map(p => (
            <View key={p.id} style={styles.paymentRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.paymentAmount}>₹{p.amount.toFixed(2)} ({p.mode})</Text>
                <Text style={styles.paymentSub}>
                  {new Date(p.paidAt).toLocaleDateString('en-IN')}
                  {p.reference ? ` · Ref: ${p.reference}` : ''}
                  {p.note ? ` · ${p.note}` : ''}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        {balance > 0.009 && (
          <TouchableOpacity style={styles.payBtn} onPress={() => { setPayAmount(balance.toFixed(2)); setShowPay(true); }}>
            <Text style={styles.payBtnText}>Record Payment</Text>
          </TouchableOpacity>
        )}
        {purchase.amountPaid === 0 && (
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
            <Text style={styles.deleteBtnText}>Delete Purchase</Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={{ height: 60 }} />

      {/* Payment modal */}
      <Modal visible={showPay} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Record Payment</Text>
              <TouchableOpacity onPress={() => setShowPay(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.miniLabel}>Amount ₹</Text>
            <TextInput style={styles.input} value={payAmount} onChangeText={setPayAmount} keyboardType="numeric" placeholder="0" placeholderTextColor="#aaa" />
            <Text style={styles.miniLabel}>Mode</Text>
            <View style={styles.chipRow}>
              {SUPPLIER_PAYMENT_MODES.map(m => (
                <TouchableOpacity key={m} style={[styles.chip, payMode === m && styles.chipActive]} onPress={() => setPayMode(m)}>
                  <Text style={[styles.chipText, payMode === m && styles.chipTextActive]}>{m}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.miniLabel}>Reference</Text>
            <TextInput style={styles.input} value={payRef} onChangeText={setPayRef} placeholder="Cheque no / UPI ID" placeholderTextColor="#aaa" />
            <Text style={styles.miniLabel}>Note</Text>
            <TextInput style={styles.input} value={payNote} onChangeText={setPayNote} placeholder="optional" placeholderTextColor="#aaa" />
            <TouchableOpacity style={[styles.payBtn, { marginTop: 16 }, paying && { opacity: 0.6 }]} onPress={handlePay} disabled={paying}>
              {paying ? <ActivityIndicator color="#fff" /> : <Text style={styles.payBtnText}>Pay ₹{parseFloat(payAmount) || 0}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#f8f9fa' },
  center:       { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:       { backgroundColor: '#3B5BDB', paddingHorizontal: 16, paddingVertical: 14, paddingTop: 20, flexDirection: 'row', alignItems: 'center' },
  backBtn:      { color: '#fff', fontSize: 16 },
  headerTitle:  { fontSize: 18, fontWeight: '700', color: '#fff' },
  headerSub:    { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  statusBadge:  { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  statusText:   { fontSize: 12, fontWeight: '600' },
  section:      { backgroundColor: '#fff', margin: 10, marginBottom: 0, borderRadius: 10, padding: 14 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: '#666', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  infoRow:      { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  infoLabel:    { fontSize: 13, color: '#888' },
  infoValue:    { fontSize: 13, color: '#333', fontWeight: '500' },
  itemRow:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: '#f0f0f0' },
  itemName:     { fontSize: 14, fontWeight: '500', color: '#333' },
  itemSub:      { fontSize: 12, color: '#888', marginTop: 2 },
  itemTotal:    { fontSize: 14, fontWeight: '600', color: '#3B5BDB' },
  totalRow:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  totalLabel:   { fontSize: 13, color: '#666' },
  grandRow:     { borderTopWidth: 0.5, borderTopColor: '#ddd', marginTop: 6, paddingTop: 6 },
  grandLabel:   { fontSize: 15, fontWeight: '600', color: '#333' },
  grandValue:   { fontSize: 15, fontWeight: '700', color: '#3B5BDB' },
  paymentRow:   { paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: '#f0f0f0' },
  paymentAmount:{ fontSize: 14, fontWeight: '500', color: '#2f9e44' },
  paymentSub:   { fontSize: 12, color: '#888', marginTop: 2 },
  actions:      { margin: 10, gap: 8 },
  payBtn:       { backgroundColor: '#3B5BDB', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  payBtnText:   { color: '#fff', fontSize: 15, fontWeight: '600' },
  deleteBtn:    { borderWidth: 1, borderColor: '#e03131', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  deleteBtnText:{ color: '#e03131', fontSize: 14, fontWeight: '500' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 12, width: '100%', maxWidth: 420, padding: 16 },
  modalHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle:   { fontSize: 17, fontWeight: '600', color: '#333' },
  modalClose:   { fontSize: 22, color: '#999', paddingHorizontal: 8 },
  miniLabel:    { fontSize: 11, color: '#888', marginTop: 8, marginBottom: 2 },
  input:        { backgroundColor: '#f2f2f2', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: '#333' },
  chipRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  chip:         { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 0.5, borderColor: '#ddd' },
  chipActive:   { backgroundColor: '#3B5BDB', borderColor: '#3B5BDB' },
  chipText:     { fontSize: 12, color: '#555' },
  chipTextActive:{ color: '#fff', fontWeight: '500' },
});

export default PurchaseDetailScreen;
