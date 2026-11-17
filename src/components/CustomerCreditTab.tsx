import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, FlatList, Alert, Modal } from 'react-native';
import type { CustomerCredit, CreditTransaction } from '../models/CustomerCredit';
import { customerCreditService } from '../services/credit/customerCreditService';
import { COLORS, SPACING, RADIUS, FONT_SIZE, FONT_WEIGHT } from '../config/theme';

interface CreditTabProps {
  customerId: string;
}

export function CustomerCreditTab({ customerId }: CreditTabProps) {
  const [credit, setCredit] = useState<CustomerCredit>({
    customerId,
    totalCredit: 5000,
    outstanding: 2500,
    creditLimit: 10000,
    lastPaymentDate: Date.now() - 7 * 24 * 60 * 60 * 1000,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  const [transactions, setTransactions] = useState<CreditTransaction[]>([
    {
      id: 'tx_1',
      customerId,
      billId: 'bill_001',
      type: 'debit',
      amount: 1500,
      balance: 2500,
      timestamp: Date.now() - 24 * 60 * 60 * 1000,
    },
    {
      id: 'tx_2',
      customerId,
      billId: 'bill_002',
      type: 'debit',
      amount: 1000,
      balance: 4000,
      timestamp: Date.now() - 5 * 24 * 60 * 60 * 1000,
    },
  ]);

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [newLimit, setNewLimit] = useState(credit.creditLimit.toString());

  const status = customerCreditService.getCreditStatus(credit);
  const available = customerCreditService.availableCredit(credit);
  const daysSincePayment = customerCreditService.daysSinceLastPayment(credit);

  const getStatusColor = () => {
    switch (status) {
      case 'good': return COLORS.SUCCESS;
      case 'warning': return COLORS.WARNING;
      case 'overdue': return COLORS.ERROR;
      default: return COLORS.TEXT_DIM;
    }
  };

  const handlePayment = () => {
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) {
      Alert.alert('Error', 'Enter a valid amount');
      return;
    }
    const { updated, transaction } = customerCreditService.recordPayment(credit, amount);
    setCredit(updated);
    setTransactions(prev => [transaction, ...prev]);
    setPaymentAmount('');
    setShowPaymentModal(false);
    Alert.alert('Success', `Payment of ₹${amount} recorded`);
  };

  const handleUpdateLimit = () => {
    const newLimitNum = parseInt(newLimit);
    const validation = customerCreditService.validateCreditLimit(newLimitNum);
    if (!validation.isValid) {
      Alert.alert('Validation Error', validation.errors[0]);
      return;
    }
    setCredit(prev => ({ ...prev, creditLimit: newLimitNum, updatedAt: Date.now() }));
    setShowLimitModal(false);
    Alert.alert('Success', 'Credit limit updated');
  };

  const utilizationPercent = (credit.outstanding / credit.creditLimit) * 100;

  return (
    <ScrollView style={styles.container}>
      {/* Status Card */}
      <View style={[styles.statusCard, { borderLeftColor: getStatusColor() }]}>
        <View style={styles.statusRow}>
          <Text style={styles.label}>Status</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor() }]}>
            <Text style={styles.statusText}>{status.toUpperCase()}</Text>
          </View>
        </View>
      </View>

      {/* Credit Summary */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Credit Summary</Text>
        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total Credit</Text>
            <Text style={styles.summaryValue}>{customerCreditService.formatAmount(credit.totalCredit)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Outstanding</Text>
            <Text style={[styles.summaryValue, { color: '#F44336' }]}>
              {customerCreditService.formatAmount(credit.outstanding)}
            </Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Available</Text>
            <Text style={[styles.summaryValue, { color: '#4CAF50' }]}>
              {customerCreditService.formatAmount(available)}
            </Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Credit Limit</Text>
            <Text style={styles.summaryValue}>{customerCreditService.formatAmount(credit.creditLimit)}</Text>
          </View>
        </View>

        {/* Utilization Bar */}
        <View style={styles.utilizationContainer}>
          <View style={styles.utilizationBar}>
            <View
              style={[
                styles.utilizationFill,
                { width: `${Math.min(utilizationPercent, 100)}%` as any, backgroundColor: getStatusColor() },
              ]}
            />
          </View>
          <Text style={styles.utilizationText}>{utilizationPercent.toFixed(0)}% utilized</Text>
        </View>
      </View>

      {/* Last Payment Info */}
      {daysSincePayment !== null && (
        <View style={styles.section}>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Last Payment</Text>
            <Text style={styles.value}>{daysSincePayment} days ago</Text>
          </View>
        </View>
      )}

      {/* Recent Transactions */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Transaction History</Text>
          <Text style={styles.transactionCount}>{transactions.length}</Text>
        </View>

        {transactions.length === 0 ? (
          <Text style={styles.emptyText}>No transactions yet</Text>
        ) : (
          <FlatList
            data={transactions}
            keyExtractor={item => item.id}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <View style={styles.transactionRow}>
                <View style={styles.transactionLeft}>
                  <Text style={styles.transactionType}>
                    {item.type === 'debit' ? '📤 Amount Given' : '📥 Payment Received'}
                  </Text>
                  {item.billId && <Text style={styles.billId}>{item.billId}</Text>}
                  {(item as any).notes && <Text style={styles.notes}>{(item as any).notes}</Text>}
                </View>
                <View style={styles.transactionRight}>
                  <Text style={[styles.amount, { color: item.type === 'debit' ? '#F44336' : '#4CAF50' }]}>
                    {item.type === 'debit' ? '+' : '-'}₹{item.amount.toFixed(2)}
                  </Text>
                  <Text style={styles.balance}>Balance: ₹{item.balance.toFixed(2)}</Text>
                </View>
              </View>
            )}
          />
        )}
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity style={[styles.button, styles.paymentButton]} onPress={() => setShowPaymentModal(true)}>
          <Text style={styles.buttonText}>Record Payment</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.limitButton]} onPress={() => setShowLimitModal(true)}>
          <Text style={styles.buttonText}>Update Limit</Text>
        </TouchableOpacity>
      </View>

      {/* Payment Modal */}
      <Modal visible={showPaymentModal} animationType="slide" transparent>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Record Payment</Text>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Outstanding Amount</Text>
              <Text style={styles.highlightedValue}>{customerCreditService.formatAmount(credit.outstanding)}</Text>
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Payment Amount</Text>
              <TextInput
                style={styles.input}
                value={paymentAmount}
                onChangeText={setPaymentAmount}
                placeholder="Enter amount"
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Remaining After Payment</Text>
              <Text style={styles.highlightedValue}>
                {customerCreditService.formatAmount(Math.max(0, credit.outstanding - (parseFloat(paymentAmount) || 0)))}
              </Text>
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setShowPaymentModal(false)}>
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={handlePayment}>
                <Text style={styles.modalButtonText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Credit Limit Modal */}
      <Modal visible={showLimitModal} animationType="slide" transparent>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Update Credit Limit</Text>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Current Limit</Text>
              <Text style={styles.highlightedValue}>{customerCreditService.formatAmount(credit.creditLimit)}</Text>
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Outstanding</Text>
              <Text style={[styles.highlightedValue, { color: '#F44336' }]}>
                {customerCreditService.formatAmount(credit.outstanding)}
              </Text>
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.label}>New Limit</Text>
              <TextInput
                style={styles.input}
                value={newLimit}
                onChangeText={setNewLimit}
                placeholder="Enter new limit"
                keyboardType="number-pad"
              />
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setShowLimitModal(false)}>
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={handleUpdateLimit}>
                <Text style={styles.modalButtonText}>Update</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BACKGROUND, padding: SPACING.MD },
  statusCard: { backgroundColor: COLORS.WHITE, borderRadius: RADIUS.MD, padding: SPACING.MD, marginBottom: SPACING.LG, borderLeftWidth: 4 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: FONT_SIZE.XS, color: COLORS.TEXT_DIM, fontWeight: FONT_WEIGHT.SEMIBOLD },
  statusBadge: { paddingHorizontal: SPACING.SM, paddingVertical: SPACING.XS, borderRadius: RADIUS.SM },
  statusText: { color: COLORS.WHITE, fontSize: FONT_SIZE.XS, fontWeight: FONT_WEIGHT.SEMIBOLD },
  section: { backgroundColor: COLORS.WHITE, borderRadius: RADIUS.MD, padding: SPACING.MD, marginBottom: SPACING.MD, borderWidth: 1, borderColor: COLORS.BORDER },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: FONT_SIZE.SM, fontWeight: FONT_WEIGHT.SEMIBOLD, color: COLORS.TEXT_HEADING, marginBottom: SPACING.MD },
  transactionCount: { fontSize: FONT_SIZE.XS, color: COLORS.TEXT_DIM },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.SM },
  summaryCard: { flex: 1, minWidth: '48%' as any, backgroundColor: COLORS.SURFACE, padding: SPACING.SM, borderRadius: RADIUS.SM },
  summaryLabel: { fontSize: FONT_SIZE.XS - 1, color: COLORS.TEXT_DIM, marginBottom: 4 },
  summaryValue: { fontSize: FONT_SIZE.SM, fontWeight: FONT_WEIGHT.SEMIBOLD, color: COLORS.TEXT_HEADING },
  utilizationContainer: { marginTop: SPACING.MD },
  utilizationBar: { height: 8, backgroundColor: COLORS.DIVIDER, borderRadius: RADIUS.FULL, overflow: 'hidden' },
  utilizationFill: { height: '100%' as any },
  utilizationText: { fontSize: FONT_SIZE.XS, color: COLORS.TEXT_DIM, marginTop: 4 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between' },
  value: { fontSize: FONT_SIZE.XS, fontWeight: FONT_WEIGHT.SEMIBOLD, color: COLORS.TEXT_HEADING },
  emptyText: { fontSize: FONT_SIZE.XS, color: COLORS.TEXT_DIM, textAlign: 'center', paddingVertical: SPACING.XL },
  transactionRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: SPACING.SM, borderBottomWidth: 1, borderBottomColor: COLORS.DIVIDER },
  transactionLeft: { flex: 1 },
  transactionType: { fontSize: FONT_SIZE.XS, fontWeight: FONT_WEIGHT.SEMIBOLD, color: COLORS.TEXT_HEADING },
  billId: { fontSize: FONT_SIZE.XS - 1, color: COLORS.TEXT_DIM, marginTop: 2 },
  notes: { fontSize: FONT_SIZE.XS - 1, color: COLORS.TEXT_DIM, marginTop: 2, fontStyle: 'italic' },
  transactionRight: { alignItems: 'flex-end' },
  amount: { fontSize: FONT_SIZE.XS, fontWeight: FONT_WEIGHT.SEMIBOLD },
  balance: { fontSize: FONT_SIZE.XS - 1, color: COLORS.TEXT_DIM, marginTop: 2 },
  actionButtons: { flexDirection: 'row', gap: SPACING.SM, marginBottom: SPACING.LG },
  button: { flex: 1, paddingVertical: SPACING.MD, borderRadius: RADIUS.SM, alignItems: 'center' },
  paymentButton: { backgroundColor: COLORS.SUCCESS },
  limitButton: { backgroundColor: COLORS.INFO },
  buttonText: { color: COLORS.WHITE, fontWeight: FONT_WEIGHT.SEMIBOLD, fontSize: FONT_SIZE.SM },
  modalContainer: { flex: 1, backgroundColor: COLORS.OVERLAY, justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.WHITE, paddingVertical: SPACING.XL, paddingHorizontal: SPACING.LG, borderTopLeftRadius: RADIUS.LG, borderTopRightRadius: RADIUS.LG },
  modalTitle: { fontSize: FONT_SIZE.LG, fontWeight: FONT_WEIGHT.SEMIBOLD, marginBottom: SPACING.LG, color: COLORS.TEXT_HEADING },
  formGroup: { marginBottom: SPACING.LG },
  input: { borderWidth: 1, borderColor: COLORS.BORDER, borderRadius: RADIUS.SM, paddingHorizontal: SPACING.MD, paddingVertical: SPACING.SM, fontSize: FONT_SIZE.MD, marginTop: SPACING.XS },
  highlightedValue: { fontSize: FONT_SIZE.MD, fontWeight: FONT_WEIGHT.SEMIBOLD, color: COLORS.PRIMARY, marginTop: 4 },
  modalActions: { flexDirection: 'row', gap: SPACING.SM, marginTop: SPACING.XL },
  modalButton: { flex: 1, paddingVertical: SPACING.MD, borderRadius: RADIUS.SM, alignItems: 'center' },
  cancelButton: { backgroundColor: COLORS.DIVIDER },
  saveButton: { backgroundColor: COLORS.SUCCESS },
  modalButtonText: { fontSize: FONT_SIZE.MD, fontWeight: FONT_WEIGHT.SEMIBOLD, color: COLORS.WHITE },
});