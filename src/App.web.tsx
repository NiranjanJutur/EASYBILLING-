import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import LoginScreen from './screens/auth/LoginScreen';
import RegisterScreen from './screens/auth/RegisterScreen';
import { Language } from './utils/i18n';
import { COLORS } from './config/theme';
import { AUTH_SECURITY } from './config/constants';
import AppNavigator from './navigation/AppNavigator';
import { StoreProvider, useStore } from './context/StoreContext';
import { SessionProvider, useSession } from './context/SessionContext';
import { setActiveStoreId } from './services/activeStoreId';
import { isRegistered, getRegistration } from './services/local/registrationService';

const AppInner = () => {
    const { staff, login, logout } = useSession();
    const { activeStore, setActiveStore, stores, reloadStore } = useStore();
    const [lang, setLang] = useState<Language>('en');
    const [registered, setRegistered] = useState<boolean | null>(null);
    const [showRegister, setShowRegister] = useState(false);
    const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Check registration status on launch
    useEffect(() => {
        let mounted = true;
        (async () => {
            const isReg = await isRegistered();
            if (!mounted) return;
            setRegistered(isReg);
            if (isReg) {
                const regData = await getRegistration();
                if (regData?.language && mounted) {
                    setLang(regData.language);
                }
            }
        })();
        return () => { mounted = false; };
    }, []);

    const handleRegistrationComplete = async () => {
        await reloadStore();
        setRegistered(true);
        setShowRegister(false);
    };

    // Every query is scoped to the logged-in staff member's store.
    if (staff) setActiveStoreId(staff.storeId);
    else setActiveStoreId(activeStore.id);

    // A restored session (page reload) wins over the last-picked store.
    useEffect(() => {
        if (staff && staff.storeId !== activeStore.id) {
            const s = stores.find(x => x.id === staff.storeId);
            if (s) setActiveStore(s);
        }
    }, [staff, activeStore.id, stores, setActiveStore]);

    // Auto-logout after inactivity
    const resetInactivityTimer = useCallback(() => {
        if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
        if (!staff) return;
        inactivityTimer.current = setTimeout(logout, AUTH_SECURITY.SESSION_TIMEOUT_MS);
    }, [staff, logout]);

    useEffect(() => {
        if (!staff) return;
        resetInactivityTimer();
        const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
        const handler = () => resetInactivityTimer();
        events.forEach(e => window.addEventListener(e, handler, { passive: true }));
        return () => {
            events.forEach(e => window.removeEventListener(e, handler));
            if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
        };
    }, [staff, resetInactivityTimer]);

    if (registered === null) {
        return (
            <View style={[styles.container, styles.center]}>
                <ActivityIndicator size="large" color={COLORS.PRIMARY} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {!registered || showRegister ? (
                <RegisterScreen onComplete={handleRegistrationComplete} />
            ) : !staff ? (
                <LoginScreen
                    onLogin={login}
                    onLangChange={setLang}
                    onRegisterPress={() => setShowRegister(true)}
                />
            ) : (
                <AppNavigator role={staff.role} lang={lang} />
            )}
        </View>
    );
};

const App = () => (
    <StoreProvider>
        <SessionProvider>
            <AppInner />
        </SessionProvider>
    </StoreProvider>
);

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.BACKGROUND },
    center: { justifyContent: 'center', alignItems: 'center' },
});

export default App;
