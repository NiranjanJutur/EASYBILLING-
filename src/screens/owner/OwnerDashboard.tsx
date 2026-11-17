import React, { useState, useCallback } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { COLORS, SPACING, RADIUS, FONT_SIZE, FONT_WEIGHT } from '../../config/theme';
import { getTransactions } from '../../services/firebase/firestoreService';
import { useUdhaar } from '../../hooks/useUdhaar';
import { formatCurrency } from '../../utils/billingUtils';
import { Transaction } from '../../models/Transaction';
import ComplianceScreen from '../compliance/ComplianceScreen';

type Frame = 'Day' | 'Week' | 'Month';
type OwnerView = 'dashboard' | 'compliance';

const KPICard = ({ label, value, color, icon }: { label: string; value: string; color: string; icon: string }) => (
    <View style={[styles.kpiCard, { borderLeftColor: color, borderLeftWidth: 4 }]}>
        <Text style={styles.kpiIcon}>{icon}</Text>
        <Text style={[styles.kpiValue, { color }]}>{value}</Text>
        <Text style={styles.kpiLabel}>{label}</Text>
    </View>
);

// Custom Bar Chart (no external dependency)
const BarChart = ({ data }: { data: { label: string; value: number; color?: string }[] }) => {
    const maxVal = Math.max(...data.map(d => d.value), 1);
    return (
        <View style={chart.container}>
            {data.map((d, i) => (
                <View key={i} style={chart.barGroup}>
                    <Text style={chart.barValue}>{d.value > 0 ? formatCurrency(d.value).replace('Γé╣', '') : ''}</Text>
                    <View style={chart.barTrack}>
                        <View style={[
                            chart.bar,
                            { height: Math.max(4, (d.value / maxVal) * 120), backgroundColor: d.color || COLORS.PRIMARY }
                        ]} />
                    </View>
                    <Text style={chart.barLabel} numberOfLines={1}>{d.label}</Text>
                </View>
            ))}
        </View>
    );
};

