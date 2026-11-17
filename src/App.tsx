import React, { useState } from 'react';
import { SafeAreaView, StatusBar, StyleSheet } from 'react-native';
import { COLORS } from './config/theme';
import LoginScreen from './screens/auth/LoginScreen';
import AppNavigator from './navigation/AppNavigator';
import { Language } from './utils/i18n';
import { StoreProvider } from './context/StoreContext';
import { SessionProvider, useSession } from './context/SessionContext';
import { setActiveStoreId } from './services/activeStoreId';

const AppInner = () => {
    const { staff, login } = useSession();
    const [lang, setLang] = useState<Language>('en');

    // Every query is scoped to the logged-in staff member's store.
    if (staff) setActiveStoreId(staff.storeId);

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={COLORS.BACKGROUND} />
            {!staff ? (
                <LoginScreen onLogin={login} onLangChange={setLang} />
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
});

export default App;
