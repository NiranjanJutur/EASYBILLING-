import React, { useState, useEffect } from 'react';
import { SafeAreaView, StatusBar, StyleSheet, View, ActivityIndicator } from 'react-native';
import { COLORS } from './config/theme';
import LoginScreen from './screens/auth/LoginScreen';
import RegisterScreen from './screens/auth/RegisterScreen';
import AppNavigator from './navigation/AppNavigator';
import { Language } from './utils/i18n';
import { StoreProvider, useStore } from './context/StoreContext';
import { SessionProvider, useSession } from './context/SessionContext';
import { setActiveStoreId } from './services/activeStoreId';
import { isRegistered, getRegistration } from './services/local/registrationService';

const AppInner = () => {
    const { staff, login } = useSession();
    const { reloadStore } = useStore();
    const [lang, setLang] = useState<Language>('en');
    const [registered, setRegistered] = useState<boolean | null>(null);
    const [showRegister, setShowRegister] = useState(false);

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

    if (registered === null) {
        return (
            <SafeAreaView style={[styles.container, styles.center]}>
                <ActivityIndicator size="large" color={COLORS.PRIMARY} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={COLORS.BACKGROUND} />
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
        </SafeAreaView>
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
