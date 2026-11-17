/**
 * InsightsScreen — Owner-only ML dashboard
 * Displays all predictive intelligence from predictiveService.ts
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, ScrollView, StyleSheet, TouchableOpacity,
    ActivityIndicator, RefreshControl,
} from 'react-native';
import { COLORS, SPACING, RADIUS } from '../../config/theme';
import {
    generateBusinessInsights,
    BusinessInsights,
    StockForecast,
    ReorderRecommendation,
    ProductClassification,
    UdhaarRiskScore,
    SeasonalPattern,
    MONTH_NAMES,
} from '../../services/ml/predictiveService';
import { formatCurrency } from '../../utils/billingUtils';

type Tab = 'stock' | 'seasonal' | 'products' | 'udhaar' | 'revenue';

const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: 'stock',    label: 'Stock',    icon: '📦' },
    { key: 'seasonal', label: 'Seasons',  icon: '🌦️' },
    { key: 'products', label: 'Products', icon: '🏷️' },
    { key: 'udhaar',   label: 'Udhaar',   icon: '📓' },
    { key: 'revenue',  label: 'Revenue',  icon: '📈' },
];

const URGENCY_COLOR: Record<string, string> = {
    CRITICAL:   '#E74C3C',
    ORDER_SOON: '#E67E22',
    WATCH:      '#F1C40F',
    OK:         '#27AE60',
};

const RISK_COLOR: Record<string, string> = {
    CRITICAL: '#E74C3C',
    HIGH:     '#E67E22',
    MEDIUM:   '#F1C40F',
    LOW:      '#27AE60',
};

const VELOCITY_COLOR: Record<string, string> = {
    FAST:   '#27AE60',
    MEDIUM: COLORS.PRIMARY,
    SLOW:   '#E67E22',
    DEAD:   '#E74C3C',
};

const TREND_ICON: Record<string, string> = {
    RISING:  '📈',
    FALLING: '📉',
    STABLE:  '➡️',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const SectionHeader = ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <View style={s.sectionHeader}>
        <Text style={s.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={s.sectionSub}>{subtitle}</Text> : null}
    </View>
);

const DataQualityBanner = ({ quality }: { quality: BusinessInsights['dataQuality'] }) => {
    if (quality === 'GOOD') return null;
    const msg = quality === 'FAIR'
        ? '⚠️ Limited data — record more sales for better predictions'
        : '🆕 Very little data yet — predictions improve as you bill more';
    return <View style={s.qualityBanner}><Text style={s.qualityText}>{msg}</Text></View>;
};

// Stock urgency card
const StockCard = ({ f }: { f: StockForecast }) => (
    <View style={[s.card, { borderLeftColor: URGENCY_COLOR[f.urgency], borderLeftWidth: 4 }]}>
        <View style={s.cardRow}>
            <View style={s.cardLeft}>
                <Text style={s.cardTitle}>{f.productName}</Text>
                <Text style={s.cardSub}>
                    {f.currentStock} {f.unit} remaining
                    {'  ·  '}
                    {f.avgDailySales > 0 ? `${f.avgDailySales}/day` : 'No recent sales'}
                </Text>
                <Text style={[s.cardSub, { color: URGENCY_COLOR[f.urgency], fontWeight: '700' }]}>
                    {f.daysRemaining < 999
                        ? `Runs out in ${f.daysRemaining} days (${f.estimatedStockoutDate})`
                        : 'No depletion forecast (no recent sales)'}
                </Text>
            </View>
            <View style={[s.urgencyBadge, { backgroundColor: URGENCY_COLOR[f.urgency] + '22' }]}>
                <Text style={[s.urgencyText, { color: URGENCY_COLOR[f.urgency] }]}>
                    {f.urgency === 'CRITICAL'   ? '🔴' :
                     f.urgency === 'ORDER_SOON' ? '🟠' :
                     f.urgency === 'WATCH'      ? '🟡' : '🟢'}
                    {'  '}{f.urgency.replace('_', ' ')}
                </Text>
                <Text style={s.confidenceText}>({f.confidence} conf.)</Text>
            </View>
        </View>
    </View>
);

// Reorder card
const ReorderCard = ({ r }: { r: ReorderRecommendation }) => (
    <View style={[s.card, s.reorderCard, r.priority === 'URGENT' && s.reorderUrgent]}>
        <Text style={s.cardTitle}>{r.productName}</Text>
        <Text style={s.cardSub}>{r.reason}</Text>
        <View style={s.reorderRow}>
            <View style={s.reorderStat}>
                <Text style={s.reorderStatVal}>{r.suggestedOrderQty} {r.unit}</Text>
                <Text style={s.reorderStatLabel}>Order Qty</Text>
            </View>
            <View style={s.reorderStat}>
                <Text style={s.reorderStatVal}>{formatCurrency(r.estimatedCost)}</Text>
                <Text style={s.reorderStatLabel}>Est. Cost</Text>
            </View>
            <View style={s.reorderStat}>
                <Text style={s.reorderStatVal}>{r.suggestedOrderDate}</Text>
                <Text style={s.reorderStatLabel}>Order By</Text>
            </View>
        </View>
        {r.supplierPhone ? (
            <Text style={s.supplierText}>📞 Supplier: {r.supplierPhone}</Text>
        ) : null}
    </View>
);

// Seasonal bar chart (simple)
const SeasonalCard = ({ sp }: { sp: SeasonalPattern }) => {
    const max = Math.max(...sp.monthlyAvgSales, 1);
    return (
        <View style={s.card}>
            <View style={s.cardRow}>
                <Text style={s.cardTitle}>{sp.productName}</Text>
                <Text style={s.trendBadge}>
                    {TREND_ICON[sp.currentMonthTrend]} {sp.currentMonthTrend}
                </Text>
            </View>
            <Text style={s.cardSub}>
                Seasonality: {sp.seasonalScore < 30 ? '🟢 Low' : sp.seasonalScore < 60 ? '🟡 Medium' : '🔴 High'}
                {'  Peak: '}{sp.peakMonths.map(m => MONTH_NAMES[m]).join(', ') || 'N/A'}
            </Text>
            {/* Mini bar chart */}
            <View style={s.barChart}>
                {sp.monthlyAvgSales.map((val, i) => {
                    const height = max > 0 ? Math.round((val / max) * 40) : 2;
                    const isPeak = sp.peakMonths.includes(i);
                    return (
                        <View key={i} style={s.barWrapper}>
                            <View style={[
                                s.bar,
                                { height: Math.max(height, 2) },
                                isPeak && { backgroundColor: COLORS.PRIMARY },
                            ]} />
                            <Text style={s.barLabel}>{MONTH_NAMES[i].charAt(0)}</Text>
                        </View>
                    );
                })}
            </View>
        </View>
    );
};

