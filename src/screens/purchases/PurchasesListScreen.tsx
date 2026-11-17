/**
 * PurchasesListScreen — List of all stock-in purchases with filters.
 * Navigates to NewPurchase and PurchaseDetail.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, RefreshControl,
} from 'react-native';
import {
  getPurchases, getSuppliers,
} from '../../services/firebase/firestoreService';
import type { Purchase, Supplier, PurchasePaymentStatus } from '../../models/Supplier';

type Filter = 'all' | 'due' | PurchasePaymentStatus;

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all',     label: 'All' },
  { key: 'due',     label: 'Due' },
  { key: 'paid',    label: 'Paid' },
  { key: 'partial', label: 'Partial' },
  { key: 'unpaid',  label: 'Unpaid' },
];

const statusColor = (s: PurchasePaymentStatus) =>
  s === 'paid' ? '#2f9e44' : s === 'partial' ? '#e67700' : '#e03131';

const PurchasesListScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [filter, setFilter]       = useState<Filter>('all');
  const [search, setSearch]       = useState('');
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [p, s] = await Promise.all([getPurchases(), getSuppliers()]);
    setPurchases(p); setSuppliers(s);
  }, []);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const filtered = useMemo(() => {
    let list = purchases;
    if (filter === 'due') list = list.filter(p => p.paymentStatus !== 'paid');
    else if (filter !== 'all') list = list.filter(p => p.paymentStatus === filter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.supplierName.toLowerCase().includes(q) ||
        p.purchaseNo.toLowerCase().includes(q) ||
        (p.invoiceNo ?? '').toLowerCase().includes(q));
    }
    return list;
  }, [purchases, filter, search]);

  const totalDue = useMemo(() =>
    purchases.reduce((s, p) => s + Math.max(0, p.grandTotal - p.amountPaid), 0),
  [purchases]);

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color="#3B5BDB" />
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Purchases</Text>
        <Text style={styles.headerSub}>
          {purchases.length} purchases · ₹{totalDue.toFixed(0)} due
        </Text>
      </View>

      {/* Search + New */}
      <View style={styles.toolbar}>
        <TextInput
          style={styles.searchInput}
          placeholder="🔍 Search purchases…"
          value={search}
          onChangeText={setSearch}
          placeholderTextColor="#aaa"
        />
        <TouchableOpacity
          style={styles.newBtn}
          onPress={() => navigation?.navigate('NewPurchase')}
        >
          <Text style={styles.newBtnText}>+ New</Text>
        </TouchableOpacity>
      </View>

      {/* Filters */}
      <View style={styles.filterRow}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterBtn, filter === f.key && styles.filterActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={p => p.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        renderItem={({ item: p }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation?.navigate('PurchaseDetail', { purchaseId: p.id })}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{p.supplierName}</Text>
              <Text style={styles.cardSub}>
                {p.purchaseNo} · {p.invoiceDate}
                {p.invoiceNo ? ` · Inv ${p.invoiceNo}` : ''}
              </Text>
              <Text style={styles.cardItems}>{p.items.length} items</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.cardAmount}>₹{p.grandTotal.toFixed(2)}</Text>
              <View style={[styles.statusBadge, { backgroundColor: statusColor(p.paymentStatus) + '20' }]}>
                <Text style={[styles.statusText, { color: statusColor(p.paymentStatus) }]}>
                  {p.paymentStatus.toUpperCase()}
                </Text>
              </View>
              {p.amountPaid > 0 && p.paymentStatus !== 'paid' && (
                <Text style={styles.cardPaid}>paid ₹{p.amountPaid.toFixed(2)}</Text>
              )}
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>No purchases yet</Text>}
        contentContainerStyle={{ paddingBottom: 100 }}
      />

      {/* Supplier link */}
      <TouchableOpacity
        style={styles.supplierLink}
        onPress={() => navigation?.navigate('SuppliersList')}
      >
        <Text style={styles.supplierLinkText}>📋 View Suppliers ({suppliers.length})</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#f8f9fa' },
  center:       { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:       { backgroundColor: '#3B5BDB', paddingHorizontal: 16, paddingVertical: 14, paddingTop: 20 },
  headerTitle:  { fontSize: 20, fontWeight: '700', color: '#fff' },
  headerSub:    { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  toolbar:      { flexDirection: 'row', padding: 10, gap: 8, backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#eee' },
  searchInput:  { flex: 1, height: 36, backgroundColor: '#f2f2f2', borderRadius: 8, paddingHorizontal: 12, fontSize: 14, color: '#333' },
  newBtn:       { backgroundColor: '#2f9e44', borderRadius: 8, paddingHorizontal: 16, justifyContent: 'center' },
  newBtnText:   { color: '#fff', fontWeight: '600', fontSize: 14 },
  filterRow:    { flexDirection: 'row', paddingHorizontal: 10, paddingVertical: 8, gap: 6, backgroundColor: '#fff' },
  filterBtn:    { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 6, borderWidth: 0.5, borderColor: '#ddd' },
  filterActive: { backgroundColor: '#3B5BDB', borderColor: '#3B5BDB' },
  filterText:   { fontSize: 13, color: '#555' },
  filterTextActive: { color: '#fff', fontWeight: '500' },
  card:         { flexDirection: 'row', backgroundColor: '#fff', marginHorizontal: 10, marginTop: 8, borderRadius: 10, padding: 14, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  cardTitle:    { fontSize: 15, fontWeight: '600', color: '#333' },
  cardSub:      { fontSize: 12, color: '#888', marginTop: 2 },
  cardItems:    { fontSize: 12, color: '#aaa', marginTop: 2 },
  cardAmount:   { fontSize: 15, fontWeight: '700', color: '#333' },
  statusBadge:  { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginTop: 4 },
  statusText:   { fontSize: 11, fontWeight: '600' },
  cardPaid:     { fontSize: 11, color: '#888', marginTop: 2 },
  emptyText:    { textAlign: 'center', color: '#999', padding: 40, fontSize: 14 },
  supplierLink: { position: 'absolute', bottom: 80, right: 16, backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 6, elevation: 3 },
  supplierLinkText: { fontSize: 14, fontWeight: '500', color: '#3B5BDB' },
});

export default PurchasesListScreen;
