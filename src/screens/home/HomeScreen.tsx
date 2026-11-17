import React, { useEffect, useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    Alert, Platform, RefreshControl,
} from 'react-native';
import { COLORS, SPACING, RADIUS, FONT_SIZE, FONT_WEIGHT } from '../../config/theme';
import { getDailySalesSummary, getTransactions, getLowStockProducts } from '../../services/firebase/firestoreService';
import { useUdhaar } from '../../hooks/useUdhaar';
import { useVoice } from '../../hooks/useVoice';
import { formatCurrency } from '../../utils/billingUtils';
import { TRANSLATIONS, Language } from '../../utils/i18n';
import { Transaction } from '../../models/Transaction';
import { Product } from '../../models/Product';
import AddProductModal from '../../components/AddProductModal';
import AIAssistantModal from '../../components/AIAssistantModal';
import { useStore } from '../../context/StoreContext';
import { useSession } from '../../context/SessionContext';
import { PURCHASE_ROLES, type StaffRole } from '../../models/Staff';
import SyncStatusPill from '../../components/SyncStatusPill';
import UpiQrModal from '../../components/UpiQrModal';

// ────────────────────────────────────────────────────────────────────────────────
// Sub-Components
// ────────────────────────────────────────────────────────────────────────────────

const StatCard = ({ icon, label, value, color, small }: {
    icon: string; label: string; value: string; color: string; small?: boolean;
}) => (
    <View style={[styles.statCard, small && styles.statCardSmall]}>
        <Text style={styles.statIcon}>{icon}</Text>
        <Text style={[styles.statValue, { color }]} numberOfLines={1}>{value}</Text>
        <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
    </View>
);

const QuickAction = ({ icon, label, onPress, badge, accent }: {
    icon: string; label: string; onPress: () => void; badge?: string; accent?: string;
}) => (
    <TouchableOpacity
        style={[styles.quickAction, accent ? { borderColor: accent, borderWidth: 1.5 } : null]}
        onPress={onPress}
        activeOpacity={0.7}
    >
        <View style={[styles.quickIconWrap, accent ? { backgroundColor: accent + '18' } : null]}>
            <Text style={styles.quickIcon}>{icon}</Text>
        </View>
        <Text style={styles.quickLabel} numberOfLines={1}>{label}</Text>
        {badge ? (
            <View style={[styles.quickBadge, { backgroundColor: accent || COLORS.PRIMARY }]}>
                <Text style={styles.quickBadgeText}>{badge}</Text>
            </View>
        ) : null}
    </TouchableOpacity>
);

const TransactionRow = ({ txn }: { txn: Transaction }) => {
    const time = new Date(txn.timestamp).toLocaleTimeString('en-IN', {
        hour: '2-digit', minute: '2-digit', hour12: true,
    });
    const payIcon = txn.paymentType === 'CASH' ? '💵' : txn.paymentType === 'UPI' ? '📱'
        : txn.paymentType === 'CARD' ? '💳' : txn.paymentType === 'UDHAAR' ? '📓' : '💰';
    const payColor = txn.paymentType === 'CASH' ? COLORS.SUCCESS : txn.paymentType === 'UPI' ? COLORS.PRIMARY
        : txn.paymentType === 'UDHAAR' ? COLORS.ERROR : COLORS.ACCENT;

    return (
        <View style={styles.txnRow}>
            <View style={styles.txnTimeCol}>
                <Text style={styles.txnTime}>{time}</Text>
                <Text style={styles.txnBillNo}>{txn.billNo}</Text>
            </View>
            <View style={styles.txnInfoCol}>
                <Text style={styles.txnCustomer} numberOfLines={1}>{txn.customerName || 'Walk-in'}</Text>
                <Text style={styles.txnItems}>{txn.items?.length || 0} items</Text>
            </View>
            <View style={styles.txnPayCol}>
                <Text style={[styles.txnAmount, { color: payColor }]}>{formatCurrency(txn.grandTotal)}</Text>
                <Text style={styles.txnPayType}>{payIcon} {txn.paymentType}</Text>
            </View>
        </View>
    );
};