// Product velocity card
const ProductCard = ({ p }: { p: ProductClassification }) => (
    <View style={s.card}>
        <View style={s.cardRow}>
            <View style={s.cardLeft}>
                <Text style={s.cardTitle}>{p.productName}</Text>
                <Text style={s.cardSub}>{p.category}</Text>
            </View>
            <View style={[s.velocityBadge, { backgroundColor: VELOCITY_COLOR[p.velocityClass] + '22' }]}>
                <Text style={[s.velocityText, { color: VELOCITY_COLOR[p.velocityClass] }]}>{p.badge}</Text>
            </View>
        </View>
        <View style={s.statsRow}>
            <View style={s.statBox}>
                <Text style={s.statVal}>{p.unitsSoldLast30Days}</Text>
                <Text style={s.statLabel}>Units/30d</Text>
            </View>
            <View style={s.statBox}>
                <Text style={s.statVal}>{p.revenueContribution}%</Text>
                <Text style={s.statLabel}>Revenue</Text>
            </View>
            <View style={s.statBox}>
                <Text style={s.statVal}>{p.profitMargin}%</Text>
                <Text style={s.statLabel}>Margin</Text>
            </View>
            <View style={s.statBox}>
                <Text style={s.statVal}>{p.daysInInventory}d</Text>
                <Text style={s.statLabel}>Turnover</Text>
            </View>
        </View>
    </View>
);

