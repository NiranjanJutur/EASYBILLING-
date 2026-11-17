/**
 * SuppliersListScreen — List, add, edit, archive suppliers. View dues.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, RefreshControl, Alert, Modal, ScrollView,
} from 'react-native';
import {
  getSuppliers, addSupplier, updateSupplier, archiveSupplier, getPurchases,
} from '../../services/firebase/firestoreService';
import type { Supplier, SupplierInput, Purchase } from '../../models/Supplier';

const SuppliersListScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const [suppliers, setSuppliers]     = useState<Supplier[]>([]);
  const [purchases, setPurchases]     = useState<Purchase[]>([]);
  const [search, setSearch]           = useState('');
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [showForm, setShowForm]       = useState(false);
  const [editing, setEditing]         = useState<Supplier | null>(null);
  const [saving, setSaving]           = useState(false);

  // Form fields
  const [name, setName]       = useState('');
  const [phone, setPhone]     = useState('');
  const [gstin, setGstin]     = useState('');
  const [address, setAddress] = useState('');

  const load = useCallback(async () => {
    const [s, p] = await Promise.all([getSuppliers(), getPurchases()]);
    setSuppliers(s); setPurchases(p);
  }, []);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true); await load(); setRefreshing(false);
  }, [load]);

  // Compute dues per supplier
  const duesMap = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of purchases) {
      const due = Math.max(0, p.grandTotal - p.amountPaid);
      if (due > 0) m[p.supplierId] = (m[p.supplierId] ?? 0) + due;
    }
    return m;
  }, [purchases]);

  const totalDues = useMemo(() =>
    Object.values(duesMap).reduce((s, v) => s + v, 0), [duesMap]);

  const filtered = useMemo(() => {
    if (!search) return suppliers;
    const q = search.toLowerCase();
    return suppliers.filter(s =>
      s.name.toLowerCase().includes(q) ||
      (s.phone ?? '').includes(q) ||
      (s.gstin ?? '').toLowerCase().includes(q));
  }, [suppliers, search]);

  const openAdd = useCallback(() => {
    setEditing(null);
    setName(''); setPhone(''); setGstin(''); setAddress('');
    setShowForm(true);
  }, []);

  const openEdit = useCallback((s: Supplier) => {
    setEditing(s);
    setName(s.name); setPhone(s.phone ?? ''); setGstin(s.gstin ?? ''); setAddress(s.address ?? '');
    setShowForm(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!name.trim()) { Alert.alert('Name required'); return; }
    setSaving(true);
    try {
      const data: SupplierInput = {
        name: name.trim(),
        phone: phone.trim() || undefined,
        gstin: gstin.trim() || undefined,
        address: address.trim() || undefined,
      };
      if (editing) {
        await updateSupplier(editing.id, data);
      } else {
        await addSupplier(data);
      }
      setShowForm(false);
      await load();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [editing, name, phone, gstin, address, load]);

  const handleArchive = useCallback((s: Supplier) => {
    Alert.alert(
      'Archive supplier?',
      `${s.name} will be hidden from lists. This can be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive', style: 'destructive',
          onPress: async () => {
            try { await archiveSupplier(s.id); await load(); }
            catch (e) { Alert.alert('Error', e instanceof Error ? e.message : String(e)); }
          },
        },
      ],
    );
  }, [load]);

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color="#3B5BDB" />
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation?.goBack()}>
          <Text style={styles.backBtn}>← Back</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle}>Suppliers</Text>
          <Text style={styles.headerSub}>
            {suppliers.length} suppliers · ₹{totalDues.toFixed(0)} total dues
          </Text>
        </View>
      </View>

      {/* Search + Add */}
      <View style={styles.toolbar}>
        <TextInput
          style={styles.searchInput}
          placeholder="🔍 Search suppliers…"
          value={search}
          onChangeText={setSearch}
          placeholderTextColor="#aaa"
        />
        <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={s => s.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        renderItem={({ item: s }) => {
          const due = duesMap[s.id] ?? 0;
          return (
            <TouchableOpacity style={styles.card} onPress={() => openEdit(s)} onLongPress={() => handleArchive(s)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName}>{s.name}</Text>
                <Text style={styles.cardSub}>
                  {s.phone ?? ''}
                  {s.gstin ? ` · ${s.gstin}` : ''}
                </Text>
                {s.address ? <Text style={styles.cardAddr}>{s.address}</Text> : null}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                {due > 0 ? (
                  <Text style={styles.dueAmount}>₹{due.toFixed(0)} due</Text>
                ) : (
                  <Text style={styles.clearedText}>Clear</Text>
                )}
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={<Text style={styles.emptyText}>No suppliers yet. Tap + Add to create one.</Text>}
        contentContainerStyle={{ paddingBottom: 100 }}
      />

      {/* Add/Edit Modal */}
      <Modal visible={showForm} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{editing ? 'Edit Supplier' : 'New Supplier'}</Text>
                <TouchableOpacity onPress={() => setShowForm(false)}>
                  <Text style={styles.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.miniLabel}>Name *</Text>
              <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Supplier name" placeholderTextColor="#aaa" />

              <Text style={styles.miniLabel}>Phone</Text>
              <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="Phone number" keyboardType="phone-pad" placeholderTextColor="#aaa" />

              <Text style={styles.miniLabel}>GSTIN</Text>
              <TextInput style={styles.input} value={gstin} onChangeText={setGstin} placeholder="GST number" autoCapitalize="characters" placeholderTextColor="#aaa" />

              <Text style={styles.miniLabel}>Address</Text>
              <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="Address" multiline placeholderTextColor="#aaa" />

              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? <ActivityIndicator color="#fff" /> : (
                  <Text style={styles.saveBtnText}>{editing ? 'Update' : 'Add Supplier'}</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#f8f9fa' },
  center:       { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:       { backgroundColor: '#3B5BDB', paddingHorizontal: 16, paddingVertical: 14, paddingTop: 20, flexDirection: 'row', alignItems: 'center' },
  backBtn:      { color: '#fff', fontSize: 16 },
  headerTitle:  { fontSize: 20, fontWeight: '700', color: '#fff' },
  headerSub:    { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  toolbar:      { flexDirection: 'row', padding: 10, gap: 8, backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#eee' },
  searchInput:  { flex: 1, height: 36, backgroundColor: '#f2f2f2', borderRadius: 8, paddingHorizontal: 12, fontSize: 14, color: '#333' },
  addBtn:       { backgroundColor: '#2f9e44', borderRadius: 8, paddingHorizontal: 16, justifyContent: 'center' },
  addBtnText:   { color: '#fff', fontWeight: '600', fontSize: 14 },
  card:         { flexDirection: 'row', backgroundColor: '#fff', marginHorizontal: 10, marginTop: 8, borderRadius: 10, padding: 14, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  cardName:     { fontSize: 15, fontWeight: '600', color: '#333' },
  cardSub:      { fontSize: 12, color: '#888', marginTop: 2 },
  cardAddr:     { fontSize: 12, color: '#aaa', marginTop: 2 },
  dueAmount:    { fontSize: 14, fontWeight: '600', color: '#e03131' },
  clearedText:  { fontSize: 13, color: '#2f9e44', fontWeight: '500' },
  emptyText:    { textAlign: 'center', color: '#999', padding: 40, fontSize: 14 },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 12, width: '100%', maxWidth: 420, maxHeight: '80%', padding: 16 },
  modalHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle:   { fontSize: 17, fontWeight: '600', color: '#333' },
  modalClose:   { fontSize: 22, color: '#999', paddingHorizontal: 8 },
  miniLabel:    { fontSize: 11, color: '#888', marginTop: 10, marginBottom: 2 },
  input:        { backgroundColor: '#f2f2f2', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: '#333' },
  saveBtn:      { backgroundColor: '#3B5BDB', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  saveBtnText:  { color: '#fff', fontSize: 15, fontWeight: '600' },
});

export default SuppliersListScreen;