const LowStockRow = ({ product }: { product: Product }) => {
    const pct = product.minThreshold > 0
        ? Math.round((product.currentStock / product.minThreshold) * 100) : 0;
    const barColor = pct < 30 ? COLORS.ERROR : pct < 70 ? COLORS.WARNING : COLORS.SUCCESS;

    return (
        <View style={styles.lowStockRow}>
            <View style={styles.lowStockInfo}>
                <Text style={styles.lowStockName} numberOfLines={1}>{product.name}</Text>
                <Text style={styles.lowStockMeta}>
                    {product.currentStock} {product.unit} left · Min: {product.minThreshold}
                </Text>
            </View>
            <View style={styles.lowStockBarWrap}>
                <View style={styles.lowStockBarTrack}>
                    <View style={[styles.lowStockBar, { width: `${Math.min(pct, 100)}%`, backgroundColor: barColor }]} />
                </View>
                <Text style={[styles.lowStockPct, { color: barColor }]}>{pct}%</Text>
            </View>
        </View>
    );
};

// ────────────────────────────────────────────────────────────────────────────────
// Main HomeScreen
// ────────────────────────────────────────────────────────────────────────────────

const HomeScreen = ({ role, navigation, lang = 'en' }: { role: string; navigation: any; lang?: Language }) => {
    const t = TRANSLATIONS[lang] || TRANSLATIONS.en;

    // State
    const [todaySales, setTodaySales] = useState(0);
    const [billsToday, setBillsToday] = useState(0);
    const [cashCollection, setCashCollection] = useState(0);
    const [upiCollection, setUpiCollection] = useState(0);
    const [lowStockCount, setLowStockCount] = useState(0);
    const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
    const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
    const [complianceStats, setComplianceStats] = useState({ irn: 0, permits: 0 });
    const [refreshing, setRefreshing] = useState(false);
    const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
    const [showAddProduct, setShowAddProduct] = useState(false);
    const [showAIAssistant, setShowAIAssistant] = useState(false);
    const [showUpiQr, setShowUpiQr] = useState(false);

    const { totalOutstanding, refresh: refreshUdhaar } = useUdhaar();
    const { startListening, isListening } = useVoice();
    const { activeStore } = useStore();
    const { staff, logout } = useSession();
    const canBill = role !== 'STOCK_MANAGER';
    const canBuy = PURCHASE_ROLES.includes(role as StaffRole);

    const confirmLogout = () => {
        if (Platform.OS === 'web') {
            if (window.confirm('Log out of this device?')) logout();
            return;
        }
        Alert.alert('Log out', 'Log out of this device?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Log out', style: 'destructive', onPress: logout },
        ]);
    };

    // ── Data Loading ──────────────────────────────────────────────────────────
    const loadData = async () => {
        try {
            setRefreshing(true);
            const istDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

            // Daily summary
            const summary = await getDailySalesSummary(istDate);
            if (summary) {
                setTodaySales(summary.total_revenue || 0);
                setBillsToday(summary.total_transactions || 0);
                setCashCollection(summary.cash_sales || 0);
                setUpiCollection(summary.upi_sales || 0);
            }

            // Recent transactions
            const txns = await getTransactions(20);
            const todayTxns = txns.filter(tx => tx.timestamp?.startsWith(istDate));
            setRecentTransactions(todayTxns.slice(0, 8));

            // Compliance stats — calculate from transactions as fallback
            setComplianceStats({
                irn: summary?.e_invoice_count || todayTxns.filter(tx => tx.irn).length,
                permits: summary?.permit_count || todayTxns.filter(tx => tx.ewayBillNo).length,
            });

            // Low stock
            const lowStock = await getLowStockProducts();
            setLowStockCount(lowStock.length);
            setLowStockProducts(lowStock.slice(0, 6));

            // Udhaar
            await refreshUdhaar();

            setLastRefreshTime(new Date());
        } catch (err: any) {
            console.error('[Home] Error loading dashboard:', err.message);
        } finally {
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => { loadData(); }, [])
    );

    // ── Voice Command ─────────────────────────────────────────────────────────
    const handleVoiceAdd = async () => {
        try {
            const text = await startListening();
            if (text) {
                Alert.alert('🎙️ Voice Command', `Heard: "${text}"`, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: '🧾 Go to Billing', onPress: () => navigation.navigate('billing', { voiceCommand: text }) },
                ]);
            }
        } catch (err: any) {
            if (err !== 'aborted') {
                const msg = typeof err === 'string' ? err : err.message || 'Microphone error';
                Alert.alert('Voice Error', msg);
            }
        }
    };

    const isOwner = role === 'OWNER';
    const isAccountant = role === 'ACCOUNTANT';
    const todayStr = new Date().toLocaleDateString('en-IN', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        timeZone: 'Asia/Kolkata',
    });
    const refreshAgo = lastRefreshTime
        ? `${Math.round((Date.now() - lastRefreshTime.getTime()) / 60000)} min ago`
        : '';

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <ScrollView
            style={styles.container}
            showsVerticalScrollIndicator={false}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={loadData} colors={[COLORS.PRIMARY]} />
            }
        >
            {/* ── Hero ─────────────────────────────────────────────────────── */}
            <View style={[styles.hero, { backgroundColor: activeStore.color }]}>
                <View style={styles.heroTop}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.greeting}>{activeStore.name}</Text>
                        <Text style={styles.heroDate}>{todayStr}</Text>
                    </View>
                    <View style={styles.heroBadges}>
                        <View style={styles.roleBadge}>
                            <Text style={styles.roleBadgeText}>
                                {staff?.name || t.roles[role as keyof typeof t.roles] || role}
                            </Text>
                        </View>
                        <TouchableOpacity
                            style={styles.logoutBtn}
                            onPress={confirmLogout}
                            accessibilityRole="button"
                            accessibilityLabel="Log out"
                        >
                            <Text style={styles.logoutText}>⎋ Log out</Text>
                        </TouchableOpacity>
                    </View>
                </View>
                <Text style={styles.appCaption}>{t.caption}</Text>
                {refreshAgo ? (
                    <Text style={styles.heroRefresh}>Last updated {refreshAgo}</Text>
                ) : null}
                <View style={{ marginTop: 10, alignSelf: 'flex-start' }}>
                    <SyncStatusPill onSynced={loadData} />
                </View>
            </View>



            {/* ── Quick Actions ────────────────────────────────────────────── */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t.actions.title}</Text>
                <View style={styles.actionGrid}>
                    {canBill && (
                        <QuickAction
                            icon="🧾" label={t.actions.bill}
                            onPress={() => navigation.navigate('billing')}
                            accent={COLORS.PRIMARY}
                        />
                    )}
                    {canBill && (
                        <QuickAction
                            icon="🎙️" label={isListening ? 'Listening...' : 'Voice Add'}
                            onPress={handleVoiceAdd}
                            accent="#E74C3C"
                            badge={isListening ? '●' : undefined}
                        />
                    )}
                    {canBill && (
                        <QuickAction
                            icon="📸" label="Scan Slip"
                            onPress={() => navigation.navigate('SlipProcessing')}
                            accent="#8E44AD"
                        />
                    )}
                    {canBuy && (
                        <QuickAction
                            icon="🚚" label="Purchases"
                            onPress={() => navigation.navigate('purchases')}
                            accent="#B45309"
                        />
                    )}
                    <QuickAction
                        icon="🔍" label="Barcode Scan"
                        onPress={() => navigation.navigate('ScanScreen')}
                        accent="#2980B9"
                    />
                    <QuickAction
                        icon="📦" label={t.actions.inventory}
                        onPress={() => navigation.navigate('items')}
                    />
                    <QuickAction
                        icon="👥" label={t.actions.customers}
                        onPress={() => navigation.navigate('customers')}
                    />
                    {canBuy && (
                        <QuickAction
                            icon="➕" label="Add Product"
                            onPress={() => setShowAddProduct(true)}
                            accent="#27ae60"
                        />
                    )}
                    <QuickAction
                        icon="🤖" label="Personal AI"
                        onPress={() => setShowAIAssistant(true)}
                        accent="#F39C12"
                        badge="ACTIVE"
                    />
                    <QuickAction
                        icon="📋" label="Bills History"
                        onPress={() => navigation.navigate('Bills')}
                    />
                    <QuickAction
                        icon="UPI" label="UPI QR"
                        onPress={() => setShowUpiQr(true)}
                    />

                </View>
            </View>

            {/* ── Recent Transactions ──────────────────────────────────────── */}
            <View style={styles.section}>
                <View style={styles.sectionTitleRow}>
                    <Text style={styles.sectionTitle}>🕐 Recent Bills</Text>
                    <TouchableOpacity onPress={() => navigation.navigate('Bills')}>
                        <Text style={styles.viewAllBtn}>View All →</Text>
                    </TouchableOpacity>
                </View>
                {recentTransactions.length === 0 ? (
                    <View style={styles.emptyBox}>
                        <Text style={styles.emptyIcon}>🧾</Text>
                        <Text style={styles.emptyText}>No bills today yet</Text>
                        <TouchableOpacity
                            style={styles.emptyAction}
                            onPress={() => navigation.navigate('billing')}
                        >
                            <Text style={styles.emptyActionText}>+ Create First Bill</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    recentTransactions.map(txn => (
                        <TransactionRow key={txn.id} txn={txn} />
                    ))
                )}
            </View>

            {/* ── Low Stock Alerts ─────────────────────────────────────────── */}
            {lowStockProducts.length > 0 && (
                <View style={styles.section}>
                    <View style={styles.sectionTitleRow}>
                        <Text style={styles.sectionTitle}>⚠️ Low Stock Alerts</Text>
                        <TouchableOpacity onPress={() => navigation.navigate('items')}>
                            <Text style={styles.viewAllBtn}>View All →</Text>
                        </TouchableOpacity>
                    </View>
                    {lowStockProducts.map(p => (
                        <LowStockRow key={p.id} product={p} />
                    ))}
                    {lowStockCount > lowStockProducts.length && (
                        <TouchableOpacity
                            style={styles.moreBtn}
                            onPress={() => navigation.navigate('items')}
                        >
                            <Text style={styles.moreBtnText}>
                                +{lowStockCount - lowStockProducts.length} more items low on stock →
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>
            )}

            {/* ── Footer spacer ────────────────────────────────────────────── */}
            <View style={{ height: 32 }} />

            {/* ── Modals ───────────────────────────────────────────────────── */}
            <AddProductModal
                visible={showAddProduct}
                onClose={() => setShowAddProduct(false)}
                onAdded={() => { setShowAddProduct(false); loadData(); }}
            />
            <AIAssistantModal
                visible={showAIAssistant}
                onClose={() => setShowAIAssistant(false)}
            />
            <UpiQrModal
                visible={showUpiQr}
                onClose={() => setShowUpiQr(false)}
                storeName={activeStore?.name || 'Demo Store'}
                defaultUpiId={activeStore?.upiId || ''}
            />
        </ScrollView>
    );
};

