import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList,
    TouchableOpacity, TextInput, RefreshControl,
    Image, StatusBar,
} from 'react-native';
import {
    COLORS, SPACING, RADIUS, FONT_SIZE,
    FONT_WEIGHT, GRADIENTS, SHADOW,
} from '../../config/theme';
import { getCustomers } from '../../services/firebase/firestoreService';
import { Customer } from '../../models/Customer';
import { formatCurrency } from '../../utils/billingUtils';
import AddCustomerModal from '../../components/AddCustomerModal';
import CustomerProfileScreen from './CustomerProfileScreen';
import GradientView from '../../components/GradientView';

const TYPE_GRADIENTS: Record<string, string[]> = {
    house:        GRADIENTS.SUCCESS,
    small_shop:   GRADIENTS.GOLD_RICH,
    hotel:        GRADIENTS.PRIMARY_CARD,
    function:     GRADIENTS.PURPLE,
    wholesale:    GRADIENTS.INFO,
    vip:          GRADIENTS.GOLD,
};
const typeGrad = (t: string) => TYPE_GRADIENTS[t] || GRADIENTS.PRIMARY_CARD;

const TYPE_LABELS: Record<string, string> = {
    house: 'Home',
    small_shop: 'Retailer',
    hotel: 'Hotel',
    function: 'Event',
    wholesale: 'Wholesale',
    vip: 'VIP',
};

const CustomerCard = ({
    customer,
    onPress,
}: {
    customer: Customer;
    onPress: () => void;
}) => (
    <TouchableOpacity
        style={styles.card}
        onPress={onPress}
        activeOpacity={0.78}
    >
        {/* Gradient avatar */}
        <GradientView colors={typeGrad(customer.type)} style={styles.avatar}>
            {customer.photoUrl ? (
                <Image source={{ uri: customer.photoUrl }} style={styles.avatarImg} />
            ) : (
                <Text style={styles.avatarText}>
                    {customer.name.charAt(0).toUpperCase()}
                </Text>
            )}
        </GradientView>

        {/* Info */}
        <View style={styles.cardInfo}>
            <Text style={styles.name}>{customer.name}</Text>
            <Text style={styles.phone}>{customer.phone}</Text>
            <View style={styles.typePill}>
                <Text style={styles.typeText}>
                    {TYPE_LABELS[customer.type] || customer.type}
                </Text>
            </View>
        </View>

        {/* Balance */}
        <View style={styles.balanceWrap}>
            {customer.totalOutstanding > 0 ? (
                <View style={styles.debtPill}>
                    <Text style={styles.debtAmount}>
                        {formatCurrency(customer.totalOutstanding)}
                    </Text>
                    <Text style={styles.debtLabel}>owed</Text>
                </View>
            ) : (
                <View style={styles.clearPill}>
                    <Text style={styles.clearText}>✅ Clear</Text>
                </View>
            )}
        </View>
    </TouchableOpacity>
);