// Udhaar risk card
const UdhaarCard = ({ u }: { u: UdhaarRiskScore }) => (
    <View style={[s.card, { borderLeftColor: RISK_COLOR[u.riskLevel], borderLeftWidth: 4 }]}>
        <View style={s.cardRow}>
            <View style={s.cardLeft}>
                <Text style={s.cardTitle}>{u.customerName}</Text>
                <Text style={s.cardSub}>📱 {u.phone}</Text>
            </View>
            <View style={[s.riskBadge, { backgroundColor: RISK_COLOR[u.riskLevel] + '22' }]}>
                <Text style={[s.riskText, { color: RISK_COLOR[u.riskLevel] }]}>
                    {u.riskLevel} RISK
                </Text>
                <Text style={s.riskScore}>Score: {u.riskScore}/100</Text>
            </View>
        </View>
        <View style={s.statsRow}>
            <View style={s.statBox}>
                <Text style={[s.statVal, { color: COLORS.ERROR }]}>{formatCurrency(u.outstanding)}</Text>
                <Text style={s.statLabel}>Outstanding</Text>
            </View>
            <View style={s.statBox}>
                <Text style={s.statVal}>{u.utilizationPct}%</Text>
                <Text style={s.statLabel}>Credit Used</Text>
            </View>
            <View style={s.statBox}>
                <Text style={s.statVal}>~{u.avgDaysToPayback}d</Text>
                <Text style={s.statLabel}>Est. Payback</Text>
            </View>
        </View>
        {u.flags.length > 0 && (
            <View style={s.flagsBox}>
                {u.flags.map((f, i) => (
                    <Text key={i} style={s.flagText}>⚠️ {f}</Text>
                ))}
            </View>
        )}
    </View>
);

// ─── Main Screen ─────────────────────────────────────────────────────────────

