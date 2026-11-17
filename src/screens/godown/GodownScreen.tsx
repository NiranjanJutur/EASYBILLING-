import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, RefreshControl, Alert } from 'react-native';
import { COLORS, SPACING, RADIUS } from '../../config/theme';
import { getGodownProducts, addGodownProduct, pullStockToLocalStore } from '../../services/database/godownService';
import { Product } from '../../models/Product';
import { formatCurrency } from '../../utils/billingUtils';
import AddProductModal from '../../components/AddProductModal';

const stockColor = (stock: number, min: number) =>
    stock === 0 ? COLORS.ERROR : stock <= min ? COLORS.WARNING : COLORS.SUCCESS;

const GodownScreen = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);

    const loadProducts = useCallback(async () => {
        const data = await getGodownProducts();
        setProducts(data);
        setLoading(false);
    }, []);

    useEffect(() => { loadProducts(); }, [loadProducts]);

    const displayed = products
        .filter(p => {
            const q = search.toLowerCase();
            return p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
        });

    const onRefresh = async () => { setRefreshing(true); await loadProducts(); setRefreshing(false); };

    const handlePull = async (item: Product) => {
        const qtyStr = window.prompt(`How many units of ${item.name} (${item.unit}) do you want to pull into your shop?`);
        if (!qtyStr) return;
        const qty = Number(qtyStr);
        if (isNaN(qty) || qty <= 0) {
            window.alert('Invalid quantity.');
            return;
        }

        try {
            await pullStockToLocalStore(item, qty);
            window.alert(`Successfully pulled ${qty} ${item.unit} of ${item.name} to your local shop!`);
            loadProducts(); // Refresh godown stock
        } catch (error: any) {
            window.alert(`Failed to pull stock: ${error.message}`);
        }
    };

    const renderItem = ({ item }: { item: Product }) => (
        <View style={styles.row}>
            <View style={styles.rowInfo}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemCategory}>{item.category}</Text>
                <Text style={styles.itemPrice}>
                    {formatCurrency(item.price)} / {item.unit}
                </Text>
            </View>
            <View style={styles.rowRight}>
                <Text style={styles.stockUnit}>Godown Stock: {item.currentStock} {item.unit}</Text>
                <TouchableOpacity style={styles.restockBtn} onPress={() => handlePull(item)}>
                    <Text style={styles.restockText}>🚌 Pull to Shop</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.title}>Central Godown</Text>
                    <Text style={styles.subtitle}>{products.length} products in Godown</Text>
                </View>
                <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddModal(true)}>
                    <Text style={styles.addBtnText}>➕ Add to Godown</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.searchBox}>
                <Text style={styles.searchIcon}>🔍</Text>
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search by name or category..."
                    placeholderTextColor={COLORS.TEXT_DIM}
                    value={search}
                    onChangeText={setSearch}
                />
            </View>

            <FlatList
                data={displayed}
                keyExtractor={item => item.id}
                renderItem={renderItem}
                contentContainerStyle={styles.list}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.PRIMARY]} />}
                ListEmptyComponent={
                    <View style={styles.center}>
                        <Text style={styles.emptyIcon}>🏢</Text>
                        <Text style={styles.emptyText}>
                            {loading ? 'Loading...' : 'No products in Godown.'}
                        </Text>
                    </View>
                }
            />

            <AddProductModal 
                visible={showAddModal} 
                onClose={() => setShowAddModal(false)} 
                onAdded={loadProducts} 
                customAddData={addGodownProduct}
                customGetProducts={getGodownProducts}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.BACKGROUND },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.LG, backgroundColor: COLORS.WHITE, borderBottomWidth: 1, borderBottomColor: COLORS.BORDER },
    title: { fontSize: 22, fontWeight: '800', color: COLORS.TEXT_HEADING },
    subtitle: { fontSize: 12, color: COLORS.TEXT_DIM },
    addBtn: { backgroundColor: COLORS.PRIMARY, paddingHorizontal: SPACING.MD, paddingVertical: 8, borderRadius: RADIUS.MD },
    addBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
    searchBox: { flexDirection: 'row', alignItems: 'center', margin: SPACING.SM, backgroundColor: COLORS.WHITE, borderRadius: RADIUS.MD, paddingHorizontal: SPACING.MD, borderWidth: 1, borderColor: COLORS.BORDER },
    searchIcon: { fontSize: 16, marginRight: SPACING.SM },
    searchInput: { flex: 1, height: 40, color: COLORS.TEXT_BODY },
    list: { paddingHorizontal: SPACING.SM, paddingBottom: SPACING.XL },
    row: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.WHITE, borderRadius: RADIUS.LG, padding: SPACING.MD, marginBottom: SPACING.SM, elevation: 1, gap: SPACING.SM },
    rowInfo: { flex: 1 },
    itemName: { fontSize: 16, fontWeight: '700', color: COLORS.TEXT_HEADING },
    itemCategory: { fontSize: 12, color: COLORS.TEXT_DIM, marginTop: 1 },
    itemPrice: { fontSize: 12, color: COLORS.TEXT_BODY, marginTop: 3 },
    rowRight: { alignItems: 'flex-end', gap: 8 },
    stockUnit: { fontSize: 14, fontWeight: 'bold', color: COLORS.TEXT_HEADING },
    restockBtn: { backgroundColor: COLORS.SUCCESS + '22', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: COLORS.SUCCESS },
    restockText: { fontSize: 12, color: COLORS.SUCCESS, fontWeight: '700' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.XL },
    emptyIcon: { fontSize: 40, marginBottom: SPACING.SM },
    emptyText: { color: COLORS.TEXT_DIM, fontSize: 14 },
});

export default GodownScreen;
