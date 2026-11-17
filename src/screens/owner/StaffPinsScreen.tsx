/**
 * StaffPinsScreen — Owner sets / changes PINs for each staff role.
 *
 * Uses `setStaffPin(ownerPin, role, newPin)` which is an atomic
 * Supabase RPC that verifies the caller is an owner first.
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { COLORS, SPACING, RADIUS, FONT_SIZE, FONT_WEIGHT } from '../../config/theme';
import { setStaffPin } from '../../services/firebase/firestoreService';
import type { StaffRole } from '../../models/Staff';
import { ROLE_LABELS } from '../../models/Staff';

const ROLES: { role: StaffRole; icon: string; desc: string }[] = [
  { role: 'OWNER',         icon: '👑', desc: 'Full access to everything' },
  { role: 'CASHIER',       icon: '🧾', desc: 'Billing, customers, inventory view' },
  { role: 'STOCK_MANAGER', icon: '📦', desc: 'Inventory, purchases, suppliers' },
  { role: 'ACCOUNTANT',    icon: '📊', desc: 'Reports, compliance, read-only' },
];

const StaffPinsScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const [selectedRole, setSelectedRole] = useState<StaffRole | null>(null);
  const [ownerPin, setOwnerPin]   = useState('');
  const [newPin, setNewPin]       = useState('');
  const [confirmPin, setConfirm]  = useState('');
  const [saving, setSaving]       = useState(false);
  const [success, setSuccess]     = useState<string | null>(null);

  const reset = useCallback(() => {
    setSelectedRole(null);
    setOwnerPin('');
    setNewPin('');
    setConfirm('');
    setSuccess(null);
  }, []);

  const handleSave = useCallback(async () => {
    if (!selectedRole) return;
    if (ownerPin.length < 4)        { Alert.alert('Error', 'Enter your owner PIN (4+ digits)'); return; }
    if (newPin.length < 4)          { Alert.alert('Error', 'New PIN must be at least 4 digits'); return; }
    if (newPin !== confirmPin)      { Alert.alert('Error', 'PINs do not match'); return; }
    if (newPin === ownerPin && selectedRole !== 'OWNER') {
      Alert.alert('Warning', 'New PIN is the same as the owner PIN. Use a different PIN for security.');
      return;
    }

    setSaving(true);
    try {
      await setStaffPin(ownerPin, selectedRole, newPin);
      setSuccess(`${ROLE_LABELS[selectedRole]} PIN updated ✓`);
      setOwnerPin('');
      setNewPin('');
      setConfirm('');
      setTimeout(() => setSuccess(null), 4000);
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      Alert.alert('Failed', msg.includes('owner') ? 'Wrong owner PIN' : msg);
    } finally {
      setSaving(false);
    }
  }, [selectedRole, ownerPin, newPin, confirmPin]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation?.goBack()}>
          <Text style={styles.backBtn}>← Back</Text>
        </TouchableOpacity>
        <View style={{ marginLeft: 12 }}>
          <Text style={styles.headerTitle}>Staff PINs</Text>
          <Text style={styles.headerSub}>Set or change login PINs for each role</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: SPACING.LG, paddingBottom: 100 }}>
        {/* Success banner */}
        {success && (
          <View style={styles.successBanner}>
            <Text style={styles.successText}>{success}</Text>
          </View>
        )}

        {/* Role cards */}
        <Text style={styles.sectionLabel}>Select a role to set its PIN</Text>
        {ROLES.map(r => {
          const active = selectedRole === r.role;
          return (
            <TouchableOpacity
              key={r.role}
              style={[styles.roleCard, active && styles.roleCardActive]}
              onPress={() => { setSelectedRole(r.role); setNewPin(''); setConfirm(''); setSuccess(null); }}
            >
              <Text style={styles.roleIcon}>{r.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.roleName, active && styles.roleNameActive]}>
                  {ROLE_LABELS[r.role]}
                </Text>
                <Text style={styles.roleDesc}>{r.desc}</Text>
              </View>
              {active && <Text style={styles.selectedBadge}>Selected</Text>}
            </TouchableOpacity>
          );
        })}

        {/* PIN form */}
        {selectedRole && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>
              Set PIN for {ROLE_LABELS[selectedRole]}
            </Text>

            <Text style={styles.inputLabel}>Your owner PIN (to verify)</Text>
            <TextInput
              style={styles.pinInput}
              value={ownerPin}
              onChangeText={setOwnerPin}
              placeholder="Enter your owner PIN"
              placeholderTextColor="#aaa"
              secureTextEntry
              keyboardType="number-pad"
              maxLength={8}
            />

            <Text style={styles.inputLabel}>New PIN for {ROLE_LABELS[selectedRole]}</Text>
            <TextInput
              style={styles.pinInput}
              value={newPin}
              onChangeText={setNewPin}
              placeholder="New PIN (4+ digits)"
              placeholderTextColor="#aaa"
              secureTextEntry
              keyboardType="number-pad"
              maxLength={8}
            />

            <Text style={styles.inputLabel}>Confirm new PIN</Text>
            <TextInput
              style={styles.pinInput}
              value={confirmPin}
              onChangeText={setConfirm}
              placeholder="Re-enter new PIN"
              placeholderTextColor="#aaa"
              secureTextEntry
              keyboardType="number-pad"
              maxLength={8}
            />

            <View style={styles.formActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={reset}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>Save PIN</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Info box */}
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>ℹ️  About PINs</Text>
          <Text style={styles.infoText}>
            • Each role has one PIN per store{'\n'}
            • Only the owner can change PINs{'\n'}
            • PINs must be at least 4 digits{'\n'}
            • After 5 wrong attempts, login is locked for 15 minutes{'\n'}
            • Changing a PIN logs out that role on all devices
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#f8f9fa' },
  header:       { backgroundColor: COLORS.PRIMARY, paddingHorizontal: 16, paddingVertical: 14, paddingTop: 20, flexDirection: 'row', alignItems: 'center' },
  backBtn:      { color: '#fff', fontSize: 16 },
  headerTitle:  { fontSize: 20, fontWeight: '700' as any, color: '#fff' },
  headerSub:    { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  sectionLabel: { fontSize: 13, fontWeight: '600' as any, color: '#888', marginBottom: 10, textTransform: 'uppercase' as any },

  roleCard:       { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: RADIUS.MD, padding: 14, marginBottom: 8, borderWidth: 1.5, borderColor: '#eee' },
  roleCardActive: { borderColor: COLORS.PRIMARY, backgroundColor: '#f0f4ff' },
  roleIcon:       { fontSize: 28, marginRight: 12 },
  roleName:       { fontSize: 15, fontWeight: '600' as any, color: '#333' },
  roleNameActive: { color: COLORS.PRIMARY },
  roleDesc:       { fontSize: 12, color: '#888', marginTop: 2 },
  selectedBadge:  { fontSize: 11, fontWeight: '600' as any, color: COLORS.PRIMARY, backgroundColor: '#e0e8ff', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, overflow: 'hidden' as any },

  formCard:    { backgroundColor: '#fff', borderRadius: RADIUS.LG, padding: SPACING.LG, marginTop: 16, borderWidth: 1, borderColor: '#e0e0e0' },
  formTitle:   { fontSize: 16, fontWeight: '700' as any, color: '#333', marginBottom: 16 },
  inputLabel:  { fontSize: 12, color: '#888', marginTop: 12, marginBottom: 4 },
  pinInput:    { backgroundColor: '#f5f5f5', borderRadius: 8, padding: 12, fontSize: 16, letterSpacing: 4, color: '#333', borderWidth: 1, borderColor: '#e8e8e8' },

  formActions: { flexDirection: 'row', marginTop: 20, gap: 10 },
  cancelBtn:   { flex: 1, paddingVertical: 12, borderRadius: RADIUS.MD, backgroundColor: '#f2f2f2', alignItems: 'center' },
  cancelBtnText: { color: '#666', fontWeight: '600' as any, fontSize: 14 },
  saveBtn:     { flex: 2, paddingVertical: 12, borderRadius: RADIUS.MD, backgroundColor: COLORS.PRIMARY, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '600' as any, fontSize: 14 },

  successBanner: { backgroundColor: '#d4edda', borderRadius: RADIUS.MD, padding: 12, marginBottom: 12 },
  successText:   { color: '#155724', fontSize: 14, fontWeight: '600' as any, textAlign: 'center' },

  infoBox:    { backgroundColor: '#fff9db', borderRadius: RADIUS.MD, padding: 14, marginTop: 20, borderWidth: 1, borderColor: '#ffe066' },
  infoTitle:  { fontSize: 14, fontWeight: '600' as any, color: '#856404', marginBottom: 6 },
  infoText:   { fontSize: 13, color: '#856404', lineHeight: 20 },
});

export default StaffPinsScreen;
