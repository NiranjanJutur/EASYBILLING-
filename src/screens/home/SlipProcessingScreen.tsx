import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Image, TextInput } from 'react-native';
import { COLORS, SPACING, RADIUS } from '../../config/theme';
import { extractSlipData } from '../../services/ai/geminiService';
import { SlipOCRResult } from '../../models/Slip';
import { getProducts, getCustomers, updateCustomer } from '../../services/local/localDataService';
import { Product } from '../../models/Product';

interface ExtractedItem {
    name: string;
    qty: number;
    unit: string;
    confidence: number;
    matchedProduct?: Product;
    unitPrice: number;      // derived: lineTotal / qty
    lineTotal: number;      // EXACT amount from left column of slip
}

const SlipProcessingScreen = ({ navigation }: { navigation: any }) => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [items, setItems] = useState<ExtractedItem[]>([]);
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [previewUri, setPreviewUri] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [processingStep, setProcessingStep] = useState('');
    const [allProducts, setAllProducts] = useState<Product[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Load products on mount for price matching
    useEffect(() => {
        getProducts().then(setAllProducts);
    }, []);

    const handleUploadClick = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    // Try to match extracted item name to a product in inventory
    const matchProduct = (itemName: string, products: Product[]): Product | undefined => {
        const lower = itemName.toLowerCase();
        // Exact match first
        let match = products.find(p => p.name.toLowerCase() === lower);
        if (match) return match;
        // Partial match
        match = products.find(p => lower.includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(lower));
        return match;
    };

    const handleFileChange = async (event: any) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsProcessing(true);
        setErrorMsg(null);
        setItems([]);
        setCustomerName('');
        setCustomerPhone('');

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const dataUrl = e.target?.result as string;
                setPreviewUri(dataUrl);

                setProcessingStep('📷 Image captured. Analyzing...');
                await new Promise(r => setTimeout(r, 300));

                setProcessingStep('🤖 Sending to AI for deep extraction...');
                const base64 = dataUrl.split(',')[1];

                const data = await extractSlipData(base64);

                if (data && data.items && data.items.length > 0) {
                    setProcessingStep('✅ Extraction complete! Matching prices...');
                    setCustomerName(data.name || '');
                    setCustomerPhone(data.phone || '');

                    // Match items to products for pricing
                    const products = allProducts.length > 0 ? allProducts : await getProducts();
                    const enrichedItems: ExtractedItem[] = data.items.map(item => {
                        const matched = matchProduct(item.name, products);
                        const slipAmount = (item as any).amount || 0; // EXACT total from left margin
                        
                        // The slip amount IS the line total — it's the ground truth
                        let lineTotal = slipAmount;
                        let unitPrice = 0;
                        
                        if (lineTotal > 0 && item.qty > 0) {
                            // Derive unit price from the written total (may not be a round number)
                            unitPrice = lineTotal / item.qty;
                        } else if (matched) {
                            unitPrice = matched.price;
                            lineTotal = unitPrice * item.qty;
                        }
                        
                        return {
                            name: item.name,
                            qty: item.qty,
                            unit: (item as any).unit || 'pcs',
                            confidence: (item as any).confidence || 0,
                            matchedProduct: matched,
                            unitPrice,
                            lineTotal,
                        };
                    });
                    setItems(enrichedItems);
                } else if (data && data.items && data.items.length === 0) {
                    setErrorMsg('AI could not find any items in this image. Try a clearer photo with readable handwriting.');
                } else {
                    setErrorMsg('Could not read the slip. Please try a clearer picture.');
                }
            } catch (err: any) {
                console.error(err);
                const msg = err?.message || 'Failed to process image.';
                if (msg.includes('quota') || msg.includes('429')) {
                    setErrorMsg('AI API quota exceeded. Please wait a moment and try again.');
                } else {
                    setErrorMsg(msg);
                }
            } finally {
                setIsProcessing(false);
                setProcessingStep('');
            }
        };
        reader.onerror = () => {
            setErrorMsg('Failed to read the image file.');
            setIsProcessing(false);
        };
        reader.readAsDataURL(file);
        event.target.value = '';
    };

    // ── Item Edit Controls ────────────────────────────────────────────────────
    const updateItemName = (index: number, name: string) => {
        setItems(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], name };
            return updated;
        });
    };

    const updateItemQty = (index: number, delta: number) => {
        setItems(prev => {
            const updated = [...prev];
            const newQty = Math.max(0, updated[index].qty + delta);
            if (newQty === 0) {
                updated.splice(index, 1);
            } else {
                // Keep unitPrice same, recalculate lineTotal
                const unitPrice = updated[index].unitPrice;
                updated[index] = { ...updated[index], qty: newQty, lineTotal: unitPrice * newQty };
            }
            return updated;
        });
    };

    const updateItemPrice = (index: number, price: string) => {
        const numPrice = parseFloat(price) || 0;
        setItems(prev => {
            const updated = [...prev];
            // Update both unitPrice and lineTotal
            updated[index] = { ...updated[index], unitPrice: numPrice, lineTotal: numPrice * updated[index].qty };
            return updated;
        });
    };

    const updateLineTotal = (index: number, total: string) => {
        const numTotal = parseFloat(total) || 0;
        setItems(prev => {
            const updated = [...prev];
            const qty = updated[index].qty;
            updated[index] = { ...updated[index], lineTotal: numTotal, unitPrice: qty > 0 ? numTotal / qty : 0 };
            return updated;
        });
    };

    const removeItem = (index: number) => {
        setItems(prev => prev.filter((_, i) => i !== index));
    };

    // ── Totals ──────────────────────────────────────────────────────────────
    // Use lineTotal (the exact slip amount) for the grand total, not unitPrice × qty
    const totalAmount = items.reduce((sum, item) => sum + item.lineTotal, 0);
    const activeItems = items.filter(i => i.qty > 0);

    // ── Save slip image to customer database ────────────────────────────────
    const saveSlipToCustomer = async () => {
        if (!previewUri || !customerName) return;
        try {
            const customers = await getCustomers();
            // Try to match by name (case-insensitive)
            const matched = customers.find(c =>
                c.name.toLowerCase() === customerName.toLowerCase() ||
                c.name.toLowerCase().includes(customerName.toLowerCase()) ||
                customerName.toLowerCase().includes(c.name.toLowerCase())
            );
            if (matched) {
                const updatedSlips = [...(matched.slipImages || []), previewUri];
                await updateCustomer(matched.id, { slipImages: updatedSlips });
                console.log(`[Slip] Saved slip image to customer: ${matched.name}`);
                return matched.name;
            }
        } catch (err) {
            console.warn('[Slip] Could not save slip to customer:', err);
        }
        return null;
    };

    const handleImport = async () => {
        if (activeItems.length === 0) {
            console.warn('[Slip] No active items to import');
            return;
        }

        console.log(`[Slip] Importing ${activeItems.length} items to billing...`);

        // Save slip image to customer database (fire and forget)
        saveSlipToCustomer().catch(() => {});

        // Prepare import data
        const importData = activeItems.map(i => ({
            name: i.name,
            qty: i.qty,
            unit: i.unit,
            price: i.unitPrice,
            lineTotal: i.lineTotal,
        }));

        console.log('[Slip] Import data:', JSON.stringify(importData.slice(0, 3), null, 2), '...');

        // Navigate to billing tab (it's nested inside MainTabs tab navigator)
        try {
            navigation.navigate('MainTabs', {
                screen: 'billing',
                params: { importedItems: importData },
            });
            console.log('[Slip] ✅ Navigation to billing triggered');
        } catch (err) {
            console.error('[Slip] Navigation failed:', err);
            window.alert(`Import failed: ${err}`);
        }
    };

    const handleRetry = () => {
        setItems([]);
        setPreviewUri(null);
        setErrorMsg(null);
        setCustomerName('');
        setCustomerPhone('');
    };

    const hasResults = items.length > 0;

    return (
        <View style={styles.container}>
            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleFileChange}
            />

            {/* Back Button */}
            <View style={styles.backBar}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <Text style={styles.backBtnText}>← Back</Text>
                </TouchableOpacity>
                <Text style={styles.backBarTitle}>Process Slip</Text>
                <View style={{ width: 70 }} />
            </View>

            {/* Empty state */}
            {!hasResults && !isProcessing && !errorMsg && (
                <View style={styles.emptyState}>
                    <Text style={styles.icon}>📄</Text>
                    <Text style={styles.title}>Extract Handwritten Slip</Text>
                    <Text style={styles.desc}>
                        Upload a photo of a customer's handwritten list and AI will automatically read the items and quantities.
                    </Text>
                    <Text style={styles.featureList}>
                        ✨ Multi-language support (English, Hindi, Telugu){'\n'}
                        ✨ Reads messy handwriting{'\n'}
                        ✨ Auto-detects customer name & phone{'\n'}
                        ✨ Confidence scoring for each item
                    </Text>
                    <TouchableOpacity style={styles.captureBtn} onPress={handleUploadClick}>
                        <Text style={styles.captureBtnText}>📁 UPLOAD SLIP</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Error state */}
            {errorMsg && !isProcessing && (
                <View style={styles.errorState}>
                    {previewUri && (
                        <Image source={{ uri: previewUri }} style={styles.previewImage} resizeMode="contain" />
                    )}
                    <Text style={styles.errorIcon}>⚠️</Text>
                    <Text style={styles.errorTitle}>Extraction Failed</Text>
                    <Text style={styles.errorText}>{errorMsg}</Text>
                    <View style={styles.errorActions}>
                        <TouchableOpacity style={styles.retryBtnLg} onPress={handleRetry}>
                            <Text style={styles.retryBtnText}>🔄 Try Again</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.captureBtn} onPress={handleUploadClick}>
                            <Text style={styles.captureBtnText}>📁 Upload Different</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {/* Processing state */}
            {isProcessing && (
                <View style={styles.loadingState}>
                    {previewUri && (
                        <Image source={{ uri: previewUri }} style={styles.previewImageSmall} resizeMode="contain" />
                    )}
                    <ActivityIndicator size="large" color={COLORS.PRIMARY} />
                    <Text style={styles.loadingText}>AI is reading the slip...</Text>
                    <Text style={styles.loadingStep}>{processingStep}</Text>
                    <Text style={styles.loadingHint}>Trying multiple AI models for best results...</Text>
                </View>
            )}

            {/* Result state with editable items */}
            {hasResults && (
                <View style={styles.resultContainer}>
                    {/* Header row: Thumbnail + title */}
                    <View style={styles.resultHeader}>
                        {previewUri && (
                            <Image source={{ uri: previewUri }} style={styles.thumbImg} resizeMode="cover" />
                        )}
                        <View style={{ flex: 1 }}>
                            <Text style={styles.resultTitle}>
                                ✅ {items.length} Items Extracted
                            </Text>
                            {/* Customer info (Editable) */}
                            <View style={styles.customerEditRow}>
                                <Text style={styles.customerIcon}>👤</Text>
                                <TextInput
                                    style={styles.customerInput}
                                    value={customerName}
                                    onChangeText={setCustomerName}
                                    placeholder="Customer Name"
                                    placeholderTextColor="#999"
                                />
                                <Text style={styles.customerIcon}>📱</Text>
                                <TextInput
                                    style={[styles.customerInput, { flex: 0.8 }]}
                                    value={customerPhone}
                                    onChangeText={setCustomerPhone}
                                    placeholder="Phone"
                                    placeholderTextColor="#999"
                                    keyboardType="phone-pad"
                                />
                            </View>
                        </View>
                        <TouchableOpacity onPress={handleUploadClick} style={styles.reUploadBtn}>
                            <Text style={styles.reUploadText}>📁 New</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Items list */}
                    <ScrollView style={[styles.itemList, { paddingTop: 6 }]}>
                        {items.map((item, index) => {
                            const standardTotal = item.matchedProduct ? item.matchedProduct.price * item.qty : 0;
                            const isNonStandardPrice = !!item.matchedProduct && Math.abs(standardTotal - item.lineTotal) > 0.01;

                            return (
                                <View key={index} style={[styles.itemRow, isNonStandardPrice && styles.itemRowWarning]}>
                                    {/* Top Line: Index, Name, Remove */}
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <View style={styles.itemIndex}>
                                            <Text style={styles.itemIndexText}>{index + 1}</Text>
                                        </View>
                                        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                                            <TextInput
                                                style={[styles.itemNameInput, { flex: 1, fontSize: 16, fontWeight: 'bold' }]}
                                                value={item.name}
                                                onChangeText={(val) => updateItemName(index, val)}
                                                placeholder="Item name"
                                                placeholderTextColor="#bbb"
                                            />
                                            <Text style={styles.itemUnit}> ({item.unit})</Text>
                                        </View>
                                        <TouchableOpacity style={styles.removeBtn} onPress={() => removeItem(index)}>
                                            <Text style={styles.removeBtnText}>✕</Text>
                                        </TouchableOpacity>
                                    </View>

                                    {/* Bottom Line: Price, Qty, Total */}
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 30, marginTop: 8 }}>
                                        {/* Unit price */}
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.unitPriceLabel, isNonStandardPrice && styles.warningText, { fontSize: 13 }]}>
                                                {item.unitPrice > 0 ? `₹${item.unitPrice.toFixed(2)}/pc` : '—'}
                                            </Text>
                                            {isNonStandardPrice && (
                                                <Text style={styles.warningSubText}>
                                                    Std: ₹{item.matchedProduct!.price}
                                                </Text>
                                            )}
                                        </View>

                                        {/* Qty controls */}
                                        <View style={styles.qtyCol}>
                                            <TouchableOpacity style={styles.qtyBtn} onPress={() => updateItemQty(index, -1)}>
                                                <Text style={styles.qtyBtnText}>−</Text>
                                            </TouchableOpacity>
                                            <Text style={styles.qtyValue}>{item.qty}</Text>
                                            <TouchableOpacity style={[styles.qtyBtn, styles.qtyBtnPlus]} onPress={() => updateItemQty(index, 1)}>
                                                <Text style={[styles.qtyBtnText, { color: '#fff' }]}>+</Text>
                                            </TouchableOpacity>
                                        </View>

                                        {/* Line Total */}
                                        <View style={[styles.totalCol, {flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginLeft: 10}]}>
                                            {isNonStandardPrice && <Text style={{fontSize: 14, marginRight: 4}}>⚠️</Text>}
                                            <View style={styles.totalInputRow}>
                                                <Text style={[styles.rupeeSign, {fontSize: 14}]}>₹</Text>
                                                <TextInput
                                                    style={[styles.totalInput, isNonStandardPrice && styles.warningInput, { width: 70, height: 32, fontSize: 15 }]}
                                                    value={item.lineTotal > 0 ? String(Math.round(item.lineTotal)) : ''}
                                                    onChangeText={(val) => updateLineTotal(index, val)}
                                                    keyboardType="numeric"
                                                    placeholder="0"
                                                    placeholderTextColor="#bbb"
                                                />
                                            </View>
                                        </View>
                                    </View>
                                </View>
                            );
                        })}
                    </ScrollView>

                    {/* Footer: total + actions */}
                    <View style={styles.footer}>
                        <View style={styles.totalBar}>
                            <Text style={styles.totalLabel}>{activeItems.length} items</Text>
                            <Text style={styles.grandTotal}>
                                {totalAmount > 0 ? `₹${totalAmount.toFixed(2)}` : 'Set prices above'}
                            </Text>
                        </View>
                        <View style={styles.footerActions}>
                            <TouchableOpacity style={styles.retryBtn} onPress={handleRetry}>
                                <Text style={styles.retryBtnText}>🔄 Retry</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.importBtn} onPress={handleImport}>
                                <Text style={styles.importBtnText}>
                                    🧾 Import {activeItems.length} Items to Bill
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.BACKGROUND },
    backBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.WHITE, paddingHorizontal: SPACING.MD, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.BORDER },
    backBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 8, borderRadius: RADIUS.MD, backgroundColor: COLORS.BACKGROUND },
    backBtnText: { color: COLORS.PRIMARY, fontWeight: '700', fontSize: 15 },
    backBarTitle: { fontSize: 16, fontWeight: '700', color: COLORS.TEXT_HEADING },

    // Empty state
    emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.XL },
    icon: { fontSize: 64, marginBottom: SPACING.LG },
    title: { fontSize: 24, fontWeight: 'bold', color: COLORS.TEXT_HEADING, textAlign: 'center' },
    desc: { fontSize: 16, color: COLORS.TEXT_DIM, textAlign: 'center', marginTop: SPACING.MD, marginBottom: SPACING.MD },
    featureList: { fontSize: 13, color: COLORS.TEXT_DIM, textAlign: 'center', lineHeight: 22, marginBottom: SPACING.XL, backgroundColor: COLORS.WHITE, padding: SPACING.MD, borderRadius: RADIUS.LG },
    captureBtn: { backgroundColor: COLORS.PRIMARY, paddingVertical: 15, paddingHorizontal: 40, borderRadius: RADIUS.XL, elevation: 3 },
    captureBtnText: { color: COLORS.WHITE, fontSize: 18, fontWeight: '700' },

    // Error state
    errorState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.XL },
    errorIcon: { fontSize: 48, marginBottom: SPACING.MD },
    errorTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.ERROR, marginBottom: SPACING.SM },
    errorText: { fontSize: 14, color: COLORS.TEXT_DIM, textAlign: 'center', marginBottom: SPACING.LG, maxWidth: 300 },
    errorActions: { gap: SPACING.MD, alignItems: 'center' },
    previewImage: { width: 200, height: 200, borderRadius: RADIUS.LG, marginBottom: SPACING.MD, borderWidth: 1, borderColor: COLORS.BORDER },

    // Loading state
    loadingState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.XL },
    loadingText: { marginTop: SPACING.MD, fontSize: 18, color: COLORS.TEXT_BODY, fontWeight: '700' },
    loadingStep: { marginTop: SPACING.SM, fontSize: 14, color: COLORS.PRIMARY, fontWeight: '600' },
    loadingHint: { marginTop: SPACING.SM, fontSize: 12, color: COLORS.TEXT_DIM, textAlign: 'center' },
    previewImageSmall: { width: 150, height: 150, borderRadius: RADIUS.LG, marginBottom: SPACING.LG, borderWidth: 1, borderColor: COLORS.BORDER, opacity: 0.7 },

    // ── Result State ─────────────────────────────────────────────────────────
    resultContainer: { flex: 1, padding: SPACING.MD },

    // Header
    resultHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.MD, marginBottom: SPACING.MD },
    thumbImg: { width: 50, height: 50, borderRadius: RADIUS.MD, borderWidth: 1, borderColor: COLORS.BORDER },
    resultTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.TEXT_HEADING },
    customerEditRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4, width: '100%' },
    customerIcon: { fontSize: 14 },
    customerInput: { flex: 1, height: 26, backgroundColor: COLORS.BACKGROUND, borderRadius: 4, paddingHorizontal: 6, fontSize: 13, color: COLORS.TEXT_BODY, borderWidth: 1, borderColor: COLORS.BORDER },
    reUploadBtn: { backgroundColor: COLORS.BACKGROUND, paddingHorizontal: 10, paddingVertical: 6, borderRadius: RADIUS.MD, borderWidth: 1, borderColor: COLORS.BORDER },
    reUploadText: { fontSize: 12, fontWeight: '600', color: COLORS.TEXT_DIM },

    // Column headers
    colHeader: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.XS, paddingHorizontal: 4, borderBottomWidth: 2, borderBottomColor: COLORS.PRIMARY, marginBottom: 2 },
    colLabel: { fontSize: 10, fontWeight: '800', color: COLORS.TEXT_DIM, textTransform: 'uppercase', letterSpacing: 0.5 },

    // Items list
    itemList: { flex: 1 },
    itemRow: {
        paddingVertical: 12, paddingHorizontal: 12,
        borderBottomWidth: 1, borderBottomColor: COLORS.BORDER, backgroundColor: COLORS.WHITE,
        marginBottom: 8, borderRadius: 8, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2,
    },

    // Item name column
    itemNameCol: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
    itemIndex: { width: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.PRIMARY + '20', justifyContent: 'center', alignItems: 'center' },
    itemIndexText: { fontSize: 10, fontWeight: '700', color: COLORS.PRIMARY },
    itemName: { fontSize: 13, color: COLORS.TEXT_BODY, fontWeight: '500' },
    itemNameInput: {
        fontSize: 13, color: COLORS.TEXT_BODY, fontWeight: '500',
        borderBottomWidth: 1, borderBottomColor: COLORS.BORDER + '80',
        paddingVertical: 2, paddingHorizontal: 2, marginBottom: 1,
    },
    itemUnit: { fontSize: 10, color: COLORS.TEXT_DIM, marginTop: 1 },

    // Price column (derived unit price label)
    priceCol: { width: 80, alignItems: 'center', justifyContent: 'center' },
    unitPriceLabel: { fontSize: 11, color: COLORS.TEXT_DIM, fontWeight: '500' },
    rupeeSign: { fontSize: 12, color: COLORS.TEXT_DIM, marginRight: 1 },
    priceInput: {
        width: 50, height: 28, borderWidth: 1, borderColor: COLORS.BORDER,
        borderRadius: 6, paddingHorizontal: 4, fontSize: 13, fontWeight: '600',
        textAlign: 'center', color: COLORS.TEXT_HEADING, backgroundColor: COLORS.BACKGROUND,
    },

    // Qty column
    qtyCol: { width: 110, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
    qtyBtn: {
        width: 28, height: 28, borderRadius: 14, borderWidth: 1.5,
        borderColor: COLORS.BORDER, justifyContent: 'center', alignItems: 'center',
        backgroundColor: COLORS.BACKGROUND,
    },
    qtyBtnPlus: { backgroundColor: COLORS.PRIMARY, borderColor: COLORS.PRIMARY },
    qtyBtnText: { fontSize: 16, fontWeight: '700', color: COLORS.TEXT_HEADING, lineHeight: 18 },
    qtyValue: { fontSize: 15, fontWeight: '700', color: COLORS.TEXT_HEADING, minWidth: 28, textAlign: 'center' },

    // Total column (editable line total from slip)
    totalCol: { width: 80, alignItems: 'flex-end' },
    totalInputRow: { flexDirection: 'row', alignItems: 'center' },
    totalInput: {
        width: 55, height: 28, borderWidth: 1, borderColor: COLORS.PRIMARY + '40',
        borderRadius: 6, paddingHorizontal: 4, fontSize: 13, fontWeight: '700',
        textAlign: 'center', color: COLORS.PRIMARY, backgroundColor: COLORS.PRIMARY + '08',
    },
    totalText: { fontSize: 13, fontWeight: '700', color: COLORS.PRIMARY },

    // Remove button
    removeBtn: { width: 30, alignItems: 'center', justifyContent: 'center' },
    removeBtnText: { fontSize: 14, color: COLORS.ERROR, fontWeight: '600' },

    // Footer
    footer: { paddingTop: SPACING.SM, borderTopWidth: 1, borderTopColor: COLORS.BORDER },
    totalBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: SPACING.SM },
    totalLabel: { fontSize: 13, color: COLORS.TEXT_DIM, fontWeight: '600' },
    grandTotal: { fontSize: 20, fontWeight: '800', color: COLORS.PRIMARY },
    footerActions: { flexDirection: 'row', gap: SPACING.MD, paddingBottom: SPACING.SM },
    retryBtn: { flex: 1, padding: SPACING.MD, borderRadius: RADIUS.LG, borderWidth: 1, borderColor: COLORS.BORDER, alignItems: 'center', backgroundColor: COLORS.WHITE },
    retryBtnLg: { padding: SPACING.MD, paddingHorizontal: SPACING.XL, borderRadius: RADIUS.LG, borderWidth: 1, borderColor: COLORS.BORDER, alignItems: 'center', backgroundColor: COLORS.WHITE },
    retryBtnText: { color: COLORS.TEXT_DIM, fontWeight: 'bold' },
    importBtn: { flex: 2, backgroundColor: COLORS.SUCCESS, padding: SPACING.MD, borderRadius: RADIUS.LG, alignItems: 'center', elevation: 2 },
    importBtnText: { color: COLORS.WHITE, fontWeight: 'bold', fontSize: 15 },

    // Warnings for non-standard pricing
    itemRowWarning: { backgroundColor: COLORS.WARNING + '10' },
    warningText: { color: COLORS.ERROR, fontWeight: '700' },
    warningSubText: { fontSize: 9, color: COLORS.ERROR, marginTop: 2, fontWeight: '600' },
    warningInput: { borderColor: COLORS.ERROR, color: COLORS.ERROR, backgroundColor: COLORS.ERROR + '10' },
});

export default SlipProcessingScreen;
