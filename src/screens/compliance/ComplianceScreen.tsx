import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    FlatList, TextInput, Modal, Alert, ActivityIndicator,
} from 'react-native';
import { COLORS, SPACING, RADIUS } from '../../config/theme';
import { getTransactions } from '../../services/firebase/firestoreService';
import { eWayBillService } from '../../services/gst/eWayBillService';
import { eInvoiceService } from '../../services/gst/eInvoiceService';
import { formatCurrency } from '../../utils/billingUtils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        + '  ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function truncate(str: string, n: number) {
    if (!str) return '—';
    return str.length > n ? str.slice(0, n) + '…' : str;
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type Tab = 'einvoice' | 'eway' | 'guide';

// ─── Cancel IRN Modal ─────────────────────────────────────────────────────────

const CancelIRNModal = ({
    visible, irn, onClose, onDone,
}: { visible: boolean; irn: string; onClose: () => void; onDone: () => void }) => {
    const [reason, setReason] = useState<1 | 2 | 3 | 4>(4);
    const [remark, setRemark] = useState('');
    const [loading, setLoading] = useState(false);

    const REASONS: { code: 1 | 2 | 3 | 4; label: string }[] = [
        { code: 1, label: 'Duplicate' },
        { code: 2, label: 'Data Entry Mistake' },
        { code: 3, label: 'Order Cancelled' },
        { code: 4, label: 'Other' },
    ];

    const handleCancel = async () => {
        setLoading(true);
        try {
            await eInvoiceService.cancelIRN(irn, reason, remark || undefined);
            Alert.alert('✅ IRN Cancelled', 'The E-Invoice has been cancelled on the GSP.');
            onDone();
            onClose();
        } catch (e: any) {
            Alert.alert('Cancel Failed', e?.message || 'Could not cancel the IRN. It can only be cancelled within 24 hours.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View style={md.overlay}>
                <View style={md.sheet}>
                    <View style={md.header}>
                        <Text style={md.title}>🗑️ Cancel E-Invoice (IRN)</Text>
                        <TouchableOpacity onPress={onClose}><Text style={md.close}>✕</Text></TouchableOpacity>
                    </View>
                    <View style={md.body}>
                        <View style={md.irnBox}>
                            <Text style={md.irnLabel}>IRN</Text>
                            <Text style={md.irnVal} selectable>{truncate(irn, 32)}</Text>
                        </View>
                        <Text style={md.sectionLabel}>Cancellation Reason</Text>
                        <View style={md.reasonGrid}>
                            {REASONS.map(r => (
                                <TouchableOpacity
                                    key={r.code}
                                    style={[md.reasonBtn, reason === r.code && md.reasonBtnActive]}
                                    onPress={() => setReason(r.code)}>
                                    <Text style={[md.reasonText, reason === r.code && md.reasonTextActive]}>
                                        {r.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <Text style={md.sectionLabel}>Remark (optional)</Text>
                        <TextInput
                            style={md.remarkInput}
                            placeholder="Enter remark..."
                            placeholderTextColor={COLORS.TEXT_DIM}
                            value={remark}
                            onChangeText={setRemark}
                            maxLength={100}
                        />
                        <View style={md.warningBox}>
                            <Text style={md.warningText}>⚠️ IRN can only be cancelled within 24 hours of generation.</Text>
                        </View>
                    </View>
                    <View style={md.footer}>
                        <TouchableOpacity style={md.cancelBtn} onPress={onClose}>
                            <Text style={md.cancelBtnText}>Back</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={md.confirmBtn} onPress={handleCancel} disabled={loading}>
                            {loading ? <ActivityIndicator color="#fff" /> : <Text style={md.confirmBtnText}>Confirm Cancel</Text>}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

// ─── Cancel EWB Modal ─────────────────────────────────────────────────────────

const CancelEWBModal = ({
    visible, ewbNo, onClose, onDone,
}: { visible: boolean; ewbNo: string; onClose: () => void; onDone: () => void }) => {
    const [reason, setReason] = useState<'1' | '2' | '3' | '4'>('4');
    const [remark, setRemark] = useState('');
    const [loading, setLoading] = useState(false);

    const REASONS = [
        { code: '1', label: 'Duplicate' },
        { code: '2', label: 'Order Cancelled' },
        { code: '3', label: 'Data Entry Mistake' },
        { code: '4', label: 'Others' },
    ] as const;

    const handleCancel = async () => {
        setLoading(true);
        try {
            await eWayBillService.cancelEWB(ewbNo, reason, remark || undefined);
            Alert.alert('✅ EWB Cancelled', `E-Way Bill ${ewbNo} has been cancelled.`);
            onDone();
            onClose();
        } catch (e: any) {
            Alert.alert('Cancel Failed', e?.message || 'Could not cancel the EWB. It can only be cancelled within 24 hours.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View style={md.overlay}>
                <View style={md.sheet}>
                    <View style={md.header}>
                        <Text style={md.title}>🗑️ Cancel E-Way Bill</Text>
                        <TouchableOpacity onPress={onClose}><Text style={md.close}>✕</Text></TouchableOpacity>
                    </View>
                    <View style={md.body}>
                        <View style={md.irnBox}>
                            <Text style={md.irnLabel}>EWB No</Text>
                            <Text style={md.irnVal}>{ewbNo}</Text>
                        </View>
                        <Text style={md.sectionLabel}>Cancellation Reason</Text>
                        <View style={md.reasonGrid}>
                            {REASONS.map(r => (
                                <TouchableOpacity
                                    key={r.code}
                                    style={[md.reasonBtn, reason === r.code && md.reasonBtnActive]}
                                    onPress={() => setReason(r.code)}>
                                    <Text style={[md.reasonText, reason === r.code && md.reasonTextActive]}>
                                        {r.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <Text style={md.sectionLabel}>Remark (optional)</Text>
                        <TextInput
                            style={md.remarkInput}
                            placeholder="Enter remark..."
                            placeholderTextColor={COLORS.TEXT_DIM}
                            value={remark}
                            onChangeText={setRemark}
                            maxLength={100}
                        />
                        <View style={md.warningBox}>
                            <Text style={md.warningText}>⚠️ EWB can only be cancelled within 24 hours of generation.</Text>
                        </View>
                    </View>
                    <View style={md.footer}>
                        <TouchableOpacity style={md.cancelBtn} onPress={onClose}>
                            <Text style={md.cancelBtnText}>Back</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={md.confirmBtn} onPress={handleCancel} disabled={loading}>
                            {loading ? <ActivityIndicator color="#fff" /> : <Text style={md.confirmBtnText}>Confirm Cancel</Text>}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

// ─── E-Invoice Tab ────────────────────────────────────────────────────────────

const EInvoiceTab = () => {
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [cancelTarget, setCancelTarget] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const all = await getTransactions();
            // Only show transactions that have an IRN
            setTransactions(all.filter((t: any) => t.irn));
        } catch {
            setTransactions([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const filtered = transactions.filter(t =>
        !search ||
        t.billNo?.toLowerCase().includes(search.toLowerCase()) ||
        t.irn?.toLowerCase().includes(search.toLowerCase()) ||
        t.customerName?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <View style={{ flex: 1 }}>
            <TextInput
                style={s.searchBar}
                placeholder="🔍  Search by Bill No, IRN, or Customer..."
                placeholderTextColor={COLORS.TEXT_DIM}
                value={search}
                onChangeText={setSearch}
            />
            {loading ? (
                <View style={s.center}><ActivityIndicator color={COLORS.PRIMARY} size="large" /></View>
            ) : filtered.length === 0 ? (
                <View style={s.center}>
                    <Text style={s.emptyIcon}>📄</Text>
                    <Text style={s.emptyTitle}>No E-Invoices yet</Text>
                    <Text style={s.emptySubtitle}>IRNs will appear here after checkout with E-Invoice enabled.</Text>
                </View>
            ) : (
                <FlatList
                    data={filtered}
                    keyExtractor={item => item.id}
                    contentContainerStyle={{ padding: SPACING.MD }}
                    renderItem={({ item }) => (
                        <View style={s.card}>
                            <View style={s.cardHeader}>
                                <View style={s.cardBadge}>
                                    <Text style={s.cardBadgeText}>E-Invoice</Text>
                                </View>
                                <Text style={s.cardBillNo}>{item.billNo}</Text>
                                <Text style={s.cardAmount}>{formatCurrency(item.grandTotal)}</Text>
                            </View>
                            <Text style={s.cardCustomer}>👤 {item.customerName || 'Walk-in'}</Text>
                            <Text style={s.cardDate}>🕒 {formatDate(item.timestamp)}</Text>
                            <View style={s.irnRow}>
                                <Text style={s.irnLabel}>IRN</Text>
                                <Text style={s.irnVal} selectable numberOfLines={1}>{truncate(item.irn, 40)}</Text>
                            </View>
                            {item.ewayBillNo && (
                                <View style={[s.irnRow, { marginTop: 4 }]}>
                                    <Text style={s.irnLabel}>EWB</Text>
                                    <Text style={[s.irnVal, { color: '#8e44ad' }]}>{item.ewayBillNo}</Text>
                                </View>
                            )}
                            <TouchableOpacity
                                style={s.cancelBtn}
                                onPress={() => setCancelTarget(item.irn)}>
                                <Text style={s.cancelBtnText}>🗑️ Cancel IRN</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                />
            )}
            {cancelTarget && (
                <CancelIRNModal
                    visible
                    irn={cancelTarget}
                    onClose={() => setCancelTarget(null)}
                    onDone={load}
                />
            )}
        </View>
    );
};

// ─── E-Way Bill Tab ───────────────────────────────────────────────────────────

const EWayBillTab = () => {
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [cancelTarget, setCancelTarget] = useState<string | null>(null);
    const [updateTarget, setUpdateTarget] = useState<{ ewbNo: string; txnId: string } | null>(null);
    const [newVehicle, setNewVehicle] = useState('');
    const [updateLoading, setUpdateLoading] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const all = await getTransactions();
            setTransactions(all.filter((t: any) => t.ewayBillNo));
        } catch {
            setTransactions([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const filtered = transactions.filter(t =>
        !search ||
        t.billNo?.toLowerCase().includes(search.toLowerCase()) ||
        t.ewayBillNo?.includes(search) ||
        t.customerName?.toLowerCase().includes(search.toLowerCase())
    );

    const handleUpdateVehicle = async () => {
        if (!updateTarget) return;
        const vehicleRegex = /^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}$/;
        if (!vehicleRegex.test(newVehicle.replace(/[-\s]/g, ''))) {
            Alert.alert('Invalid Format', 'Use format: KA01AB1234');
            return;
        }
        setUpdateLoading(true);
        try {
            await eWayBillService.updateVehicle(
                updateTarget.ewbNo,
                newVehicle.toUpperCase().replace(/[-\s]/g, ''),
                'N/A', 0, '1', '4',
            );
            Alert.alert('✅ Vehicle Updated', `EWB ${updateTarget.ewbNo} now has vehicle ${newVehicle}.`);
            setUpdateTarget(null);
            setNewVehicle('');
            load();
        } catch (e: any) {
            Alert.alert('Update Failed', e?.message || 'Could not update vehicle number.');
        } finally {
            setUpdateLoading(false);
        }
    };

    const ewbValidity = (validUpto?: string) => {
        if (!validUpto) return null;
        const expiry = new Date(validUpto.replace(' ', 'T'));
        const now = Date.now();
        const remaining = expiry.getTime() - now;
        if (remaining <= 0) return { label: 'Expired', color: COLORS.ERROR };
        const hours = Math.floor(remaining / (1000 * 60 * 60));
        if (hours < 6) return { label: `${hours}h left ⚠️`, color: '#e67e22' };
        return { label: `${hours}h left`, color: COLORS.SUCCESS };
    };

    return (
        <View style={{ flex: 1 }}>
            <TextInput
                style={s.searchBar}
                placeholder="🔍  Search by Bill No, EWB No, or Customer..."
                placeholderTextColor={COLORS.TEXT_DIM}
                value={search}
                onChangeText={setSearch}
            />
            {loading ? (
                <View style={s.center}><ActivityIndicator color={COLORS.PRIMARY} size="large" /></View>
            ) : filtered.length === 0 ? (
                <View style={s.center}>
                    <Text style={s.emptyIcon}>🚚</Text>
                    <Text style={s.emptyTitle}>No E-Way Bills yet</Text>
                    <Text style={s.emptySubtitle}>EWBs will appear here after checkout with E-Way Bill enabled.</Text>
                </View>
            ) : (
                <FlatList
                    data={filtered}
                    keyExtractor={item => item.id}
                    contentContainerStyle={{ padding: SPACING.MD }}
                    renderItem={({ item }) => {
                        const validity = ewbValidity(item.ewayBillValidUpto);
                        return (
                            <View style={s.card}>
                                <View style={s.cardHeader}>
                                    <View style={[s.cardBadge, { backgroundColor: '#8e44ad' + '22' }]}>
                                        <Text style={[s.cardBadgeText, { color: '#8e44ad' }]}>E-Way Bill</Text>
                                    </View>
                                    <Text style={s.cardBillNo}>{item.billNo}</Text>
                                    <Text style={s.cardAmount}>{formatCurrency(item.grandTotal)}</Text>
                                </View>
                                <Text style={s.cardCustomer}>👤 {item.customerName || 'Walk-in'}</Text>
                                <Text style={s.cardDate}>🕒 {formatDate(item.timestamp)}</Text>
                                <View style={s.irnRow}>
                                    <Text style={s.irnLabel}>EWB No</Text>
                                    <Text style={[s.irnVal, { color: '#8e44ad' }]}>{item.ewayBillNo}</Text>
                                </View>
                                {validity && (
                                    <View style={[s.irnRow, { marginTop: 4 }]}>
                                        <Text style={s.irnLabel}>Validity</Text>
                                        <Text style={[s.irnVal, { color: validity.color }]}>{validity.label}</Text>
                                    </View>
                                )}
                                <View style={s.actionRow}>
                                    <TouchableOpacity
                                        style={s.updateBtn}
                                        onPress={() => { setUpdateTarget({ ewbNo: item.ewayBillNo, txnId: item.id }); setNewVehicle(''); }}>
                                        <Text style={s.updateBtnText}>🚗 Update Vehicle</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={s.cancelBtn}
                                        onPress={() => setCancelTarget(item.ewayBillNo)}>
                                        <Text style={s.cancelBtnText}>🗑️ Cancel EWB</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        );
                    }}
                />
            )}

            {/* Update Vehicle Modal */}
            {updateTarget && (
                <Modal visible animationType="slide" transparent>
                    <View style={md.overlay}>
                        <View style={md.sheet}>
                            <View style={md.header}>
                                <Text style={md.title}>🚗 Update Vehicle Number</Text>
                                <TouchableOpacity onPress={() => setUpdateTarget(null)}><Text style={md.close}>✕</Text></TouchableOpacity>
                            </View>
                            <View style={md.body}>
                                <View style={md.irnBox}>
                                    <Text style={md.irnLabel}>EWB No</Text>
                                    <Text style={md.irnVal}>{updateTarget.ewbNo}</Text>
                                </View>
                                <Text style={md.sectionLabel}>New Vehicle Number</Text>
                                <TextInput
                                    style={md.remarkInput}
                                    placeholder="e.g. KA01AB1234"
                                    placeholderTextColor={COLORS.TEXT_DIM}
                                    value={newVehicle}
                                    onChangeText={t => setNewVehicle(t.toUpperCase())}
                                    autoCapitalize="characters"
                                    maxLength={12}
                                />
                            </View>
                            <View style={md.footer}>
                                <TouchableOpacity style={md.cancelBtn} onPress={() => setUpdateTarget(null)}>
                                    <Text style={md.cancelBtnText}>Back</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={md.confirmBtn} onPress={handleUpdateVehicle} disabled={updateLoading}>
                                    {updateLoading ? <ActivityIndicator color="#fff" /> : <Text style={md.confirmBtnText}>Update</Text>}
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            )}

            {cancelTarget && (
                <CancelEWBModal
                    visible
                    ewbNo={cancelTarget}
                    onClose={() => setCancelTarget(null)}
                    onDone={load}
                />
            )}
        </View>
    );
};

// ─── Guide / Info Tab ─────────────────────────────────────────────────────────

const INFO_SECTIONS = [
    {
        icon: '📄',
        title: 'E-Invoice (IRN)',
        color: '#2980b9',
        bg: '#ebf5fb',
        items: [
            { label: 'What is it?', value: 'An Invoice Reference Number (IRN) generated by the NIC/GSP for B2B invoices. It is a 64-character unique hash that authenticates the invoice.' },
            { label: 'When mandatory?', value: 'Mandatory for businesses with annual turnover above ₹5 Crore doing B2B transactions.' },
            { label: 'Valid for B2C?', value: 'Not required for B2C (walk-in) customers. Only for businesses with a GSTIN.' },
            { label: 'Cancel window', value: 'An IRN can be cancelled only within 24 hours of generation. After that, it is permanent.' },
            { label: 'GSP Used', value: 'Masters India (api.mastergst.com) — configure credentials in your .env file.' },
        ],
    },
    {
        icon: '🚚',
        title: 'E-Way Bill (EWB)',
        color: '#8e44ad',
        bg: '#f5eef8',
        items: [
            { label: 'What is it?', value: 'A 12-digit Electronic Way Bill number required for the physical movement of goods above ₹50,000 in value.' },
            { label: 'When mandatory?', value: 'Required for both B2B and B2C if goods value exceeds ₹50,000 and goods are being physically transported.' },
            { label: 'Validity', value: 'Valid for 1 day per 100 km (normal cargo). ODC cargo: 1 day per 20 km. Minimum validity: 1 day.' },
            { label: 'Vehicle update', value: 'If the vehicle changes en route, you must update the vehicle number on the EWB using the "Update Vehicle" button.' },
            { label: 'Cancel window', value: 'An EWB can be cancelled only within 24 hours of generation, provided goods have not been verified by officials.' },
        ],
    },
    {
        icon: '⚙️',
        title: 'Setup & Configuration',
        color: '#27ae60',
        bg: '#eafaf1',
        items: [
            { label: 'GSP_BASE_URL', value: 'https://api.mastergst.com/einvoice/type/EINV/version/V1_03 (sandbox) or the production URL from Masters India.' },
            { label: 'SELLER_GSTIN', value: 'Your shop\'s 15-character GSTIN (e.g. 29XXXXXXXXXXXXX).' },
            { label: 'GSP_CLIENT_ID / SECRET', value: 'Obtain from Masters India developer dashboard after signing up.' },
            { label: 'Sandbox vs Production', value: 'Change GSP_BASE_URL in your .env to switch. No code changes needed.' },
            { label: 'HSN Codes', value: 'Currently defaulted to "0000". Add an hsnCode field to your products for full NIC compliance.' },
        ],
    },
    {
        icon: '📋',
        title: 'Applicability Table',
        color: '#e67e22',
        bg: '#fef9e7',
        isTable: true,
        rows: [
            ['Scenario', 'E-Invoice', 'E-Way Bill'],
            ['B2B, turnover > ₹5 Cr', '✅ Mandatory', 'If value > ₹50K'],
            ['B2C (walk-in)', '❌ Not required', 'If value > ₹50K'],
            ['Below ₹50K movement', '❌ Not required', '❌ Not required'],
            ['Export / SEZ', 'Special category', 'Mandatory'],
        ],
    },
];

const GuideTab = () => (
    <ScrollView contentContainerStyle={{ padding: SPACING.MD }}>
        {INFO_SECTIONS.map((sec, i) => (
            <View key={i} style={[g.section, { backgroundColor: sec.bg, borderLeftColor: sec.color }]}>
                <View style={g.sectionHeader}>
                    <Text style={g.sectionIcon}>{sec.icon}</Text>
                    <Text style={[g.sectionTitle, { color: sec.color }]}>{sec.title}</Text>
                </View>
                {sec.isTable ? (
                    <View style={g.table}>
                        {(sec as any).rows.map((row: string[], ri: number) => (
                            <View key={ri} style={[g.tableRow, ri === 0 && g.tableHeader]}>
                                {row.map((cell, ci) => (
                                    <Text key={ci} style={[g.tableCell, ri === 0 && g.tableHeaderCell, ci === 0 && { flex: 1.5 }]}>
                                        {cell}
                                    </Text>
                                ))}
                            </View>
                        ))}
                    </View>
                ) : (
                    (sec as any).items.map((item: any, j: number) => (
                        <View key={j} style={g.infoRow}>
                            <Text style={[g.infoLabel, { color: sec.color }]}>{item.label}</Text>
                            <Text style={g.infoValue}>{item.value}</Text>
                        </View>
                    ))
                )}
            </View>
        ))}
        <View style={g.footer}>
            <Text style={g.footerText}>
                📌 For more details, visit{' '}
                <Text style={g.footerLink}>einvoice1.gst.gov.in</Text>
                {' '}or{' '}
                <Text style={g.footerLink}>mastergst.com/einvoice-api</Text>
            </Text>
        </View>
    </ScrollView>
);

// ─── Main Screen ──────────────────────────────────────────────────────────────

const ComplianceScreen = ({ embedded = false }: { embedded?: boolean }) => {
    const [activeTab, setActiveTab] = useState<Tab>('einvoice');

    const TABS: { key: Tab; label: string; icon: string }[] = [
        { key: 'einvoice', label: 'E-Invoice', icon: '📄' },
        { key: 'eway', label: 'E-Way Bill', icon: '🚚' },
        { key: 'guide', label: 'Guide', icon: '📖' },
    ];

    return (
        <View style={s.container}>
            {!embedded && (
                <View style={s.header}>
                    <Text style={s.headerTitle}>GST Compliance</Text>
                    <Text style={s.headerSub}>E-Invoice (IRN) · E-Way Bill (EWB)</Text>
                </View>
            )}

            {/* Tab Bar */}
            <View style={s.tabBar}>
                {TABS.map(tab => (
                    <TouchableOpacity
                        key={tab.key}
                        style={[s.tabBtn, activeTab === tab.key && s.tabBtnActive]}
                        onPress={() => setActiveTab(tab.key)}>
                        <Text style={s.tabBtnIcon}>{tab.icon}</Text>
                        <Text style={[s.tabBtnLabel, activeTab === tab.key && s.tabBtnLabelActive]}>
                            {tab.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Content */}
            <View style={{ flex: 1 }}>
                {activeTab === 'einvoice' && <EInvoiceTab />}
                {activeTab === 'eway' && <EWayBillTab />}
                {activeTab === 'guide' && <GuideTab />}
            </View>
        </View>
    );
};

export default ComplianceScreen;

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.BACKGROUND },
    header: { padding: SPACING.MD, paddingTop: SPACING.LG, backgroundColor: COLORS.PRIMARY },
    headerTitle: { fontSize: 22, fontWeight: '900', color: '#fff' },
    headerSub: { fontSize: 12, color: '#fff', opacity: 0.8, marginTop: 2 },
    tabBar: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: COLORS.BORDER },
    tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, gap: 2, borderBottomWidth: 3, borderBottomColor: 'transparent' },
    tabBtnActive: { borderBottomColor: COLORS.PRIMARY },
    tabBtnIcon: { fontSize: 18 },
    tabBtnLabel: { fontSize: 11, fontWeight: '700', color: COLORS.TEXT_DIM },
    tabBtnLabelActive: { color: COLORS.PRIMARY },
    searchBar: {
        margin: SPACING.MD, marginBottom: SPACING.SM,
        backgroundColor: '#fff', borderRadius: RADIUS.MD,
        paddingHorizontal: SPACING.MD, paddingVertical: 10,
        borderWidth: 1, borderColor: COLORS.BORDER,
        color: COLORS.TEXT_BODY, fontSize: 14,
    },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.XL },
    emptyIcon: { fontSize: 48, marginBottom: SPACING.MD },
    emptyTitle: { fontSize: 17, fontWeight: '800', color: COLORS.TEXT_HEADING, marginBottom: 6 },
    emptySubtitle: { fontSize: 13, color: COLORS.TEXT_DIM, textAlign: 'center', lineHeight: 20 },
    card: {
        backgroundColor: '#fff', borderRadius: RADIUS.LG, padding: SPACING.MD,
        marginBottom: SPACING.SM, borderWidth: 1, borderColor: COLORS.BORDER,
        shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: SPACING.SM },
    cardBadge: { backgroundColor: COLORS.PRIMARY + '20', borderRadius: RADIUS.SM, paddingHorizontal: 8, paddingVertical: 2 },
    cardBadgeText: { fontSize: 10, fontWeight: '800', color: COLORS.PRIMARY, textTransform: 'uppercase' },
    cardBillNo: { flex: 1, fontSize: 14, fontWeight: '800', color: COLORS.TEXT_HEADING },
    cardAmount: { fontSize: 14, fontWeight: '900', color: COLORS.PRIMARY },
    cardCustomer: { fontSize: 13, color: COLORS.TEXT_BODY, marginBottom: 2 },
    cardDate: { fontSize: 11, color: COLORS.TEXT_DIM, marginBottom: SPACING.SM },
    irnRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.SM },
    irnLabel: { fontSize: 10, fontWeight: '800', color: COLORS.TEXT_DIM, textTransform: 'uppercase', width: 44 },
    irnVal: { flex: 1, fontSize: 12, fontWeight: '700', color: COLORS.PRIMARY, fontFamily: 'monospace' },
    actionRow: { flexDirection: 'row', gap: SPACING.SM, marginTop: SPACING.SM },
    cancelBtn: {
        flex: 1, marginTop: SPACING.SM, paddingVertical: 8, borderRadius: RADIUS.MD,
        borderWidth: 1.5, borderColor: COLORS.ERROR, alignItems: 'center',
    },
    cancelBtnText: { color: COLORS.ERROR, fontSize: 12, fontWeight: '700' },
    updateBtn: {
        flex: 1, paddingVertical: 8, borderRadius: RADIUS.MD,
        borderWidth: 1.5, borderColor: '#8e44ad', alignItems: 'center',
    },
    updateBtnText: { color: '#8e44ad', fontSize: 12, fontWeight: '700' },
});

const md = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
    sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24 },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        padding: SPACING.MD, borderBottomWidth: 1, borderBottomColor: COLORS.BORDER,
    },
    title: { fontSize: 17, fontWeight: '800', color: COLORS.TEXT_HEADING },
    close: { fontSize: 20, color: COLORS.TEXT_DIM, padding: 4 },
    body: { padding: SPACING.MD, gap: SPACING.SM },
    irnBox: {
        backgroundColor: COLORS.BACKGROUND, borderRadius: RADIUS.MD,
        padding: SPACING.MD, marginBottom: SPACING.SM,
    },
    irnLabel: { fontSize: 10, fontWeight: '700', color: COLORS.TEXT_DIM, textTransform: 'uppercase', marginBottom: 4 },
    irnVal: { fontSize: 13, fontWeight: '800', color: COLORS.PRIMARY, fontFamily: 'monospace' },
    sectionLabel: { fontSize: 12, fontWeight: '700', color: COLORS.TEXT_HEADING, marginBottom: 6 },
    reasonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.SM, marginBottom: SPACING.SM },
    reasonBtn: {
        paddingHorizontal: SPACING.MD, paddingVertical: 8,
        borderRadius: RADIUS.MD, borderWidth: 1.5, borderColor: COLORS.BORDER, backgroundColor: '#fff',
    },
    reasonBtnActive: { borderColor: COLORS.ERROR, backgroundColor: COLORS.ERROR + '15' },
    reasonText: { fontSize: 12, fontWeight: '600', color: COLORS.TEXT_DIM },
    reasonTextActive: { color: COLORS.ERROR, fontWeight: '800' },
    remarkInput: {
        backgroundColor: COLORS.BACKGROUND, borderRadius: RADIUS.MD, paddingHorizontal: SPACING.MD,
        paddingVertical: 10, borderWidth: 1, borderColor: COLORS.BORDER,
        color: COLORS.TEXT_BODY, fontSize: 14, marginBottom: SPACING.SM,
    },
    warningBox: {
        backgroundColor: '#FFF3CD', borderRadius: RADIUS.MD, padding: SPACING.SM,
        borderWidth: 1, borderColor: '#FFEEBA',
    },
    warningText: { color: '#856404', fontSize: 12, fontWeight: '600' },
    footer: {
        flexDirection: 'row', gap: SPACING.SM, padding: SPACING.MD,
        borderTopWidth: 1, borderTopColor: COLORS.BORDER,
    },
    cancelBtn: {
        flex: 1, paddingVertical: SPACING.MD, borderRadius: RADIUS.LG,
        borderWidth: 1.5, borderColor: COLORS.BORDER, alignItems: 'center',
    },
    cancelBtnText: { color: COLORS.TEXT_DIM, fontWeight: '700', fontSize: 14 },
    confirmBtn: {
        flex: 2, paddingVertical: SPACING.MD, borderRadius: RADIUS.LG,
        backgroundColor: COLORS.ERROR, alignItems: 'center',
    },
    confirmBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});

const g = StyleSheet.create({
    section: {
        borderRadius: RADIUS.LG, padding: SPACING.MD,
        marginBottom: SPACING.MD, borderLeftWidth: 4,
    },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.SM, marginBottom: SPACING.MD },
    sectionIcon: { fontSize: 22 },
    sectionTitle: { fontSize: 16, fontWeight: '900' },
    infoRow: { marginBottom: SPACING.SM },
    infoLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', marginBottom: 2 },
    infoValue: { fontSize: 13, color: COLORS.TEXT_BODY, lineHeight: 19 },
    table: { borderRadius: RADIUS.MD, overflow: 'hidden', borderWidth: 1, borderColor: '#ddd' },
    tableRow: { flexDirection: 'row' },
    tableHeader: { backgroundColor: 'rgba(0,0,0,0.07)' },
    tableCell: { flex: 1, fontSize: 12, color: COLORS.TEXT_BODY, padding: 8, borderRightWidth: 1, borderRightColor: '#ddd' },
    tableHeaderCell: { fontWeight: '800', color: COLORS.TEXT_HEADING },
    footer: { padding: SPACING.MD, marginBottom: SPACING.LG },
    footerText: { fontSize: 12, color: COLORS.TEXT_DIM, textAlign: 'center', lineHeight: 18 },
    footerLink: { color: COLORS.PRIMARY, fontWeight: '700', textDecorationLine: 'underline' },
});
