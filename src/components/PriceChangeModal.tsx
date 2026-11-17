import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { COLORS, SPACING, RADIUS } from '../config/theme';
import { updateProduct } from '../services/firebase/firestoreService';
import { Product } from '../models/Product';

const PriceChangeModal = ({ visible, product, onClose, onPriceChanged }: { visible: boolean; product: Product | null; onClose: () => void; onPriceChanged: () => void }) => {
    const [price, setPrice] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (visible && product) {
            setPrice(product.price.toString());
        }
    }, [visible, product]);

    const handleUpdate = async () => {
        if (!product) return;
        const newPrice = Number(price);
        if (!price || isNaN(newPrice) || newPrice < 0) { 
            Alert.alert('Error', 'Enter a valid price'); 
            return; 
        }
        setSaving(true);
        try {
            await updateProduct(product.id, { price: newPrice });
            setPrice(''); 
            onPriceChanged(); 
            onClose();
            Alert.alert('✅ Price Updated', `${product.name} is now ₹${newPrice.toFixed(2)}`);
        } catch { 
            Alert.alert('Error', 'Failed to update price'); 
        } finally { 
            setSaving(false); 
        }
    };

    if (!product) return null;

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
                <View style={styles.sheet}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Update Price</Text>
                        <TouchableOpacity onPress={onClose}><Text style={styles.closeBtn}>✕</Text></TouchableOpacity>
                    </View>
                    <View style={styles.body}>
                        <Text style={styles.productName}>{product.name}</Text>
                        <Text style={styles.meta}>{product.category} · {product.unit}</Text>
                        <View style={styles.stockInfo}>
                            <View style={styles.stockBox}>
                                <Text style={styles.stockLabel}>Current Price</Text>
                                <Text style={[styles.stockValue, { color: COLORS.TEXT_DIM }]}>₹{product.price}</Text>
                            </View>
                            <Text style={styles.arrow}>→</Text>
                            <View style={styles.stockBox}>
                                <Text style={styles.stockLabel}>New Price</Text>
                                <Text style={[styles.stockValue, { color: COLORS.SUCCESS }]}>
                                    ₹{price && !isNaN(Number(price)) ? Number(price).toFixed(2) : '-'}
                                </Text>
                            </View>
                        </View>
                        <Text style={styles.label}>New Price (₹)</Text>
                        <TextInput 
                            style={styles.input} 
                            placeholder="e.g. 150" 
                            placeholderTextColor={COLORS.TEXT_DIM} 
                            value={price} 
                            onChangeText={setPrice} 
                            keyboardType="numeric" 
                            autoFocus 
                        />
                    </View>
                    <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleUpdate} disabled={saving}>
                        <Text style={styles.saveBtnText}>{saving ? 'Updating...' : '🏷️ Update Price'}</Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet: { backgroundColor: COLORS.WHITE, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.LG, borderBottomWidth: 1, borderBottomColor: COLORS.BORDER },
    title: { fontSize: 18, fontWeight: '700', color: COLORS.TEXT_HEADING },
    closeBtn: { fontSize: 20, color: COLORS.TEXT_DIM, padding: 4 },
    body: { padding: SPACING.LG },
    productName: { fontSize: 20, fontWeight: '800', color: COLORS.TEXT_HEADING },
    meta: { fontSize: 13, color: COLORS.TEXT_DIM, marginTop: 2 },
    stockInfo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginVertical: SPACING.LG, gap: SPACING.MD },
    stockBox: { alignItems: 'center', backgroundColor: COLORS.BACKGROUND, padding: SPACING.MD, borderRadius: RADIUS.LG, width: 100 },
    stockLabel: { fontSize: 12, color: COLORS.TEXT_DIM },
    stockValue: { fontSize: 20, fontWeight: '800' },
    arrow: { fontSize: 24, color: COLORS.TEXT_DIM },
    label: { fontSize: 13, fontWeight: '700', color: COLORS.TEXT_DIM, marginBottom: 4 },
    input: { backgroundColor: COLORS.BACKGROUND, borderRadius: RADIUS.MD, paddingHorizontal: SPACING.MD, paddingVertical: 12, color: COLORS.TEXT_BODY, borderWidth: 1, borderColor: COLORS.BORDER, fontSize: 18, textAlign: 'center' },
    saveBtn: { backgroundColor: COLORS.PRIMARY, margin: SPACING.LG, padding: SPACING.MD, borderRadius: RADIUS.LG, alignItems: 'center' },
    saveBtnText: { color: COLORS.WHITE, fontSize: 16, fontWeight: '700' },
});

export default PriceChangeModal;
