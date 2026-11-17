import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, Modal, TextInput, TouchableOpacity, ScrollView, Alert, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { COLORS, SPACING, RADIUS } from '../config/theme';
import { addCustomer } from '../services/firebase/firestoreService';
import { CustomerType } from '../models/Customer';
import { verifyGSTIN } from '../services/gst/gstVerificationService';
import { eInvoiceService } from '../services/gst/eInvoiceService';
import CustomerCamera from './CustomerCamera';

const TYPES: { key: CustomerType; label: string; icon: string }[] = [
    { key: 'house', label: 'House / Family', icon: '🏠' },
    { key: 'small_shop', label: 'Small Shop', icon: '🏪' },
    { key: 'hotel', label: 'Hotel', icon: '🍽️' },
    { key: 'function', label: 'Function', icon: '🎉' },
    { key: 'wholesale', label: 'Wholesale', icon: '📦' },
    { key: 'vip', label: 'VIP Regular', icon: '⭐' },
];

const AddCustomerModal = ({ 
    visible, onClose, onAdded, nextUdhaarId 
}: { 
    visible: boolean; onClose: () => void; onAdded: () => void; nextUdhaarId: string 
}) => {
    const [udhaarId, setUdhaarId] = useState(nextUdhaarId);
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [whatsapp, setWhatsapp] = useState('');
    const [houseNo, setHouseNo] = useState('');
    const [type, setType] = useState<CustomerType>('house');
    const [creditLimit, setCreditLimit] = useState('2000');
    const [gstNumber, setGstNumber] = useState('');
    const [isSearchingGst, setIsSearchingGst] = useState(false);
    const [fetchedGstName, setFetchedGstName] = useState<string | null>(null);
    const [photoUrl, setPhotoUrl] = useState<string | null>(null);
    const [showCamera, setShowCamera] = useState(false);
    const [saving, setSaving] = useState(false);

    // Sync udhaarId when nextUdhaarId changes (e.g. when modal opens)
    React.useEffect(() => {
        if (visible) setUdhaarId(nextUdhaarId);
    }, [visible, nextUdhaarId]);
    const fileInputRef = useRef<any>(null);

    const handleSearchGst = async () => {
        if (!gstNumber.trim() || gstNumber.length < 15) {
            Alert.alert('Error', 'Please enter a valid 15-character GSTIN');
            return;
        }
        setIsSearchingGst(true);
        try {
            const data = await eInvoiceService.searchGSTIN(gstNumber.toUpperCase());
            if (data?.lgnm) {
                const nameToUse = data.tradeNam || data.lgnm;
                setFetchedGstName(nameToUse);
                setName(nameToUse);
                const pradr = data.pradr;
                if (pradr?.addr) {
                    const fullAddr = `${pradr.addr.bnm || ''} ${pradr.addr.loc || ''} ${pradr.addr.stcd || ''} ${pradr.addr.pncd || ''}`.trim();
                    setHouseNo(fullAddr);
                }
                Alert.alert('Found!', `Firm Name: ${nameToUse}`);
            }
        } catch (e: any) {
            Alert.alert('Search Failed', 'Could not fetch GST details. Verify GSP keys in .env.');
        } finally {
            setIsSearchingGst(false);
        }
    };

    const reset = () => {
        setName(''); setPhone(''); setWhatsapp(''); setHouseNo('');
        setType('house'); setCreditLimit('2000'); setPhotoUrl('');
        setGstNumber('');
        setUdhaarId(nextUdhaarId);
    };

    const handlePickPhoto = () => {
        if (Platform.OS === 'web') {
            // Web: trigger hidden file input
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = (e: any) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                    setPhotoUrl(ev.target?.result as string);
                };
                reader.readAsDataURL(file);
            };
            input.click();
        } else {
            setShowCamera(true);
        }
    };

    const handleSave = async () => {
        if (!name.trim()) { Alert.alert('Error', 'Name required'); return; }
        if (!phone.trim() || phone.length < 10) { Alert.alert('Error', 'Valid 10-digit phone required'); return; }

        if (gstNumber.trim()) {
            const gstValidation = verifyGSTIN(gstNumber.trim());
            if (!gstValidation.valid) {
                Alert.alert('Invalid GSTIN', gstValidation.error || 'Invalid GST number');
                return;
            }
        }

        setSaving(true);
        try {
            await addCustomer({
                udhaarId: udhaarId.trim() || nextUdhaarId,
                name: name.trim(), phone: phone.trim(),
                whatsappNumber: whatsapp.trim() || `91${phone.trim()}`,
                houseNo: houseNo.trim() || undefined,
                gstNumber: gstNumber.trim().toUpperCase() || undefined,
                type, creditLimit: Number(creditLimit) || 2000,
                totalOutstanding: 0,
                firstPurchaseDate: new Date().toISOString().split('T')[0],
                slipImages: [], notes: '', isActive: true,
                photoUrl: photoUrl || undefined,
            });
            reset(); onAdded(); onClose();
            Alert.alert('✅ Added', `${name} added!`);
        } catch { Alert.alert('Error', 'Failed to add customer'); }
        finally { setSaving(false); }
    };

    return (
        <>
        <Modal visible={visible} animationType="slide" transparent>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
                <View style={styles.sheet}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Add Customer</Text>
                        <TouchableOpacity onPress={onClose}><Text style={styles.closeBtn}>✕</Text></TouchableOpacity>
                    </View>
                    <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>

                        {/* Photo Picker */}
                        <TouchableOpacity style={styles.photoPicker} onPress={handlePickPhoto}>
                            {photoUrl ? (
                                <Image source={{ uri: photoUrl }} style={styles.photoPreview} />
                            ) : (
                                <View style={styles.photoPlaceholder}>
                                    <Text style={styles.photoIcon}>📷</Text>
                                    <Text style={styles.photoHint}>Add Photo</Text>
                                </View>
                            )}
                            <View style={styles.photoEditBadge}>
                                <Text style={{ color: '#fff', fontSize: 12 }}>✎</Text>
                            </View>
                        </TouchableOpacity>

                        <Text style={styles.label}>Udhaar ID (Book No.) *</Text>
                        <TextInput style={styles.input} placeholder="UDH-001" placeholderTextColor={COLORS.TEXT_DIM} value={udhaarId} onChangeText={setUdhaarId} />

                        <Text style={styles.label}>Name *</Text>
                        <TextInput style={styles.input} placeholder="Customer name" placeholderTextColor={COLORS.TEXT_DIM} value={name} onChangeText={setName} />
                        <Text style={styles.label}>Phone *</Text>
                        <TextInput style={styles.input} placeholder="10-digit phone" placeholderTextColor={COLORS.TEXT_DIM} value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={10} />
                        <Text style={styles.label}>WhatsApp</Text>
                        <TextInput style={styles.input} placeholder="91XXXXXXXXXX" placeholderTextColor={COLORS.TEXT_DIM} value={whatsapp} onChangeText={setWhatsapp} keyboardType="phone-pad" />
                        <Text style={styles.label}>House / Address</Text>
                        <TextInput style={styles.input} placeholder="H-12, Street" placeholderTextColor={COLORS.TEXT_DIM} value={houseNo} onChangeText={setHouseNo} />
                        <Text style={styles.label}>Customer Type</Text>
                        <View style={styles.typeGrid}>
                            {TYPES.map(t => (
                                <TouchableOpacity key={t.key} style={[styles.typeCard, type === t.key && styles.typeCardActive]} onPress={() => setType(t.key)}>
                                    <Text style={styles.typeIcon}>{t.icon}</Text>
                                    <Text style={[styles.typeLabel, type === t.key && { color: COLORS.PRIMARY, fontWeight: '700' }]}>{t.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <View style={styles.gstRow}>
                                <View style={{ flex: 1 }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                        <Text style={styles.label}>Customer GSTIN (Optional)</Text>
                                        <TouchableOpacity onPress={handleSearchGst} disabled={isSearchingGst}>
                                            <Text style={{ color: COLORS.PRIMARY, fontWeight: '700', fontSize: 13 }}>
                                                {isSearchingGst ? 'Searching...' : '🔍 Fetch Details'}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                    <TextInput 
                                        style={styles.input} 
                                        value={gstNumber} 
                                        onChangeText={(t) => { setGstNumber(t.toUpperCase()); setFetchedGstName(null); }} 
                                        placeholder="15-character GSTIN" 
                                        placeholderTextColor={COLORS.TEXT_DIM} 
                                        autoCapitalize="characters" 
                                        maxLength={15} 
                                    />
                                    {fetchedGstName && (
                                        <View style={{ marginTop: 8, padding: 8, backgroundColor: COLORS.PRIMARY + '10', borderRadius: 8, borderWidth: 1, borderColor: COLORS.PRIMARY }}>
                                            <Text style={{ fontSize: 13, fontWeight: '800', color: COLORS.PRIMARY }}>🏢 {fetchedGstName}</Text>
                                            <Text style={{ fontSize: 10, color: COLORS.TEXT_DIM, marginTop: 2 }}>Name auto-filled above ⏫</Text>
                                        </View>
                                    )}
                                </View>
                        </View>
                        <Text style={styles.label}>Credit Limit (₹)</Text>
                        <TextInput style={styles.input} placeholder="2000" placeholderTextColor={COLORS.TEXT_DIM} value={creditLimit} onChangeText={setCreditLimit} keyboardType="numeric" />
                    </ScrollView>
                    <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
                        <Text style={styles.saveBtnText}>{saving ? 'Saving...' : '👥 Add Customer'}</Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </Modal>
        <CustomerCamera
            visible={showCamera}
            onClose={() => setShowCamera(false)}
            onCaptured={uri => { setPhotoUrl(uri); setShowCamera(false); }}
        />
        </>
    );
};

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet: { backgroundColor: COLORS.WHITE, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.LG, borderBottomWidth: 1, borderBottomColor: COLORS.BORDER },
    title: { fontSize: 18, fontWeight: '700', color: COLORS.TEXT_HEADING },
    closeBtn: { fontSize: 20, color: COLORS.TEXT_DIM, padding: 4 },
    form: { padding: SPACING.LG },
    label: { fontSize: 13, fontWeight: '700', color: COLORS.TEXT_DIM, marginTop: SPACING.SM, marginBottom: 4 },
    input: { backgroundColor: COLORS.BACKGROUND, borderRadius: RADIUS.MD, paddingHorizontal: SPACING.MD, paddingVertical: 10, color: COLORS.TEXT_BODY, borderWidth: 1, borderColor: COLORS.BORDER },
    photoPicker: { alignSelf: 'center', marginVertical: SPACING.MD, position: 'relative' },
    photoPreview: { width: 90, height: 90, borderRadius: 45, borderWidth: 3, borderColor: COLORS.PRIMARY },
    photoPlaceholder: { width: 90, height: 90, borderRadius: 45, backgroundColor: COLORS.BACKGROUND, borderWidth: 2, borderColor: COLORS.BORDER, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
    photoIcon: { fontSize: 24 },
    photoHint: { fontSize: 10, color: COLORS.TEXT_DIM, marginTop: 2 },
    photoEditBadge: { position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, borderRadius: 13, backgroundColor: COLORS.PRIMARY, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.WHITE },
    typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.XS },
    typeCard: { width: '31%', padding: SPACING.SM, borderRadius: RADIUS.MD, borderWidth: 1, borderColor: COLORS.BORDER, alignItems: 'center', backgroundColor: COLORS.BACKGROUND },
    typeCardActive: { borderColor: COLORS.PRIMARY, backgroundColor: COLORS.PRIMARY + '15' },
    typeIcon: { fontSize: 20, marginBottom: 2 },
    typeLabel: { fontSize: 10, color: COLORS.TEXT_DIM, textAlign: 'center' },
    gstRow: { marginVertical: SPACING.SM },
    saveBtn: { backgroundColor: COLORS.PRIMARY, margin: SPACING.LG, padding: SPACING.MD, borderRadius: RADIUS.LG, alignItems: 'center' },
    saveBtnText: { color: COLORS.WHITE, fontSize: 16, fontWeight: '700' },
});

export default AddCustomerModal;
