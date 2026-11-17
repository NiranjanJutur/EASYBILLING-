import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import LoginScreen from './screens/auth/LoginScreen';
import { Language } from './utils/i18n';
import { COLORS } from './config/theme';
import { AUTH_SECURITY } from './config/constants';
import AppNavigator from './navigation/AppNavigator';
import { StoreProvider, useStore } from './context/StoreContext';
import { SessionProvider, useSession } from './context/SessionContext';
import { setActiveStoreId } from './services/activeStoreId';

const AppInner = () => {
    const { staff, login, logout } = useSession();
    const { activeStore, setActiveStore, stores } = useStore();
    const [lang, setLang] = useState<Language>('en');
    const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    return (
        <View style={styles.container}>
            {!staff ? (
                <LoginScreen onLogin={login} onLangChange={setLang} />
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
});

export default App;
