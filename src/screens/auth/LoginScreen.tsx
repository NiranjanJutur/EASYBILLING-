import React, { useRef, useState } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, TextInput, Platform,
} from 'react-native';
import { COLORS, SPACING, RADIUS, FONT_SIZE, FONT_WEIGHT, SHADOW } from '../../config/theme';
import { TRANSLATIONS, Language } from '../../utils/i18n';
import { useStore } from '../../context/StoreContext';
import { staffLogin } from '../../services/firebase/firestoreService';
import { setActiveStoreId } from '../../services/activeStoreId';
import { ENV } from '../../config/env';
import type { StaffRole, StaffSession } from '../../models/Staff';
import { ROLE_LABELS } from '../../models/Staff';

interface LoginScreenProps {
    onLogin: (staff: StaffSession) => void;
    onLangChange?: (l: Language) => void;
}

const LANGUAGES: { key: Language; label: string }[] = [
    { key: 'en', label: 'EN' },
    { key: 'kn', label: 'ಕನ್ನಡ' },
    { key: 'hi', label: 'हिन्दी' },
];

const TEXT: Record<string, { store: string; pin: string; login: string; hint: string }> = {
    en: { store: 'Select store', pin: 'Enter your PIN', login: 'Log in', hint: 'Your PIN decides your role (Owner, Cashier, Stock Manager or Accountant).' },
    kn: { store: 'ಅಂಗಡಿ ಆಯ್ಕೆ ಮಾಡಿ', pin: 'ನಿಮ್ಮ ಪಿನ್ ನಮೂದಿಸಿ', login: 'ಲಾಗಿನ್', hint: 'ನಿಮ್ಮ ಪಿನ್ ನಿಮ್ಮ ಪಾತ್ರವನ್ನು ನಿರ್ಧರಿಸುತ್ತದೆ.' },
    hi: { store: 'दुकान चुनें', pin: 'अपना पिन डालें', login: 'लॉग इन', hint: 'आपका पिन आपकी भूमिका तय करता है।' },
};

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'];
const DEV_ROLES: StaffRole[] = ['OWNER', 'CASHIER', 'STOCK_MANAGER', 'ACCOUNTANT'];