const InsightsScreen = () => {
    const [insights, setInsights] = useState<BusinessInsights | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState<Tab>('stock');
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        setError(null);
        try {
            const data = await generateBusinessInsights();
            setInsights(data);
        } catch (e: any) {
            setError('Could not generate insights. Try again.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    if (loading) {
        return (
            <View style={s.loader}>
                <ActivityIndicator size="large" color={COLORS.PRIMARY} />
                <Text style={s.loaderText}>🧠 Analysing your business data...</Text>
            </View>
        );
    }

    if (error || !insights) {
        return (
            <View style={s.loader}>
                <Text style={s.errorText}>{error || 'No data'}</Text>
                <TouchableOpacity style={s.retryBtn} onPress={() => load()}>
                    <Text style={s.retryBtnText}>Retry</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const renderContent = () => {
        switch (activeTab) {
            case 'stock': return (
                <>
                    <SectionHeader
                        title="Stock Depletion Forecast"
                        subtitle="Predicted days until each product runs out"
                    />
                    {insights.stockForecasts
                        .filter(f => f.urgency !== 'OK')
                        .map(f => <StockCard key={f.productId} f={f} />)}

                    {insights.reorderRecommendations.length > 0 && (
                        <>
                            <SectionHeader
                                title="🛒 Reorder Recommendations"
                                subtitle="Suggested orders to avoid stockouts"
                            />
                            {insights.reorderRecommendations
                                .filter(r => r.priority === 'URGENT')
                                .map(r => <ReorderCard key={r.productId} r={r} />)}
                            {insights.reorderRecommendations
                                .filter(r => r.priority === 'SCHEDULED')
                                .map(r => <ReorderCard key={r.productId} r={r} />)}
                        </>
                    )}

                    <SectionHeader title="All Products" subtitle="Full stock status" />
                    {insights.stockForecasts
                        .filter(f => f.urgency === 'OK')
                        .map(f => <StockCard key={f.productId} f={f} />)}
                </>
            );

            case 'seasonal': return (
                <>
                    <SectionHeader
                        title="Seasonal Sales Patterns"
                        subtitle="Which months each product sells most"
                    />
                    {insights.seasonalPatterns.length === 0 && (
                        <Text style={s.emptyText}>Need more transaction history to detect seasons.</Text>
                    )}
                    {insights.seasonalPatterns.map(sp => <SeasonalCard key={sp.productId} sp={sp} />)}
                </>
            );

            case 'products': return (
                <>
                    <SectionHeader
                        title="Product Intelligence"
                        subtitle="ABC classification by velocity & margin"
                    />
                    {['FAST', 'MEDIUM', 'SLOW', 'DEAD'].map(cls => {
                        const items = insights.productClassifications.filter(p => p.velocityClass === cls);
                        if (items.length === 0) return null;
                        const labels: Record<string, string> = {
                            FAST: '🔥 Fast Movers', MEDIUM: '📦 Regular Sellers',
                            SLOW: '🐢 Slow Movers', DEAD: '💤 Dead Stock'
                        };
                        return (
                            <View key={cls}>
                                <Text style={s.clsHeader}>{labels[cls]} ({items.length})</Text>
                                {items.map(p => <ProductCard key={p.productId} p={p} />)}
                            </View>
                        );
                    })}
                </>
            );

            case 'udhaar': return (
                <>
                    <SectionHeader
                        title="Udhaar Risk Analysis"
                        subtitle="Customers with outstanding balances"
                    />
                    {insights.udhaarRiskScores.length === 0 && (
                        <Text style={s.emptyText}>No outstanding udhaar balances.</Text>
                    )}
                    {insights.udhaarRiskScores.map(u => <UdhaarCard key={u.customerId} u={u} />)}
                </>
            );

            case 'revenue': {
                const rf = insights.revenueForecast;
                return (
                    <>
                        <SectionHeader title="Revenue Forecast" subtitle="Based on last 60 days of sales" />

                        {/* Summary cards */}
                        <View style={s.revenueGrid}>
                            <View style={s.revCard}>
                                <Text style={s.revCardVal}>{formatCurrency(rf.last30DayRevenue)}</Text>
                                <Text style={s.revCardLabel}>Last 30 Days</Text>
                            </View>
                            <View style={s.revCard}>
                                <Text style={[s.revCardVal, { color: rf.growthRate >= 0 ? COLORS.SUCCESS : COLORS.ERROR }]}>
                                    {rf.growthRate >= 0 ? '+' : ''}{rf.growthRate}%
                                </Text>
                                <Text style={s.revCardLabel}>Growth Rate</Text>
                            </View>
                            <View style={s.revCard}>
                                <Text style={s.revCardVal}>{formatCurrency(rf.projectedNext30DayRevenue)}</Text>
                                <Text style={s.revCardLabel}>Next 30 Days (est.)</Text>
                            </View>
                            <View style={s.revCard}>
                                <Text style={s.revCardVal}>{formatCurrency(rf.dailyRevenueAvg)}</Text>
                                <Text style={s.revCardLabel}>Daily Average</Text>
                            </View>
                        </View>

                        <SectionHeader title="📅 Best Day" subtitle="Highest revenue day of the week" />
                        <View style={s.card}>
                            <Text style={s.bestDay}>{rf.bestDay} is your strongest sales day</Text>
                        </View>

                        <SectionHeader title="💳 Payment Mix" />
                        <View style={s.card}>
                            {Object.entries(rf.paymentMixPct).map(([key, pct]) => (
                                <View key={key} style={s.payRow}>
                                    <Text style={s.payLabel}>
                                        {key === 'cash' ? '💵' : key === 'upi' ? '📱' : key === 'card' ? '💳' : '📓'}
                                        {'  '}{key.toUpperCase()}
                                    </Text>
                                    <View style={s.payBarBg}>
                                        <View style={[s.payBarFill, { width: `${pct}%` as any }]} />
                                    </View>
                                    <Text style={s.payPct}>{pct}%</Text>
                                </View>
                            ))}
                        </View>

                        <SectionHeader title="🏆 Top Revenue Products" />
                        {rf.topRevenueProducts.map((p, i) => (
                            <View key={i} style={[s.card, s.topProdRow]}>
                                <Text style={s.topProdRank}>#{i + 1}</Text>
                                <Text style={[s.cardTitle, { flex: 1 }]}>{p.productName}</Text>
                                <Text style={s.topProdRev}>{formatCurrency(p.revenue)}</Text>
                            </View>
                        ))}
                    </>
                );
            }

            default: return null;
        }
    };

    return (
        <View style={s.container}>
            {/* Header */}
            <View style={s.header}>
                <Text style={s.headerTitle}>🧠 Business Insights</Text>
                <Text style={s.headerSub}>
                    Updated {new Date(insights.generatedAt).toLocaleTimeString('en-IN')}
                </Text>
            </View>

            <DataQualityBanner quality={insights.dataQuality} />

            {/* Tabs */}
            <View style={s.tabBar}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {TABS.map(tab => (
                        <TouchableOpacity
                            key={tab.key}
                            style={[s.tab, activeTab === tab.key && s.tabActive]}
                            onPress={() => setActiveTab(tab.key)}>
                            <Text style={s.tabIcon}>{tab.icon}</Text>
                            <Text style={[s.tabText, activeTab === tab.key && s.tabTextActive]}>
                                {tab.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* Content */}
            <ScrollView
                style={s.content}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => load(true)}
                        colors={[COLORS.PRIMARY]}
                    />
                }
            >
                {renderContent()}
                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
    container:      { flex: 1, backgroundColor: COLORS.BACKGROUND },
    header:         { backgroundColor: COLORS.WHITE, padding: SPACING.MD, borderBottomWidth: 1, borderBottomColor: COLORS.BORDER },
    headerTitle:    { fontSize: 20, fontWeight: '800', color: COLORS.TEXT_HEADING },
    headerSub:      { fontSize: 12, color: COLORS.TEXT_DIM, marginTop: 2 },
    loader:         { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.MD },
    loaderText:     { fontSize: 15, color: COLORS.TEXT_DIM, marginTop: SPACING.MD },
    errorText:      { fontSize: 15, color: COLORS.ERROR, textAlign: 'center' },
    retryBtn:       { backgroundColor: COLORS.PRIMARY, paddingHorizontal: SPACING.LG, paddingVertical: SPACING.SM, borderRadius: RADIUS.LG },
    retryBtnText:   { color: '#fff', fontWeight: '700' },
    qualityBanner:  { backgroundColor: '#FFF3CD', padding: SPACING.SM, margin: SPACING.SM, borderRadius: RADIUS.MD, borderWidth: 1, borderColor: '#FFC107' },
    qualityText:    { fontSize: 12, color: '#856404', textAlign: 'center' },
    tabBar:         { backgroundColor: COLORS.WHITE, borderBottomWidth: 1, borderBottomColor: COLORS.BORDER },
    tab:            { paddingHorizontal: SPACING.MD, paddingVertical: SPACING.SM, alignItems: 'center', gap: 2 },
    tabActive:      { borderBottomWidth: 3, borderBottomColor: COLORS.PRIMARY },
    tabIcon:        { fontSize: 18 },
    tabText:        { fontSize: 11, color: COLORS.TEXT_DIM, fontWeight: '600' },
    tabTextActive:  { color: COLORS.PRIMARY, fontWeight: '800' },
    content:        { flex: 1, padding: SPACING.SM },
    sectionHeader:  { paddingHorizontal: SPACING.SM, paddingTop: SPACING.MD, paddingBottom: SPACING.XS },
    sectionTitle:   { fontSize: 15, fontWeight: '800', color: COLORS.TEXT_HEADING },
    sectionSub:     { fontSize: 11, color: COLORS.TEXT_DIM, marginTop: 2 },
    card:           { backgroundColor: COLORS.WHITE, borderRadius: RADIUS.LG, padding: SPACING.MD, marginBottom: SPACING.SM, elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4 },
    cardRow:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    cardLeft:       { flex: 1, marginRight: SPACING.SM },
    cardTitle:      { fontSize: 14, fontWeight: '700', color: COLORS.TEXT_HEADING, marginBottom: 2 },
    cardSub:        { fontSize: 12, color: COLORS.TEXT_DIM, marginTop: 2 },
    urgencyBadge:   { paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.MD, alignItems: 'center' },
    urgencyText:    { fontSize: 11, fontWeight: '800' },
    confidenceText: { fontSize: 9, color: COLORS.TEXT_DIM, marginTop: 2 },
    emptyText:      { textAlign: 'center', color: COLORS.TEXT_DIM, padding: SPACING.XL, fontSize: 14 },
    // Reorder
    reorderCard:    { borderWidth: 1, borderColor: COLORS.BORDER },
    reorderUrgent:  { borderColor: '#E74C3C', backgroundColor: '#FEF9F9' },
    reorderRow:     { flexDirection: 'row', justifyContent: 'space-between', marginTop: SPACING.SM },
    reorderStat:    { alignItems: 'center' },
    reorderStatVal: { fontSize: 14, fontWeight: '800', color: COLORS.TEXT_HEADING },
    reorderStatLabel: { fontSize: 10, color: COLORS.TEXT_DIM, marginTop: 2 },
    supplierText:   { fontSize: 11, color: COLORS.TEXT_DIM, marginTop: SPACING.SM },
    // Seasonal bar chart
    barChart:       { flexDirection: 'row', alignItems: 'flex-end', height: 52, marginTop: SPACING.SM, gap: 2 },
    barWrapper:     { flex: 1, alignItems: 'center' },
    bar:            { width: '100%', backgroundColor: COLORS.BORDER, borderRadius: 2, minHeight: 2 },
    barLabel:       { fontSize: 8, color: COLORS.TEXT_DIM, marginTop: 2 },
    trendBadge:     { fontSize: 12, fontWeight: '700', color: COLORS.TEXT_HEADING },
    // Products
    statsRow:       { flexDirection: 'row', marginTop: SPACING.SM },
    statBox:        { flex: 1, alignItems: 'center' },
    statVal:        { fontSize: 14, fontWeight: '800', color: COLORS.TEXT_HEADING },
    statLabel:      { fontSize: 10, color: COLORS.TEXT_DIM, marginTop: 2 },
    velocityBadge:  { paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.MD },
    velocityText:   { fontSize: 11, fontWeight: '800' },
    clsHeader:      { fontSize: 13, fontWeight: '700', color: COLORS.TEXT_DIM, paddingHorizontal: SPACING.SM, paddingVertical: SPACING.SM, textTransform: 'uppercase', letterSpacing: 0.5 },
    // Udhaar
    riskBadge:      { paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.MD, alignItems: 'center' },
    riskText:       { fontSize: 11, fontWeight: '800' },
    riskScore:      { fontSize: 9, color: COLORS.TEXT_DIM, marginTop: 2 },
    flagsBox:       { marginTop: SPACING.SM, borderTopWidth: 1, borderTopColor: COLORS.BORDER, paddingTop: SPACING.SM },
    flagText:       { fontSize: 11, color: '#E67E22', marginTop: 2 },
    // Revenue
    revenueGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.SM, marginBottom: SPACING.SM },
    revCard:        { width: '47%', backgroundColor: COLORS.WHITE, borderRadius: RADIUS.LG, padding: SPACING.MD, alignItems: 'center', elevation: 1 },
    revCardVal:     { fontSize: 18, fontWeight: '900', color: COLORS.PRIMARY },
    revCardLabel:   { fontSize: 11, color: COLORS.TEXT_DIM, marginTop: 4, textAlign: 'center' },
    bestDay:        { fontSize: 15, fontWeight: '700', color: COLORS.TEXT_HEADING, textAlign: 'center' },
    payRow:         { flexDirection: 'row', alignItems: 'center', gap: SPACING.SM, marginBottom: SPACING.SM },
    payLabel:       { fontSize: 12, fontWeight: '700', color: COLORS.TEXT_DIM, width: 70 },
    payBarBg:       { flex: 1, height: 8, backgroundColor: COLORS.BORDER, borderRadius: 4, overflow: 'hidden' },
    payBarFill:     { height: 8, backgroundColor: COLORS.PRIMARY, borderRadius: 4 },
    payPct:         { fontSize: 12, fontWeight: '700', color: COLORS.TEXT_HEADING, width: 36, textAlign: 'right' },
    topProdRow:     { flexDirection: 'row', alignItems: 'center', gap: SPACING.SM },
    topProdRank:    { fontSize: 16, fontWeight: '900', color: COLORS.TEXT_DIM, width: 28 },
    topProdRev:     { fontSize: 14, fontWeight: '800', color: COLORS.PRIMARY },
});

export default InsightsScreen;
