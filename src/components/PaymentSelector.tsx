import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, Text, TouchableOpacity, TextInput, FlatList } from 'react-native';
import type { PaymentMethod } from '../models/Payment';
import { paymentService } from '../services/payment/paymentService';
import { COLORS, SPACING, RADIUS, FONT_SIZE, FONT_WEIGHT } from '../config/theme';

const PAYMENT_OPTIONS: Array<{ method: PaymentMethod; label: string; icon: string }> = [
  { method: 'cash', label: 'Cash', icon: '💵' },
  { method: 'upi', label: 'UPI', icon: '📱' },
  { method: 'card', label: 'Card', icon: '💳' },
  { method: 'check', label: 'Cheque', icon: '✓' },
  { method: 'credit', label: 'Udhaar', icon: '📝' },
];

interface PaymentBreakdown {
  method: PaymentMethod;
  amount: number;
  reference?: string;
}

interface PaymentSelectorProps {
  billAmount: number;
  enabledMethods: PaymentMethod[];
  onPaymentConfirm: (payments: PaymentBreakdown[]) => void;
  onCancel: () => void;
}

export function PaymentSelector({
  billAmount,
  enabledMethods,
  onPaymentConfirm,
  onCancel,
}: PaymentSelectorProps) {
  const [paymentMode, setPaymentMode] = useState<'single' | 'split'>('single');
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>(enabledMethods[0] || 'cash');
  const [singleAmount, setSingleAmount] = useState(billAmount.toString());
  const [splitPayments, setSplitPayments] = useState<PaymentBreakdown[]>([]);
  const [tempAmount, setTempAmount] = useState('');
  const [tempMethod, setTempMethod] = useState<PaymentMethod>(enabledMethods[0] || 'cash');
  const [tempReference, setTempReference] = useState('');

  const totalPaid = splitPayments.reduce((sum, p) => sum + p.amount, 0);
  const remainingAmount = billAmount - totalPaid;

  const handleAddSplitPayment = () => {
    const amount = parseFloat(tempAmount);
    if (!amount || amount <= 0 || amount > remainingAmount) {
      return;
    }

    setSplitPayments(prev => [
      ...prev,
      { method: tempMethod, amount, reference: tempReference },
    ]);
    setTempAmount('');
    setTempReference('');
  };

  const handleRemoveSplitPayment = (index: number) => {
    setSplitPayments(prev => prev.filter((_, i) => i !== index));
  };

  const handleConfirm = () => {
    if (paymentMode === 'single') {
      const amount = parseFloat(singleAmount);
      if (amount !== billAmount) {
        alert('Payment amount must equal bill amount');
        return;
      }
      onPaymentConfirm([{ method: selectedMethod, amount }]);
    } else {
      if (totalPaid !== billAmount) {
        alert('Total payment must equal bill amount');
        return;
      }
      onPaymentConfirm(splitPayments);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Select Payment Method</Text>
      <Text style={styles.billAmount}>Bill Amount: ₹{billAmount.toFixed(2)}</Text>

      {/* Mode Selector */}
      <View style={styles.modeSelector}>
        <TouchableOpacity
          style={[styles.modeButton, paymentMode === 'single' && styles.activeModeButton]}
          onPress={() => setPaymentMode('single')}
        >
          <Text style={[styles.modeButtonText, paymentMode === 'single' && styles.activeModeButtonText]}>
            Single Payment
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeButton, paymentMode === 'split' && styles.activeModeButton]}
          onPress={() => setPaymentMode('split')}
        >
          <Text style={[styles.modeButtonText, paymentMode === 'split' && styles.activeModeButtonText]}>
            Split Payment
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {paymentMode === 'single' ? (
          <View>
            {/* Method Selection */}
            <Text style={styles.sectionTitle}>Payment Method</Text>
            <View style={styles.methodGrid}>
              {PAYMENT_OPTIONS.filter(opt => enabledMethods.includes(opt.method)).map(option => (
                <TouchableOpacity
                  key={option.method}
                  style={[
                    styles.methodButton,
                    selectedMethod === option.method && styles.selectedMethodButton,
                  ]}
                  onPress={() => setSelectedMethod(option.method)}
                >
                  <Text style={styles.methodIcon}>{option.icon}</Text>
                  <Text style={styles.methodLabel}>{option.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Amount Input */}
            <View style={styles.amountSection}>
              <Text style={styles.sectionTitle}>Amount</Text>
              <View style={styles.amountInputContainer}>
                <Text style={styles.currencySymbol}>₹</Text>
                <TextInput
                  style={styles.amountInput}
                  value={singleAmount}
                  onChangeText={setSingleAmount}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                />
              </View>
            </View>
          </View>
        ) : (
          <View>
            {/* Split Payment Section */}
            <Text style={styles.sectionTitle}>Add Payments</Text>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Method</Text>
              <View style={styles.methodRow}>
                {PAYMENT_OPTIONS.filter(opt => enabledMethods.includes(opt.method)).map(option => (
                  <TouchableOpacity
                    key={option.method}
                    style={[
                      styles.methodChip,
                      tempMethod === option.method && styles.selectedMethodChip,
                    ]}
                    onPress={() => setTempMethod(option.method)}
                  >
                    <Text>{option.icon}</Text>
                    <Text style={styles.chipLabel}>{option.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Amount (Remaining: ₹{remainingAmount.toFixed(2)})</Text>
              <TextInput
                style={styles.input}
                value={tempAmount}
                onChangeText={setTempAmount}
                keyboardType="decimal-pad"
                placeholder="Enter amount"
              />
            </View>

            {tempMethod === 'upi' && (
              <View style={styles.formGroup}>
                <Text style={styles.label}>UPI Reference</Text>
                <TextInput
                  style={styles.input}
                  value={tempReference}
                  onChangeText={setTempReference}
                  placeholder="UPI Ref ID (optional)"
                />
              </View>
            )}

            {tempMethod === 'check' && (
              <View style={styles.formGroup}>
                <Text style={styles.label}>Cheque Number</Text>
                <TextInput
                  style={styles.input}
                  value={tempReference}
                  onChangeText={setTempReference}
                  placeholder="Cheque #"
                />
              </View>
            )}

            <TouchableOpacity style={styles.addPaymentButton} onPress={handleAddSplitPayment}>
              <Text style={styles.addPaymentButtonText}>+ Add Payment</Text>
            </TouchableOpacity>

            {/* Split Payment List */}
            {splitPayments.length > 0 && (
              <View style={styles.paymentsList}>
                <Text style={styles.sectionTitle}>Payments</Text>
                <FlatList
                  data={splitPayments}
                  scrollEnabled={false}
                  renderItem={({ item, index }) => {
                    const methodOption = PAYMENT_OPTIONS.find(opt => opt.method === item.method);
                    return (
                      <View style={styles.paymentItem}>
                        <View>
                          <Text style={styles.paymentMethod}>
                            {methodOption?.icon} {methodOption?.label}
                          </Text>
                          <Text style={styles.paymentAmount}>₹{item.amount.toFixed(2)}</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.removeButton}
                          onPress={() => handleRemoveSplitPayment(index)}
                        >
                          <Text style={styles.removeButtonText}>Remove</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  }}
                  keyExtractor={(_, index) => index.toString()}
                />
              </View>
            )}

            {/* Payment Summary */}
            <View style={styles.paymentSummary}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total Paid</Text>
                <Text style={styles.summaryValue}>₹{totalPaid.toFixed(2)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Remaining</Text>
                <Text style={[styles.summaryValue, remainingAmount > 0 && styles.negativeValue]}>
                  ₹{remainingAmount.toFixed(2)}
                </Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.actions}>
        <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onCancel}>
          <Text style={styles.buttonText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.button,
            styles.confirmButton,
            paymentMode === 'split' && totalPaid !== billAmount && styles.disabledButton,
            paymentMode === 'single' && parseFloat(singleAmount) !== billAmount && styles.disabledButton,
          ]}
          onPress={handleConfirm}
          disabled={
            (paymentMode === 'split' && totalPaid !== billAmount) ||
            (paymentMode === 'single' && parseFloat(singleAmount) !== billAmount)
          }
        >
          <Text style={styles.buttonText}>Confirm</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  title: {
    fontSize: FONT_SIZE.LG,
    fontWeight: FONT_WEIGHT.BOLD,
    color: COLORS.TEXT_HEADING,
    paddingHorizontal: SPACING.LG,
    paddingVertical: SPACING.MD,
  },
  billAmount: {
    fontSize: FONT_SIZE.SM,
    color: COLORS.TEXT_DIM,
    paddingHorizontal: SPACING.LG,
    marginBottom: SPACING.SM,
  },
  modeSelector: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.LG,
    paddingBottom: SPACING.MD,
    gap: SPACING.SM,
  },
  modeButton: {
    flex: 1,
    paddingVertical: SPACING.SM + 2,
    paddingHorizontal: SPACING.MD,
    backgroundColor: COLORS.DIVIDER,
    borderRadius: RADIUS.SM,
    alignItems: 'center',
  },
  activeModeButton: {
    backgroundColor: COLORS.PRIMARY,
  },
  modeButtonText: {
    fontSize: FONT_SIZE.XS,
    fontWeight: FONT_WEIGHT.SEMIBOLD,
    color: COLORS.TEXT_DIM,
  },
  activeModeButtonText: {
    color: COLORS.WHITE,
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.LG,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.XS,
    fontWeight: FONT_WEIGHT.SEMIBOLD,
    color: COLORS.TEXT_DIM,
    marginBottom: SPACING.SM,
    marginTop: SPACING.MD,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  methodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.SM,
    marginBottom: SPACING.MD,
  },
  methodButton: {
    width: '31%',
    paddingVertical: SPACING.MD,
    paddingHorizontal: SPACING.SM,
    backgroundColor: COLORS.WHITE,
    borderRadius: RADIUS.MD,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.BORDER,
  },
  selectedMethodButton: {
    borderColor: COLORS.PRIMARY,
    backgroundColor: COLORS.PRIMARY_BG,
  },
  methodIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  methodLabel: {
    fontSize: FONT_SIZE.XS,
    color: COLORS.TEXT_BODY,
    fontWeight: FONT_WEIGHT.MEDIUM,
  },
  methodChip: {
    paddingVertical: SPACING.SM,
    paddingHorizontal: SPACING.MD,
    backgroundColor: COLORS.SURFACE,
    borderRadius: RADIUS.SM,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  selectedMethodChip: {
    backgroundColor: COLORS.PRIMARY,
    borderColor: COLORS.PRIMARY,
  },
  methodRow: {
    flexDirection: 'row',
    gap: SPACING.SM,
    flexWrap: 'wrap',
  },
  chipLabel: {
    fontSize: FONT_SIZE.XS,
    marginTop: 4,
  },
  amountSection: {
    marginTop: SPACING.MD,
    marginBottom: SPACING.XL,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.WHITE,
    borderRadius: RADIUS.MD,
    paddingHorizontal: SPACING.MD,
    borderWidth: 2,
    borderColor: COLORS.PRIMARY,
  },
  currencySymbol: {
    fontSize: 24,
    fontWeight: FONT_WEIGHT.SEMIBOLD,
    color: COLORS.PRIMARY,
    marginRight: 4,
  },
  amountInput: {
    flex: 1,
    paddingVertical: SPACING.MD,
    fontSize: FONT_SIZE.LG,
    fontWeight: FONT_WEIGHT.SEMIBOLD,
    color: COLORS.TEXT_HEADING,
  },
  formGroup: {
    marginBottom: SPACING.MD,
  },
  label: {
    fontSize: FONT_SIZE.XS,
    fontWeight: FONT_WEIGHT.SEMIBOLD,
    color: COLORS.TEXT_DIM,
    marginBottom: SPACING.XS,
  },
  input: {
    backgroundColor: COLORS.WHITE,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: RADIUS.SM,
    paddingHorizontal: SPACING.MD,
    paddingVertical: SPACING.SM + 2,
    fontSize: FONT_SIZE.MD,
    color: COLORS.TEXT_BODY,
  },
  addPaymentButton: {
    backgroundColor: COLORS.SUCCESS,
    paddingVertical: SPACING.SM + 2,
    borderRadius: RADIUS.SM,
    alignItems: 'center',
    marginVertical: SPACING.MD,
  },
  addPaymentButtonText: {
    color: COLORS.WHITE,
    fontWeight: FONT_WEIGHT.SEMIBOLD,
    fontSize: FONT_SIZE.SM,
  },
  paymentsList: {
    marginTop: SPACING.MD,
  },
  paymentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.WHITE,
    paddingHorizontal: SPACING.MD,
    paddingVertical: SPACING.SM + 2,
    borderRadius: RADIUS.SM,
    marginBottom: SPACING.SM,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  paymentMethod: {
    fontSize: FONT_SIZE.XS,
    fontWeight: FONT_WEIGHT.SEMIBOLD,
    color: COLORS.TEXT_BODY,
  },
  paymentAmount: {
    fontSize: FONT_SIZE.SM,
    fontWeight: FONT_WEIGHT.BOLD,
    color: COLORS.PRIMARY,
    marginTop: 2,
  },
  removeButton: {
    paddingHorizontal: SPACING.SM,
    paddingVertical: SPACING.XS,
    backgroundColor: COLORS.ERROR_BG,
    borderRadius: RADIUS.XS,
  },
  removeButtonText: {
    fontSize: FONT_SIZE.XS,
    color: COLORS.ERROR,
    fontWeight: FONT_WEIGHT.SEMIBOLD,
  },
  paymentSummary: {
    backgroundColor: COLORS.WHITE,
    borderRadius: RADIUS.SM,
    paddingHorizontal: SPACING.MD,
    paddingVertical: SPACING.SM,
    marginVertical: SPACING.MD,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SPACING.XS + 2,
  },
  summaryLabel: {
    fontSize: FONT_SIZE.XS,
    color: COLORS.TEXT_DIM,
  },
  summaryValue: {
    fontSize: FONT_SIZE.XS,
    fontWeight: FONT_WEIGHT.SEMIBOLD,
    color: COLORS.TEXT_BODY,
  },
  negativeValue: {
    color: COLORS.ERROR,
  },
  actions: {
    flexDirection: 'row',
    gap: SPACING.SM,
    paddingHorizontal: SPACING.LG,
    paddingVertical: SPACING.MD,
    paddingBottom: SPACING.XL,
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER,
    backgroundColor: COLORS.WHITE,
  },
  button: {
    flex: 1,
    paddingVertical: SPACING.MD,
    borderRadius: RADIUS.SM,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: COLORS.DIVIDER,
  },
  confirmButton: {
    backgroundColor: COLORS.PRIMARY,
  },
  disabledButton: {
    opacity: 0.45,
  },
  buttonText: {
    fontSize: FONT_SIZE.SM,
    fontWeight: FONT_WEIGHT.SEMIBOLD,
    color: COLORS.WHITE,
  },
});
