/**
 * UpiQrModal.tsx — Generate a UPI QR code for any amount.
 *
 * Shows a modal with:
 *  - Amount input (Rs.)
 *  - UPI ID (store's VPA)
 *  - Note
 *  - Customer phone (optional, for WhatsApp share)
 *  - Live QR code that updates on amount/UPI change
 *  - WhatsApp share, copy details, Done buttons
 *
 * Uses the standard UPI deep-link format:
 *   upi://pay?pa=<VPA>&pn=<NAME>&am=<AMOUNT>&cu=INR&tn=<NOTE>
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, Modal, TouchableOpacity, TextInput,
  StyleSheet, Platform, Linking, ActivityIndicator,
  ScrollView, Alert,
} from 'react-native';

// The matrix encoder works on native and web without a browser canvas.
import QRCodeLib from 'qrcode';

interface UpiQrModalProps {
  visible: boolean;
  onClose: () => void;
  storeName?: string;
  defaultUpiId?: string;
  /** Pre-fill amount (e.g. from a bill total) */
  amount?: number;
  customerPhone?: string;
}

export default function UpiQrModal({
  visible,
  onClose,
  storeName = 'Demo Store',
  defaultUpiId = '',
  amount: initialAmount,
  customerPhone: initPhone,
}: UpiQrModalProps) {
  const [amount, setAmount] = useState(initialAmount?.toString() || '');
  const [upiId, setUpiId] = useState(defaultUpiId);
  const [note, setNote] = useState('Store payment');
  const [phone, setPhone] = useState(initPhone || '');
  const [qrMatrix, setQrMatrix] = useState<boolean[][] | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  // Reset fields when modal opens
  useEffect(() => {
    if (visible) {
      setAmount(initialAmount?.toString() || '');
      setUpiId(defaultUpiId);
      setNote('Store payment');
      setPhone(initPhone || '');
      setQrMatrix(null);
      setQrError(null);
    }
  }, [visible, initialAmount, defaultUpiId, initPhone]);

  // Build UPI deep-link
  const buildUpiLink = useCallback(() => {
    const pa = upiId.trim();
    const am = parseFloat(amount) || 0;
    if (!pa || am <= 0) return '';
    const params = new URLSearchParams({
      pa,
      pn: storeName,
      am: am.toFixed(2),
      cu: 'INR',
      tn: note.trim() || 'Payment',
    });
    return `upi://pay?${params.toString()}`;
  }, [upiId, amount, storeName, note]);

  // Generate QR when amount/upiId changes
  useEffect(() => {
    const link = buildUpiLink();
    if (!link) {
      setQrMatrix(null);
      setQrError(null);
      return;
    }

    let active = true;
    setGenerating(true);
    setQrError(null);
    try {
      const symbol = QRCodeLib.create(link, { errorCorrectionLevel: 'M' });
      const size = symbol.modules.size;
      const matrix = Array.from({ length: size }, (_, row) =>
        Array.from({ length: size }, (_, col) => Boolean(symbol.modules.get(row, col))),
      );
      if (active) setQrMatrix(matrix);
    } catch {
      if (active) {
        setQrMatrix(null);
        setQrError('Could not create this payment QR. Check the UPI ID and amount.');
      }
    } finally {
      if (active) setGenerating(false);
    }
    return () => { active = false; };
  }, [buildUpiLink]);

  const parsedAmount = parseFloat(amount) || 0;

  // Share via WhatsApp
  const shareWhatsApp = () => {
    const ph = phone.replace(/\D/g, '');
    if (ph.length < 10) {
      Alert.alert('Enter Phone', 'Please enter a valid 10-digit phone number for WhatsApp.');
      return;
    }
    const intlPhone = ph.length === 10 ? `91${ph}` : ph;
    const text = [
      `💳 *Payment Request — ${storeName}*`,
      ``,
      `Amount: *₹${parsedAmount.toFixed(2)}*`,
      `UPI ID: ${upiId}`,
      note ? `Note: ${note}` : '',
      ``,
      `Pay using any UPI app:`,
      buildUpiLink(),
      ``,
      `Accepts Google Pay, PhonePe, Paytm`,
    ].filter(Boolean).join('\n');
    const url = `https://wa.me/${intlPhone}?text=${encodeURIComponent(text)}`;
    Linking.openURL(url);
  };

  // Copy payment details
  const shareDetails = () => {
    const text = [
      `Payment to ${storeName}`,
      `Amount: ₹${parsedAmount.toFixed(2)}`,
      `UPI ID: ${upiId}`,
      note ? `Note: ${note}` : '',
    ].filter(Boolean).join('\n');

    if (Platform.OS === 'web' && navigator?.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        Alert.alert('Copied!', 'Payment details copied to clipboard.');
      });
    } else {
      Alert.alert('Payment Details', text);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.header}>
              <View>
                <Text style={styles.title}>UPI QR</Text>
                <Text style={styles.subtitle}>Create a QR for any amount and UPI ID</Text>
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Amount */}
            <Text style={styles.label}>Amount</Text>
            <View style={styles.amountRow}>
              <Text style={styles.currencyPrefix}>Rs.</Text>
              <TextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor="#999"
              />
            </View>

            {/* UPI ID */}
            <Text style={styles.label}>UPI ID</Text>
            <TextInput
              style={styles.input}
              value={upiId}
              onChangeText={setUpiId}
              placeholder="example@upi"
              placeholderTextColor="#999"
              autoCapitalize="none"
            />

            {/* Note */}
            <Text style={styles.label}>Note</Text>
            <TextInput
              style={styles.input}
              value={note}
              onChangeText={setNote}
              placeholder="Payment note"
              placeholderTextColor="#999"
            />

            {/* Customer Phone */}
            <Text style={styles.label}>Customer Phone (Optional for WhatsApp)</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="10-digit mobile number"
              placeholderTextColor="#999"
              keyboardType="phone-pad"
              maxLength={10}
            />

            {/* QR Code Display */}
            <View style={styles.qrContainer}>
              {parsedAmount > 0 && upiId.trim() ? (
                <>
                  <Text style={styles.qrTitle}>Scan to Pay Rs.{parsedAmount.toFixed(2)}</Text>
                  {generating ? (
                    <ActivityIndicator size="large" color="#2d6a4f" style={{ marginVertical: 40 }} />
                  ) : qrMatrix ? (
                    <View style={styles.qrImage} accessibilityLabel="UPI payment QR code">
                      {qrMatrix.map((row, rowIndex) => (
                        <View key={rowIndex} style={styles.qrRow}>
                          {row.map((dark, colIndex) => (
                            <View key={colIndex} style={{ flex: 1, backgroundColor: dark ? '#1a472a' : '#ffffff' }} />
                          ))}
                        </View>
                      ))}
                    </View>
                  ) : (
                    <View style={styles.qrPlaceholder}>
                      <Text style={styles.qrPlaceholderText}>UPI</Text>
                      <Text style={styles.qrPlaceholderSub}>{qrError || 'Enter your UPI ID to make a QR'}</Text>
                    </View>
                  )}
                  <Text style={styles.acceptsText}>Accepts Google Pay, PhonePe, Paytm</Text>
                </>
              ) : (
                <View style={styles.qrPlaceholder}>
                  <Text style={styles.qrPlaceholderText}>UPI</Text>
                  <Text style={styles.qrPlaceholderSub}>Enter amount to generate QR</Text>
                </View>
              )}
            </View>

            {/* Action Buttons */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.whatsappBtn]}
                onPress={shareWhatsApp}
                disabled={parsedAmount <= 0}
              >
                <Text style={styles.actionBtnText}>📱 WhatsApp</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.shareBtn]}
                onPress={shareDetails}
                disabled={parsedAmount <= 0}
              >
                <Text style={styles.actionBtnText}>📋 Share Details</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.doneBtn} onPress={onClose}>
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 420,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a472a',
  },
  subtitle: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
    marginTop: 12,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fafafa',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#d4a843',
    paddingHorizontal: 14,
  },
  currencyPrefix: {
    fontSize: 16,
    fontWeight: '700',
    color: '#d4a843',
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    paddingVertical: 12,
  },
  input: {
    backgroundColor: '#fafafa',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#333',
  },
  qrContainer: {
    alignItems: 'center',
    backgroundColor: '#fafafa',
    borderRadius: 14,
    paddingVertical: 20,
    paddingHorizontal: 16,
    marginTop: 20,
    marginBottom: 16,
  },
  qrTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a472a',
    marginBottom: 12,
  },
  qrImage: {
    width: 248,
    height: 248,
    borderRadius: 8,
    padding: 8,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  qrRow: { flex: 1, flexDirection: 'row' },
  qrPlaceholder: {
    width: 200,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
  },
  qrPlaceholderText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1a472a',
    marginBottom: 4,
  },
  qrPlaceholderSub: {
    fontSize: 13,
    color: '#999',
  },
  acceptsText: {
    fontSize: 13,
    color: '#888',
    marginTop: 10,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  whatsappBtn: {
    backgroundColor: '#25D366',
  },
  shareBtn: {
    backgroundColor: '#e8e8e8',
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  doneBtn: {
    backgroundColor: '#1a472a',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 4,
  },
  doneBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
});