// ────────────────────────────────────────────────────────────────────────────────
// Styles
// ────────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.BACKGROUND },

    // Hero
    hero: {
        backgroundColor: COLORS.PRIMARY,
        paddingHorizontal: 20,
        paddingTop: 28,
        paddingBottom: 20,
        borderBottomLeftRadius: 28,
        borderBottomRightRadius: 28,
    },
    heroTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
    greeting: { fontSize: 24, fontWeight: '800', color: '#fff' },
    heroDate: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
    appCaption: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
    heroRefresh: { fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 6 },
    heroBadges: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    logoutBtn: { backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' },
    logoutText: { color: '#fff', fontSize: 11, fontWeight: '800' },
    roleBadge: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    roleBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },

    // Section header
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        marginTop: 14,
        marginBottom: 4,
    },
    sectionHeaderText: { fontSize: 16, fontWeight: '700', color: COLORS.TEXT_HEADING },
    refreshBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    refreshBtnText: { fontSize: 13, color: COLORS.PRIMARY, fontWeight: '700' },

    // Stats Grid
    statsRow: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8, paddingTop: 8, gap: 8 },
    statCard: {
        width: '47%',
        backgroundColor: '#fff',
        padding: 14,
        borderRadius: 16,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
        borderWidth: 1,
        borderColor: '#f0f0f0',
    },
    statCardSmall: { padding: 10 },
    statIcon: { fontSize: 22, marginBottom: 6 },
    statValue: { fontSize: 18, fontWeight: '800' },
    statLabel: { fontSize: 11, color: COLORS.TEXT_DIM, marginTop: 3, fontWeight: '500' },

    // Compliance
    complianceRow: {
        flexDirection: 'row',
        paddingHorizontal: 8,
        gap: 8,
        marginTop: 8,
    },
    complianceCard: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#F8F9FA',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E8EAED',
    },
    complianceIcon: { fontSize: 16 },
    complianceValue: { fontSize: 16, fontWeight: '800', color: COLORS.TEXT_HEADING },
    complianceLabel: { fontSize: 11, color: COLORS.TEXT_DIM, fontWeight: '500' },

    // Sections
    section: { paddingHorizontal: 16, marginTop: 20 },
    sectionTitle: { fontSize: 16, fontWeight: '800', color: COLORS.TEXT_HEADING, marginBottom: 12 },
    sectionTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    viewAllBtn: { fontSize: 13, color: COLORS.PRIMARY, fontWeight: '700' },

    // Quick Actions
    actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    quickAction: {
        width: '30%',
        backgroundColor: '#fff',
        paddingVertical: 14,
        paddingHorizontal: 8,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        borderWidth: 1,
        borderColor: '#f0f0f0',
        position: 'relative',
    },
    quickIconWrap: {
        width: 42,
        height: 42,
        borderRadius: 14,
        backgroundColor: '#f5f5f5',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 6,
    },
    quickIcon: { fontSize: 22 },
    quickLabel: { fontSize: 10, fontWeight: '700', color: COLORS.TEXT_DIM, textAlign: 'center' },
    quickBadge: {
        position: 'absolute',
        top: 6,
        right: 6,
        minWidth: 14,
        height: 14,
        borderRadius: 7,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 3,
    },
    quickBadgeText: { color: '#fff', fontSize: 8, fontWeight: '800' },

    // Transaction Rows
    txnRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#f0f0f0',
    },
    txnTimeCol: { width: 68 },
    txnTime: { fontSize: 12, fontWeight: '700', color: COLORS.TEXT_HEADING },
    txnBillNo: { fontSize: 9, color: COLORS.TEXT_DIM, marginTop: 2 },
    txnInfoCol: { flex: 1, paddingHorizontal: 8 },
    txnCustomer: { fontSize: 13, fontWeight: '600', color: COLORS.TEXT_HEADING },
    txnItems: { fontSize: 10, color: COLORS.TEXT_DIM, marginTop: 2 },
    txnPayCol: { alignItems: 'flex-end' },
    txnAmount: { fontSize: 14, fontWeight: '800' },
    txnPayType: { fontSize: 9, color: COLORS.TEXT_DIM, marginTop: 2 },

    // Low Stock
    lowStockRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 10,
        padding: 12,
        marginBottom: 6,
        borderWidth: 1,
        borderColor: '#f0f0f0',
    },
    lowStockInfo: { flex: 1, marginRight: 12 },
    lowStockName: { fontSize: 13, fontWeight: '600', color: COLORS.TEXT_HEADING },
    lowStockMeta: { fontSize: 10, color: COLORS.TEXT_DIM, marginTop: 2 },
    lowStockBarWrap: { width: 90, alignItems: 'flex-end' },
    lowStockBarTrack: {
        width: '100%',
        height: 6,
        borderRadius: 3,
        backgroundColor: '#f0f0f0',
        overflow: 'hidden',
    },
    lowStockBar: { height: 6, borderRadius: 3 },
    lowStockPct: { fontSize: 10, fontWeight: '700', marginTop: 2 },

    // Empty state
    emptyBox: { alignItems: 'center', paddingVertical: 24 },
    emptyIcon: { fontSize: 40, marginBottom: 8 },
    emptyText: { fontSize: 14, fontWeight: '600', color: COLORS.TEXT_DIM },
    emptyAction: {
        marginTop: 12,
        backgroundColor: COLORS.PRIMARY,
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 12,
    },
    emptyActionText: { color: '#fff', fontWeight: '700', fontSize: 13 },

    // More button
    moreBtn: {
        paddingVertical: 8,
        alignItems: 'center',
    },
    moreBtnText: { fontSize: 12, color: COLORS.PRIMARY, fontWeight: '600' },
});

export default HomeScreen;
