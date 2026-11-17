import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, FlatList, Alert, Modal } from 'react-native';
import type { Supplier, PurchaseOrder } from '../../models/Supplier';
import { supplierService } from '../../services/supplier/supplierService';
import { verifyGSTIN } from '../../services/gst/gstVerificationService';

const SAMPLE_SUPPLIERS: Supplier[] = [
  {
    id: 'sup_1',
    name: 'Rajesh Wholesale',
    phone: '9876543210',
    address: 'Main Market, 2nd Street',
    city: 'Bangalore',
    paymentTerms: 'credit',
    creditDays: 30,
    isActive: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'sup_2',
    name: 'Priya Distribution',
    phone: '9876543211',
    address: 'Commercial Road',
    city: 'Bangalore',
    paymentTerms: 'cash',
    isActive: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

export function SupplierScreen() {
  const [suppliers, setSuppliers] = useState<Supplier[]>(SAMPLE_SUPPLIERS);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [activeTab, setActiveTab] = useState<'suppliers' | 'purchase_orders'>('suppliers');
  const [showModal, setShowModal] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [gstInfo, setGstInfo] = useState<{name: string, valid: boolean} | null>(null);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [showPOModal, setShowPOModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    city: '',
    gstNumber: '',
  });

  const handleGSTChange = (gstNumber: string) => {
    setFormData(prev => ({ ...prev, gstNumber }));
    if (gstNumber.length === 15) {
        const result = verifyGSTIN(gstNumber);
        setGstInfo({ name: result.stateName || 'Invalid State', valid: result.valid });
    } else {
        setGstInfo(null);
    }
  };

  const resetForm = () => {
    setFormData({ name: '', phone: '', address: '', city: '', gstNumber: '' });
    setSelectedSupplier(null);
  };

  const handleSave = () => {
    if (!formData.name || !formData.phone) {
      Alert.alert('Validation Error', 'Name and Phone are required');
      return;
    }

    if (selectedSupplier) {
      // Update
      setSuppliers(prev =>
        prev.map(s =>
          s.id === selectedSupplier.id
            ? { ...s, ...formData, updatedAt: Date.now() }
            : s
        )
      );
      Alert.alert('Success', 'Supplier updated');
    } else {
      // Create
      const newSupplier = supplierService.createSupplier({
        ...formData,
        paymentTerms: 'credit',
        isActive: true,
      });
      setSuppliers(prev => [...prev, newSupplier]);
      Alert.alert('Success', 'Supplier added');
    }

    resetForm();
    setShowModal(false);
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete', 'Are you sure?', [
      { text: 'Cancel' },
      {
        text: 'Delete',
        onPress: () => setSuppliers(prev => prev.filter(s => s.id !== id)),
      },
    ]);
  };

  const handleEdit = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setFormData({
      name: supplier.name,
      phone: supplier.phone,
      address: supplier.address,
      city: supplier.city,
      gstNumber: supplier.gstNumber || '',
    });
    setShowModal(true);
  };

  const handleCreatePO = (supplierId: string) => {
    const supplier = suppliers.find(s => s.id === supplierId);
    if (!supplier) return;

    // Use dummy data that looks realistic for visual check
    const po = supplierService.createPurchaseOrder(
      supplierId,
      [
        { productId: 'prod1', productName: 'Basmati Rice 25kg', quantity: 10, unit: 'bag', costPrice: 1250 },
        { productId: 'prod2', productName: 'Sunflower Oil', quantity: 5, unit: 'carton', costPrice: 900 },
        { productId: 'prod3', productName: 'Toor Dal Premium', quantity: 50, unit: 'kg', costPrice: 110 },
      ],
      Date.now() + 7 * 24 * 60 * 60 * 1000
    );

    setPurchaseOrders(prev => [...prev, po]);
    Alert.alert('Success', 'Purchase order created');
    setActiveTab('purchase_orders');
  };

  return (
    <View style={styles.container}>
      {/* Tabs */}
      <View style={styles.tabsContainer}>
        {(['suppliers', 'purchase_orders'] as const).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabLabel, activeTab === tab && styles.activeTabLabel]}>
              {tab === 'suppliers' ? 'Suppliers' : 'POs'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'suppliers' && (
        <View style={styles.content}>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => {
              resetForm();
              setShowModal(true);
            }}
          >
            <Text style={styles.addButtonText}>+ Add Supplier</Text>
          </TouchableOpacity>

          <FlatList
            data={suppliers}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <View style={styles.supplierCard}>
                <View style={styles.supplierHeader}>
                  <View style={styles.supplierInfo}>
                    <Text style={styles.supplierName}>{item.name}</Text>
                    <Text style={styles.supplierDetail}>📞 {item.phone}</Text>
                    <Text style={styles.supplierDetail}>📍 {item.city}</Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: item.isActive ? '#4CAF50' : '#ccc' }]}>
                    <Text style={styles.badgeText}>{item.isActive ? 'Active' : 'Inactive'}</Text>
                  </View>
                </View>

                <View style={styles.supplierActions}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.primaryButton]}
                    onPress={() => handleCreatePO(item.id)}
                  >
                    <Text style={styles.actionButtonText}>Create PO</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionButton, styles.secondaryButton]} onPress={() => handleEdit(item)}>
                    <Text style={styles.actionButtonText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.dangerButton]}
                    onPress={() => handleDelete(item.id)}
                  >
                    <Text style={styles.actionButtonText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            scrollEnabled={false}
          />
        </View>
      )}

      {activeTab === 'purchase_orders' && (
        <ScrollView style={styles.content}>
          {purchaseOrders.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No purchase orders yet</Text>
              <Text style={{color: '#aaa', fontSize: 12, marginTop: 4}}>Go to Suppliers tab and tap "Create PO"</Text>
            </View>
          ) : (
            purchaseOrders.map(po => {
              const supplier = suppliers.find(s => s.id === po.supplierId);
              const daysLeft = supplierService.daysUntilDelivery(po);
              const isOverdue = supplierService.isOverdue(po);

              return (
                <TouchableOpacity key={po.id} style={styles.poCard} activeOpacity={0.7}
                  onPress={() => { setSelectedPO(po); setShowPOModal(true); }}>
                  <View style={styles.poHeader}>
                    <View>
                      <Text style={styles.poId}>PO {po.id.slice(0, 8)}</Text>
                      <Text style={styles.supplierName}>{supplier?.name}</Text>
                    </View>
                    <View style={[styles.badge, { backgroundColor: isOverdue ? '#FF5252' : po.status === 'delivered' ? '#4CAF50' : '#FFC107' }]}>
                      <Text style={styles.badgeText}>{po.status.toUpperCase()}</Text>
                    </View>
                  </View>

                  {/* Products shown outside — quick glance */}
                  <View style={styles.productsList}>
                    {po.products.map((p: any, idx: number) => (
                      <View key={idx} style={styles.productChip}>
                        <Text style={styles.productChipText}>
                          {p.productName || 'Item ' + (idx + 1)} × {p.quantity} {p.unit}
                        </Text>
                        <Text style={styles.productChipPrice}>₹{(p.quantity * p.costPrice).toFixed(0)}</Text>
                      </View>
                    ))}
                  </View>

                  <View style={styles.poFooter}>
                    <Text style={styles.poTotal}>Total: ₹{po.totalAmount.toFixed(2)}</Text>
                    <Text style={[styles.poDays, isOverdue && styles.overdueText]}>
                      {daysLeft > 0 ? `${daysLeft}d left` : 'Overdue'}
                    </Text>
                  </View>
                  <Text style={{fontSize: 10, color: '#aaa', textAlign: 'right', marginTop: 4}}>Tap for full details →</Text>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}

      {/* PO Details Modal */}
      <Modal visible={showPOModal} animationType="slide" transparent>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            {selectedPO && (() => {
              const supplier = suppliers.find(s => s.id === selectedPO.supplierId);
              const daysLeft = supplierService.daysUntilDelivery(selectedPO);
              const isOverdue = supplierService.isOverdue(selectedPO);
              return (
                <>
                  <Text style={styles.modalTitle}>Purchase Order Details</Text>

                  <View style={{backgroundColor: '#f5f5f5', borderRadius: 8, padding: 12, marginBottom: 12}}>
                    <View style={styles.poDetailRow}><Text style={styles.label}>PO Number</Text><Text style={styles.value}>{selectedPO.id.slice(0, 8)}</Text></View>
                    <View style={styles.poDetailRow}><Text style={styles.label}>Supplier</Text><Text style={styles.value}>{supplier?.name}</Text></View>
                    <View style={styles.poDetailRow}><Text style={styles.label}>Phone</Text><Text style={styles.value}>{supplier?.phone}</Text></View>
                    <View style={styles.poDetailRow}><Text style={styles.label}>Status</Text><Text style={[styles.value, {color: isOverdue ? '#F44336' : '#4CAF50'}]}>{selectedPO.status.toUpperCase()}</Text></View>
                    <View style={styles.poDetailRow}><Text style={styles.label}>Created</Text><Text style={styles.value}>{new Date(selectedPO.createdAt).toLocaleDateString()}</Text></View>
                    <View style={styles.poDetailRow}><Text style={styles.label}>Delivery</Text><Text style={[styles.value, isOverdue && styles.overdueText]}>{daysLeft > 0 ? `${daysLeft} days left` : 'Overdue'}</Text></View>
                  </View>

                  <Text style={{fontSize: 13, fontWeight: '700', color: '#333', marginBottom: 8}}>Items Ordered</Text>
                  <ScrollView style={{maxHeight: 200}}>
                    {selectedPO.products.map((p: any, idx: number) => (
                      <View key={idx} style={{flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0'}}>
                        <View style={{flex: 1}}>
                          <Text style={{fontSize: 14, fontWeight: '600', color: '#333'}}>{p.productName || 'Item ' + (idx + 1)}</Text>
                          <Text style={{fontSize: 12, color: '#888'}}>{p.quantity} {p.unit} @ ₹{p.costPrice}/{p.unit}</Text>
                        </View>
                        <Text style={{fontSize: 14, fontWeight: '700', color: '#2196F3'}}>₹{(p.quantity * p.costPrice).toFixed(2)}</Text>
                      </View>
                    ))}
                  </ScrollView>

                  <View style={{backgroundColor: '#E8F5E9', borderRadius: 8, padding: 12, marginTop: 12}}>
                    <View style={styles.poDetailRow}>
                      <Text style={{fontSize: 16, fontWeight: '700', color: '#333'}}>Grand Total</Text>
                      <Text style={{fontSize: 16, fontWeight: '700', color: '#2E7D32'}}>₹{selectedPO.totalAmount.toFixed(2)}</Text>
                    </View>
                  </View>
                </>
              );
            })()}

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setShowPOModal(false)}>
                <Text style={styles.modalButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{selectedSupplier ? 'Edit Supplier' : 'Add Supplier'}</Text>

            <ScrollView>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Supplier Name *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.name}
                  onChangeText={name => setFormData(prev => ({ ...prev, name }))}
                  placeholder="Enter name"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Phone Number *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.phone}
                  onChangeText={phone => setFormData(prev => ({ ...prev, phone }))}
                  placeholder="10-digit number"
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Address</Text>
                <TextInput
                  style={[styles.input, { height: 60 }]}
                  value={formData.address}
                  onChangeText={address => setFormData(prev => ({ ...prev, address }))}
                  placeholder="Street address"
                  multiline
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>City</Text>
                <TextInput
                  style={styles.input}
                  value={formData.city}
                  onChangeText={city => setFormData(prev => ({ ...prev, city }))}
                  placeholder="City name"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>GST Number</Text>
                <TextInput
                  style={styles.input}
                  value={formData.gstNumber}
                  onChangeText={handleGSTChange}
                  placeholder="29ABCXY1234H1Z0"
                />
                {gstInfo && (
                  <Text style={{color: gstInfo.valid ? 'green' : 'red', fontSize: 12, marginTop: 4}}>
                    {gstInfo.valid ? 'Valid GSTIN: ' + gstInfo.name : 'Invalid GSTIN format'}
                  </Text>
                )}
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setShowModal(false)}>
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={handleSave}>
                <Text style={styles.modalButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#2196F3',
  },
  tabLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  activeTabLabel: {
    color: '#2196F3',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  addButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    marginBottom: 12,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  supplierCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  supplierHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  supplierInfo: {
    flex: 1,
  },
  supplierName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  supplierDetail: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  supplierActions: {
    flexDirection: 'row',
    gap: 6,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 4,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#2196F3',
  },
  secondaryButton: {
    backgroundColor: '#FF9800',
  },
  dangerButton: {
    backgroundColor: '#F44336',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  poCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  poHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  poId: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  poDetails: {
    backgroundColor: '#f5f5f5',
    padding: 8,
    borderRadius: 4,
  },
  poDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  label: {
    fontSize: 12,
    color: '#666',
  },
  value: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  overdueText: {
    color: '#F44336',
  },
  emptyState: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#999',
  },
  productsList: {
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#f0f0f0',
    marginVertical: 8,
  },
  productChip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  productChipText: {
    fontSize: 13,
    color: '#555',
  },
  productChipPrice: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  poFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
  },
  poTotal: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2E7D32',
  },
  poDays: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    color: '#333',
  },
  formGroup: {
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#e0e0e0',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
  },
  modalButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});