const LoginScreen = ({ onLogin, onLangChange }: LoginScreenProps) => {
    const [lang, setLang] = useState<Language>('en');
    const [pin, setPin] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const { activeStore, setActiveStore, stores } = useStore();
    const inputRef = useRef<TextInput>(null);

    const t = TRANSLATIONS[lang] || TRANSLATIONS.en;
    const L = TEXT[lang] || TEXT.en;

    const handleLangSelect = (l: Language) => {
        setLang(l);
        onLangChange?.(l);
    };

    const pressKey = (key: string) => {
        setError('');
        if (key === 'clear') setPin('');
        else if (key === 'back') setPin(p => p.slice(0, -1));
        else setPin(p => (p.length < 6 ? p + key : p));
    };

    const handleLogin = async () => {
        if (isLoading) return;
        if (!/^\d{4,6}$/.test(pin)) {
            setError('PIN must be 4 to 6 digits');
            return;
        }
        setIsLoading(true);
        setError('');
        try {
            setActiveStoreId(activeStore.id);
            const res = await staffLogin(activeStore.id, pin);
            if (!res.ok || !res.id || !res.role) {
                const left = res.attemptsLeft !== undefined && !res.locked ? ` (${res.attemptsLeft} tries left)` : '';
                setError((res.error || 'Wrong PIN') + left);
                setPin('');
                return;
            }
            onLogin({
                id: res.id,
                name: res.name || ROLE_LABELS[res.role],
                role: res.role,
                storeId: activeStore.id,
                loginAt: Date.now(),
            });
        } catch (err: any) {
            setError(err?.message || 'Could not log in');
        } finally {
            setIsLoading(false);
        }
    };

    const devLogin = (role: StaffRole) => {
        setActiveStoreId(activeStore.id);
        onLogin({ id: `dev-${role.toLowerCase()}`, name: `${ROLE_LABELS[role]} (dev)`, role, storeId: activeStore.id, loginAt: Date.now(), dev: true });
    };

    return (
        <View style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" style={{ width: '100%' }}>
                <View style={[styles.header, { backgroundColor: activeStore.color }]}>
                    <View style={styles.logoCont}>
                        <Text style={styles.logoIcon}>{activeStore.icon}</Text>
                    </View>
                    <Text style={styles.shopName}>{activeStore.name}</Text>
                    <Text style={styles.caption}>{t.caption}</Text>
                </View>

                <View style={styles.contentWrap}>
                    <View style={styles.langBar}>
                        {LANGUAGES.map(l => (
                            <TouchableOpacity
                                key={l.key}
                                style={[styles.langBtn, lang === l.key && { backgroundColor: activeStore.color, borderColor: activeStore.color }]}
                                onPress={() => handleLangSelect(l.key)}
                                accessibilityRole="button"
                            >
                                <Text style={[styles.langText, lang === l.key && styles.langTextActive]}>{l.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <Text style={styles.sectionLabel}>{L.store}</Text>
                    <View style={styles.storeRow}>
                        {stores.map(store => {
                            const isActive = activeStore.id === store.id;
                            return (
                                <TouchableOpacity
                                    key={store.id}
                                    style={[styles.storeCard, isActive && { borderColor: store.color, borderWidth: 2, backgroundColor: store.color + '0D' }]}
                                    onPress={() => { setActiveStore(store); setError(''); }}
                                    activeOpacity={0.8}
                                    accessibilityRole="button"
                                    accessibilityState={{ selected: isActive }}
                                >
                                    <Text style={styles.storeIcon}>{store.icon}</Text>
                                    <Text style={[styles.storeCardName, isActive && { color: store.color }]} numberOfLines={2}>{store.name}</Text>
                                    {isActive && (
                                        <View style={[styles.storeCheck, { backgroundColor: store.color }]}>
                                            <Text style={styles.storeCheckText}>✓</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    <View style={styles.pinCard}>
                        <Text style={styles.pinTitle}>{L.pin}</Text>
                        <TouchableOpacity activeOpacity={1} onPress={() => inputRef.current?.focus()} style={styles.dotsRow}>
                            {[0, 1, 2, 3, 4, 5].map(i => (
                                <View
                                    key={i}
                                    style={[
                                        styles.dot,
                                        i < pin.length && { backgroundColor: activeStore.color, borderColor: activeStore.color },
                                        i >= 4 && i >= pin.length && styles.dotOptional,
                                    ]}
                                />
                            ))}
                        </TouchableOpacity>
                        {/* Real input so a hardware keyboard / phone keypad also works */}
                        <TextInput
                            ref={inputRef}
                            value={pin}
                            onChangeText={v => { setError(''); setPin(v.replace(/\D/g, '').slice(0, 6)); }}
                            onSubmitEditing={handleLogin}
                            keyboardType="number-pad"
                            secureTextEntry
                            maxLength={6}
                            autoFocus={Platform.OS === 'web'}
                            style={styles.hiddenInput}
                            accessibilityLabel="PIN"
                        />

                        {error ? <Text style={styles.errorText}>{error}</Text> : null}

                        <View style={styles.keypad}>
                            {KEYS.map(k => (
                                <TouchableOpacity
                                    key={k}
                                    style={[styles.key, (k === 'clear' || k === 'back') && styles.keyMuted]}
                                    onPress={() => pressKey(k)}
                                    activeOpacity={0.6}
                                    accessibilityRole="button"
                                    accessibilityLabel={k === 'back' ? 'Delete' : k === 'clear' ? 'Clear' : k}
                                >
                                    <Text style={[styles.keyText, (k === 'clear' || k === 'back') && styles.keyTextMuted]}>
                                        {k === 'back' ? '⌫' : k === 'clear' ? 'C' : k}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TouchableOpacity
                            style={[styles.loginBtn, { backgroundColor: activeStore.color }, (isLoading || pin.length < 4) && { opacity: 0.55 }]}
                            onPress={handleLogin}
                            disabled={isLoading || pin.length < 4}
                            accessibilityRole="button"
                        >
                            {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginBtnText}>{L.login}</Text>}
                        </TouchableOpacity>
                        <Text style={styles.hint}>{L.hint}</Text>
                    </View>

                    {ENV.IS_DEV && (
                        <View style={styles.devBox}>
                            <Text style={styles.devTitle}>Developer shortcut · debug builds only</Text>
                            <View style={styles.devRow}>
                                {DEV_ROLES.map(r => (
                                    <TouchableOpacity key={r} style={styles.devBtn} onPress={() => devLogin(r)}>
                                        <Text style={styles.devBtnText}>{ROLE_LABELS[r]}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    )}

                    <Text style={styles.footer}>{activeStore.name} · v1.2.0</Text>
                </View>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.BACKGROUND },
    scrollContent: { flexGrow: 1, alignItems: 'center', paddingBottom: 40 },
    contentWrap: { width: '100%', maxWidth: 440, alignItems: 'stretch', paddingHorizontal: SPACING.LG },
    header: { width: '100%', alignItems: 'center', paddingTop: 36, paddingBottom: 28, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
    logoCont: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
    logoIcon: { fontSize: 32 },
    shopName: { color: '#fff', fontSize: FONT_SIZE.XL, fontWeight: FONT_WEIGHT.EXTRABOLD, textAlign: 'center' },
    caption: { color: 'rgba(255,255,255,0.85)', fontSize: FONT_SIZE.XS, marginTop: 3, fontWeight: FONT_WEIGHT.SEMIBOLD },

    langBar: { flexDirection: 'row', gap: SPACING.SM, marginTop: SPACING.LG, justifyContent: 'center' },
    langBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: RADIUS.PILL, borderWidth: 1, borderColor: COLORS.BORDER, backgroundColor: COLORS.WHITE },
    langText: { fontSize: FONT_SIZE.SM, color: COLORS.TEXT_DIM, fontWeight: FONT_WEIGHT.BOLD },
    langTextActive: { color: '#fff' },

    sectionLabel: { fontSize: FONT_SIZE.XS, color: COLORS.TEXT_DIM, fontWeight: FONT_WEIGHT.EXTRABOLD, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: SPACING.LG, marginBottom: SPACING.SM, textAlign: 'center' },
    storeRow: { flexDirection: 'row', gap: SPACING.SM },
    storeCard: { flex: 1, backgroundColor: COLORS.WHITE, padding: SPACING.MD, borderRadius: RADIUS.LG, borderWidth: 1, borderColor: COLORS.BORDER, alignItems: 'center' },
    storeIcon: { fontSize: 24, marginBottom: 4 },
    storeCardName: { fontSize: FONT_SIZE.XS, fontWeight: FONT_WEIGHT.BOLD, color: COLORS.TEXT_HEADING, textAlign: 'center' },
    storeCheck: { position: 'absolute', top: 6, right: 6, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
    storeCheckText: { color: '#fff', fontSize: 10, fontWeight: FONT_WEIGHT.BLACK },

    pinCard: { backgroundColor: COLORS.WHITE, borderRadius: RADIUS.XL, padding: SPACING.LG, marginTop: SPACING.LG, borderWidth: 1, borderColor: COLORS.BORDER, ...SHADOW.MEDIUM },
    pinTitle: { fontSize: FONT_SIZE.MD, fontWeight: FONT_WEIGHT.BOLD, color: COLORS.TEXT_HEADING, textAlign: 'center' },
    dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginVertical: SPACING.LG },
    dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: COLORS.BORDER, backgroundColor: COLORS.WHITE },
    dotOptional: { borderStyle: 'dashed', opacity: 0.6 },
    hiddenInput: { position: 'absolute', width: 1, height: 1, opacity: 0 },
    errorText: { color: COLORS.ERROR, fontSize: FONT_SIZE.SM, fontWeight: FONT_WEIGHT.BOLD, textAlign: 'center', marginBottom: SPACING.SM },

    keypad: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
    key: { width: '31%', height: 54, borderRadius: RADIUS.LG, backgroundColor: COLORS.SURFACE, borderWidth: 1, borderColor: COLORS.DIVIDER, alignItems: 'center', justifyContent: 'center' },
    keyMuted: { backgroundColor: COLORS.WHITE },
    keyText: { fontSize: 22, fontWeight: FONT_WEIGHT.BOLD, color: COLORS.TEXT_HEADING },
    keyTextMuted: { fontSize: 18, color: COLORS.TEXT_DIM },

    loginBtn: { marginTop: SPACING.LG, paddingVertical: 14, borderRadius: RADIUS.LG, alignItems: 'center' },
    loginBtnText: { color: '#fff', fontSize: FONT_SIZE.LG, fontWeight: FONT_WEIGHT.EXTRABOLD },
    hint: { marginTop: SPACING.SM, fontSize: FONT_SIZE.XS, color: COLORS.TEXT_DIM, textAlign: 'center', lineHeight: 16 },

    devBox: { marginTop: SPACING.LG, padding: SPACING.MD, borderRadius: RADIUS.LG, borderWidth: 1, borderStyle: 'dashed', borderColor: COLORS.WARNING },
    devTitle: { fontSize: FONT_SIZE.XS, fontWeight: FONT_WEIGHT.BOLD, color: COLORS.TEXT_DIM, textAlign: 'center', marginBottom: SPACING.SM },
    devRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.SM, justifyContent: 'center' },
    devBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: RADIUS.PILL, backgroundColor: COLORS.WARNING_BG },
    devBtnText: { fontSize: FONT_SIZE.XS, fontWeight: FONT_WEIGHT.BOLD, color: COLORS.TEXT_BODY },

    footer: { marginTop: SPACING.XL, fontSize: FONT_SIZE.XS, color: COLORS.TEXT_DIM, fontWeight: FONT_WEIGHT.SEMIBOLD, textAlign: 'center' },
});

export default LoginScreen;