const OwnerDashboard = () => {
    const navigation = useNavigation<any>();
    const [activeView, setActiveView] = useState<OwnerView>('dashboard');
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [frame, setFrame] = useState<Frame>('Day');
    const { totalOutstanding, topDebtors, refresh: refreshUdhaar } = useUdhaar();

    useFocusEffect(
        useCallback(() => {
            getTransactions(200).then(setTransactions).catch(() => { });
            refreshUdhaar();
        }, [refreshUdhaar])
    );

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // Filter transactions by timeframe
    const filtered = transactions.filter(t => {
        if (!t.timestamp) return false;
        const d = new Date(t.timestamp);
        const dStr = d.toISOString().split('T')[0];

        if (frame === 'Day') return dStr === todayStr;
        if (frame === 'Week') {
            const weekAgo = new Date(now); 
            weekAgo.setDate(now.getDate() - 7);
            return d >= weekAgo;
        }
        if (frame === 'Month') {
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        }
        return true;
    });

    const todaySales = filtered.reduce((s, t) => s + t.grandTotal, 0);
    const todayGST = filtered.reduce((s, t) => s + t.totalGST, 0);
    const cashTotal = filtered.filter(t => t.paymentType === 'CASH').reduce((s, t) => s + t.grandTotal, 0);
    const upiTotal = filtered.filter(t => t.paymentType === 'UPI').reduce((s, t) => s + t.grandTotal, 0);
    const udhaarToday = filtered.filter(t => t.paymentType === 'UDHAAR').reduce((s, t) => s + t.grandTotal, 0);

    // Build bar chart data
    const getChartData = () => {
        if (frame === 'Day') {
            // Hourly buckets for today
            const buckets: Record<string, number> = {};
            for (let h = 8; h <= 21; h++) buckets[`${h}h`] = 0;
            filtered.forEach(t => {
                const h = new Date(t.timestamp).getHours();
                const key = `${h}h`;
                if (key in buckets) buckets[key] += t.grandTotal;
            });
            return Object.entries(buckets).map(([label, value]) => ({ label, value }));
        }
        if (frame === 'Week') {
            // Last 7 days
            const days: Record<string, number> = {};
            for (let i = 6; i >= 0; i--) {
                const d = new Date(now); d.setDate(now.getDate() - i);
                days[d.toLocaleDateString('en-IN', { weekday: 'short' })] = 0;
            }
            filtered.forEach(t => {
                const key = new Date(t.timestamp).toLocaleDateString('en-IN', { weekday: 'short' });
                if (key in days) days[key] += t.grandTotal;
            });
            return Object.entries(days).map(([label, value]) => ({ label, value }));
        }
        if (frame === 'Month') {
            // Days of month grouped in weeks
            const weeks: Record<string, number> = { 'Wk 1': 0, 'Wk 2': 0, 'Wk 3': 0, 'Wk 4': 0 };
            filtered.forEach(t => {
                const day = new Date(t.timestamp).getDate();
                const wk = day <= 7 ? 'Wk 1' : day <= 14 ? 'Wk 2' : day <= 21 ? 'Wk 3' : 'Wk 4';
                weeks[wk] += t.grandTotal;
            });
            return Object.entries(weeks).map(([label, value]) => ({ label, value }));
        }
        return [];
    };

    const chartData = getChartData();

    return (
        <View style={styles.root}>
            <View style={styles.viewSwitcher}>
                {([
                    { key: 'dashboard', label: '📊 Dashboard' },
                    { key: 'compliance', label: '📋 Compliance' },
                ] as { key: OwnerView; label: string }[]).map(view => (
                    <TouchableOpacity
                        key={view.key}
                        onPress={() => setActiveView(view.key)}
                        style={[styles.viewTab, activeView === view.key && styles.viewTabActive]}
                    >
                        <Text style={[styles.viewTabText, activeView === view.key && styles.viewTabTextActive]}>
                            {view.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {activeView === 'compliance' ? <ComplianceScreen embedded /> : <ScrollView style={styles.container}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.title}>Owner Dashboard</Text>
                    <Text style={styles.date}>{now.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
                </View>
                <View style={styles.liveIndicator}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveText}>LIVE</Text>
                </View>
            </View>

            {/* Frame Selector */}
            <View style={styles.frameRow}>
                {(['Day', 'Week', 'Month'] as Frame[]).map(f => (
                    <TouchableOpacity
                        key={f}
                        style={[styles.frameBtn, frame === f && styles.frameBtnActive]}
                        onPress={() => setFrame(f)}>
                        <Text style={[styles.frameBtnText, frame === f && styles.frameBtnTextActive]}>{f}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* KPI Cards */}
            <View style={styles.kpiGrid}>
                <KPICard label={`${frame}'s Sales`} value={formatCurrency(todaySales)} color={COLORS.PRIMARY} icon="💰" />
                <KPICard label="Bills" value={`${filtered.length}`} color={COLORS.SECONDARY} icon="🧾" />
                <KPICard label="GST Collected" value={formatCurrency(todayGST)} color={COLORS.SUCCESS} icon="📋" />
                <KPICard label="Total Udhaar" value={formatCurrency(totalOutstanding)} color={COLORS.ERROR} icon="📉" />
                <KPICard label="IRN / E-Inv" value={`${filtered.filter(t => t.irn).length}`} color="#8E44AD" icon="🧾" />
                <KPICard label="E-Way Permits" value={`${filtered.filter(t => t.ewayBillNo).length}`} color="#F39C12" icon="🚚" />
            </View>

            {/* Quick Actions */}
            <View style={styles.quickRow}>
                <TouchableOpacity style={styles.quickBtn} onPress={() => navigation.navigate('StaffPins')}>
                    <Text style={styles.quickIcon}>🔑</Text>
                    <Text style={styles.quickLabel}>Staff PINs</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickBtn} onPress={() => navigation.navigate('SuppliersList')}>
                    <Text style={styles.quickIcon}>🏭</Text>
                    <Text style={styles.quickLabel}>Suppliers</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickBtn} onPress={() => navigation.navigate('Bills')}>
                    <Text style={styles.quickIcon}>📄</Text>
                    <Text style={styles.quickLabel}>Bills History</Text>
                </TouchableOpacity>
            </View>

            {/* Bar Chart */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Sales Chart — {frame}</Text>
                {chartData.every(d => d.value === 0) ? (
                    <View style={styles.emptyChart}>
                        <Text style={styles.emptyChartText}>📊 No sales data for this period</Text>
                        <Text style={styles.emptyChartSub}>Bills will appear here once created</Text>
                    </View>
                ) : (
                    <BarChart data={chartData} />
                )}
            </View>

            {/* Payment Breakdown */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Payment Breakdown — {frame}</Text>
                {[
                    { label: 'Cash', amount: cashTotal, color: COLORS.SUCCESS, icon: '💵' },
                    { label: 'UPI', amount: upiTotal, color: COLORS.INFO, icon: '📱' },
                    { label: 'Udhaar', amount: udhaarToday, color: COLORS.ERROR, icon: '📉' },
                ].map(row => (
                    <View key={row.label} style={styles.paymentRow}>
                        <Text style={styles.paymentLabel}>{row.icon}  {row.label}</Text>
                        <Text style={[styles.paymentAmount, { color: row.color }]}>{formatCurrency(row.amount)}</Text>
                    </View>
                ))}
            </View>

            {/* Top Debtors */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Top Udhaar Customers</Text>
                {topDebtors.map((c, i) => (
                    <View key={c.id} style={styles.debtorRow}>
                        <Text style={styles.debtorRank}>#{i + 1}</Text>
                        <Text style={styles.debtorName}>{c.name}</Text>
                        <Text style={styles.debtorBalance}>{formatCurrency(c.totalOutstanding)}</Text>
                    </View>
                ))}
                {topDebtors.length === 0 && <Text style={styles.emptyText}>No outstanding udhaar 🎉</Text>}
            </View>
            </ScrollView>}
        </View>
    );
};

const chart = StyleSheet.create({
    container: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', height: 160, paddingHorizontal: 4, paddingTop: 8 },
    barGroup: { flex: 1, alignItems: 'center' },
    barValue: { fontSize: 8, color: COLORS.TEXT_DIM, marginBottom: 2, textAlign: 'center' },
    barTrack: { height: 120, justifyContent: 'flex-end', width: '70%' },
    bar: { borderRadius: 4, minHeight: 4 },
    barLabel: { fontSize: 9, color: COLORS.TEXT_DIM, marginTop: 4, textAlign: 'center', width: '90%' },
});

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: COLORS.BACKGROUND },
    container: { flex: 1, backgroundColor: COLORS.BACKGROUND },
    viewSwitcher: { flexDirection: 'row', backgroundColor: COLORS.WHITE, paddingHorizontal: SPACING.MD, paddingTop: SPACING.SM, gap: SPACING.SM, borderBottomWidth: 1, borderBottomColor: '#e6e9ef' },
    viewTab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: RADIUS.MD, marginBottom: SPACING.SM, backgroundColor: '#f1f3f5' },
    viewTabActive: { backgroundColor: COLORS.PRIMARY },
    viewTabText: { fontSize: 13, fontWeight: '700', color: COLORS.TEXT_DIM },
    viewTabTextActive: { color: COLORS.WHITE },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.LG, backgroundColor: COLORS.WHITE, borderBottomWidth: 1, borderBottomColor: COLORS.BORDER },
    title: { fontSize: FONT_SIZE.XL, fontWeight: FONT_WEIGHT.EXTRABOLD, color: COLORS.TEXT_HEADING },
    date: { fontSize: FONT_SIZE.SM, color: COLORS.TEXT_DIM },
    liveIndicator: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.SUCCESS },
    liveText: { fontSize: FONT_SIZE.XS, fontWeight: FONT_WEIGHT.BOLD, color: COLORS.SUCCESS },
    frameRow: { flexDirection: 'row', margin: SPACING.LG, marginBottom: 0, gap: SPACING.SM },
    frameBtn: { flex: 1, paddingVertical: SPACING.SM, borderRadius: RADIUS.MD, backgroundColor: COLORS.WHITE, borderWidth: 1, borderColor: COLORS.BORDER, alignItems: 'center' },
    frameBtnActive: { backgroundColor: COLORS.PRIMARY, borderColor: COLORS.PRIMARY },
    frameBtnText: { fontSize: FONT_SIZE.SM, fontWeight: FONT_WEIGHT.SEMIBOLD, color: COLORS.TEXT_DIM },
    frameBtnTextActive: { color: COLORS.WHITE, fontWeight: FONT_WEIGHT.EXTRABOLD },
    kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: SPACING.SM, gap: SPACING.SM },
    kpiCard: { width: '47%', backgroundColor: COLORS.WHITE, borderRadius: RADIUS.MD, padding: SPACING.MD, elevation: 1, borderWidth: 1, borderColor: COLORS.BORDER },
    kpiIcon: { fontSize: FONT_SIZE.XL, marginBottom: 4 },
    kpiValue: { fontSize: FONT_SIZE.XL, fontWeight: FONT_WEIGHT.EXTRABOLD },
    kpiLabel: { fontSize: FONT_SIZE.XS, color: COLORS.TEXT_DIM, marginTop: 2 },
    section: { margin: SPACING.LG, backgroundColor: COLORS.WHITE, borderRadius: RADIUS.LG, padding: SPACING.LG, elevation: 1, borderWidth: 1, borderColor: COLORS.BORDER },
    sectionTitle: { fontSize: FONT_SIZE.MD, fontWeight: FONT_WEIGHT.BOLD, color: COLORS.TEXT_HEADING, marginBottom: SPACING.SM },
    emptyChart: { alignItems: 'center', paddingVertical: SPACING.LG },
    emptyChartText: { fontSize: FONT_SIZE.MD, color: COLORS.TEXT_DIM, fontWeight: FONT_WEIGHT.SEMIBOLD },
    emptyChartSub: { fontSize: FONT_SIZE.SM, color: COLORS.TEXT_DIM, marginTop: 4 },
    paymentRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: SPACING.XS },
    paymentLabel: { fontSize: FONT_SIZE.MD, color: COLORS.TEXT_BODY },
    paymentAmount: { fontSize: FONT_SIZE.MD, fontWeight: FONT_WEIGHT.BOLD },
    debtorRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.SM, borderBottomWidth: 1, borderBottomColor: COLORS.BORDER },
    debtorRank: { width: 28, color: COLORS.TEXT_DIM, fontSize: FONT_SIZE.SM },
    debtorName: { flex: 1, color: COLORS.TEXT_BODY, fontSize: FONT_SIZE.SM },
    debtorBalance: { fontWeight: FONT_WEIGHT.BOLD, color: COLORS.ERROR, fontSize: FONT_SIZE.SM },
    emptyText: { color: COLORS.TEXT_DIM, textAlign: 'center', padding: SPACING.MD, fontSize: FONT_SIZE.SM },
    quickRow: { flexDirection: 'row', paddingHorizontal: SPACING.SM, paddingTop: SPACING.SM, gap: SPACING.SM },
    quickBtn: { flex: 1, backgroundColor: COLORS.WHITE, borderRadius: RADIUS.MD, padding: SPACING.MD, alignItems: 'center', elevation: 1, borderWidth: 1, borderColor: COLORS.BORDER },
    quickIcon: { fontSize: 24, marginBottom: 4 },
    quickLabel: { fontSize: FONT_SIZE.XS, fontWeight: FONT_WEIGHT.SEMIBOLD, color: COLORS.TEXT_BODY, textAlign: 'center' },
});

export default OwnerDashboard;