const CustomersScreen = () => {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [filtered, setFiltered] = useState<Customer[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

    const loadCustomers = useCallback(async () => {
        const data = await getCustomers();
        setCustomers(data);
        setFiltered(data);
        setLoading(false);
    }, []);

    useEffect(() => { loadCustomers(); }, [loadCustomers]);

    useEffect(() => {
        const q = search.toLowerCase();
        setFiltered(
            customers.filter(
                c =>
                    c.name.toLowerCase().includes(q) ||
                    (c.udhaarId && c.udhaarId.toLowerCase().includes(q)) ||
                    c.phone.includes(q)
            )
        );
    }, [search, customers]);

    const onRefresh = async () => {
        setRefreshing(true);
        await loadCustomers();
        setRefreshing(false);
    };

    if (selectedCustomer) {
        return (
            <CustomerProfileScreen
                customer={selectedCustomer}
                onBack={() => setSelectedCustomer(null)}
            />
        );
    }

    const totalDebt = customers.reduce((s, c) => s + c.totalOutstanding, 0);

    // Calculate next incremental Udhaar ID (e.g. UDH-001, UDH-002)
    const getNextUdhaarId = () => {
        if (!customers.length) return 'UDH-001';
        
        // Extract numbers from IDs like "UDH-045" or "045"
        const numbers = customers
            .map(c => {
                const id = c.udhaarId || '';
                const match = id.match(/\d+/);
                return match ? parseInt(match[0], 10) : 0;
            })
            .filter(n => !isNaN(n));
        
        const nextNum = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
        return `UDH-${nextNum.toString().padStart(3, '0')}`;
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={COLORS.PRIMARY_DARK} />

            {/* ── Gradient Header ── */}
            <GradientView colors={GRADIENTS.PRIMARY_BANNER} style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>Customers</Text>
                    <Text style={styles.headerSub}>
                        {customers.length} total  ·  ₹{Math.round(totalDebt).toLocaleString('en-IN')} outstanding
                    </Text>
                </View>
                <TouchableOpacity
                    onPress={() => setShowAddModal(true)}
                    activeOpacity={0.8}
                >
                    <GradientView colors={GRADIENTS.GOLD_RICH} style={styles.addBtn}>
                        <Text style={styles.addBtnText}>＋ Add</Text>
                    </GradientView>
                </TouchableOpacity>
            </GradientView>

            {/* ── Search ── */}
            <View style={styles.searchWrap}>
                <Text style={styles.searchIcon}>🔍</Text>
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search name, phone, ID…"
                    placeholderTextColor={COLORS.TEXT_PLACEHOLDER}
                    value={search}
                    onChangeText={setSearch}
                />
            </View>

            {/* ── List ── */}
            <FlatList
                data={filtered}
                keyExtractor={item => item.id}
                renderItem={({ item }) => (
                    <CustomerCard
                        customer={item}
                        onPress={() => setSelectedCustomer(item)}
                    />
                )}
                contentContainerStyle={styles.list}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={[COLORS.PRIMARY]}
                        tintColor={COLORS.PRIMARY}
                    />
                }
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <Text style={styles.emptyIcon}>{loading ? '⏳' : '👥'}</Text>
                        <Text style={styles.emptyText}>
                            {loading ? 'Loading…' : 'No customers found.'}
                        </Text>
                    </View>
                }
            />

            <AddCustomerModal
                visible={showAddModal}
                onClose={() => setShowAddModal(false)}
                onAdded={loadCustomers}
                nextUdhaarId={getNextUdhaarId()}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.BACKGROUND },

    // Header
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: SPACING.LG,
        paddingTop: 52,
        paddingBottom: SPACING.LG,
    },
    headerTitle: {
        fontSize: FONT_SIZE.XL + 4,
        fontWeight: FONT_WEIGHT.BLACK,
        color: '#FFFFFF',
    },
    headerSub: {
        fontSize: FONT_SIZE.XS,
        color: 'rgba(255,255,255,0.62)',
        marginTop: 2,
    },
    addBtn: {
        paddingHorizontal: SPACING.LG,
        paddingVertical: SPACING.SM + 2,
        borderRadius: RADIUS.MD,
    },
    addBtnText: {
        color: '#fff',
        fontWeight: FONT_WEIGHT.BOLD,
        fontSize: FONT_SIZE.SM,
    },

    // Search
    searchWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        margin: SPACING.MD,
        backgroundColor: COLORS.WHITE,
        borderRadius: RADIUS.LG,
        paddingHorizontal: SPACING.MD,
        borderWidth: 1.5,
        borderColor: COLORS.BORDER,
        ...SHADOW.LIGHT,
    },
    searchIcon: { fontSize: 16, marginRight: SPACING.SM },
    searchInput: {
        flex: 1,
        height: 44,
        color: COLORS.TEXT_BODY,
        fontSize: FONT_SIZE.MD,
    },

    // Cards
    list: { paddingHorizontal: SPACING.MD, paddingBottom: SPACING.XXL },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.WHITE,
        borderRadius: RADIUS.LG,
        padding: SPACING.MD,
        marginBottom: SPACING.SM,
        gap: SPACING.MD,
        borderWidth: 1,
        borderColor: COLORS.BORDER,
        ...SHADOW.LIGHT,
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    avatarImg: { width: 50, height: 50, borderRadius: 25 },
    avatarText: {
        color: '#fff',
        fontWeight: FONT_WEIGHT.EXTRABOLD,
        fontSize: FONT_SIZE.LG,
    },
    cardInfo: { flex: 1 },
    name: {
        fontSize: FONT_SIZE.MD,
        fontWeight: FONT_WEIGHT.BOLD,
        color: COLORS.TEXT_HEADING,
    },
    phone: {
        fontSize: FONT_SIZE.XS,
        color: COLORS.TEXT_DIM,
        marginTop: 1,
    },
    typePill: {
        marginTop: 5,
        alignSelf: 'flex-start',
        backgroundColor: COLORS.PRIMARY_BG,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: RADIUS.FULL,
    },
    typeText: {
        fontSize: 10,
        color: COLORS.PRIMARY,
        fontWeight: FONT_WEIGHT.BOLD,
    },
    balanceWrap: { alignItems: 'flex-end' },
    debtPill: {
        backgroundColor: COLORS.ERROR_BG,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: RADIUS.MD,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.ERROR + '30',
    },
    debtAmount: {
        fontSize: FONT_SIZE.SM,
        fontWeight: FONT_WEIGHT.EXTRABOLD,
        color: COLORS.ERROR,
    },
    debtLabel: {
        fontSize: 9,
        color: COLORS.ERROR,
        fontWeight: FONT_WEIGHT.SEMIBOLD,
    },
    clearPill: {
        backgroundColor: COLORS.SUCCESS_BG,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: RADIUS.MD,
    },
    clearText: {
        fontSize: FONT_SIZE.XS,
        color: COLORS.SUCCESS,
        fontWeight: FONT_WEIGHT.BOLD,
    },

    // Empty
    empty: { alignItems: 'center', paddingTop: 60 },
    emptyIcon: { fontSize: 42, marginBottom: SPACING.MD },
    emptyText: {
        color: COLORS.TEXT_DIM,
        fontSize: FONT_SIZE.MD,
        fontWeight: FONT_WEIGHT.MEDIUM,
    },
});

export default CustomersScreen;
