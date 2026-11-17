import React from 'react';
import { Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ROLES } from '../config/constants';
import { COLORS, COMPONENT, FONT_SIZE, FONT_WEIGHT } from '../config/theme';
import { TRANSLATIONS, Language } from '../utils/i18n';

import HomeScreen from '../screens/home/HomeScreen';
import InventoryScreen from '../screens/stock/InventoryScreen';
import BillingScreen from '../screens/cashier/BillingScreen';
import CustomersScreen from '../screens/customers/CustomersScreen';
import OwnerDashboard from '../screens/owner/OwnerDashboard';
import AccountantDashboard from '../screens/accountant/AccountantDashboard';
import ReportsScreen from '../screens/accountant/ReportsScreen';
import BillsHistoryScreen from '../screens/bills/BillsHistoryScreen';
import ScanScreen from '../screens/home/ScanScreen';
import SlipProcessingScreen from '../screens/home/SlipProcessingScreen';
import PurchasesListScreen from '../screens/purchases/PurchasesListScreen';
import NewPurchaseScreen from '../screens/purchases/NewPurchaseScreen';
import PurchaseDetailScreen from '../screens/purchases/PurchaseDetailScreen';
import SuppliersListScreen from '../screens/purchases/SuppliersListScreen';
import StaffPinsScreen from '../screens/owner/StaffPinsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const TAB_ICONS: Record<string, string> = {
    home: '🏠',
    items: '📦',
    billing: '🧾',
    customers: '👥',
    dashboard: '📊',
    reports: '📈',
    purchases: '🛒',
};

const makeTabOptions = (t: any) => ({ route }: { route: any }) => ({
    tabBarActiveTintColor: COLORS.PRIMARY,
    tabBarInactiveTintColor: COLORS.TEXT_DIM,
    tabBarLabel: ({ focused, color }: { focused: boolean; color: string }) => (
        <Text style={{
            fontSize: FONT_SIZE.XS,
            fontWeight: focused ? FONT_WEIGHT.BOLD : FONT_WEIGHT.MEDIUM,
            color,
            marginTop: 2,
        }}>
            {t?.tabs?.[route.name.toLowerCase()] ?? route.name}
        </Text>
    ),
    tabBarIcon: ({ color, size, focused }: { color: string; size: number; focused: boolean }) => (
        <Text style={{ fontSize: size + (focused ? 2 : 0) }}>
            {TAB_ICONS[route.name.toLowerCase()] || '⚪'}
        </Text>
    ),
    headerShown: false,
    tabBarStyle: COMPONENT.TAB_BAR,
});

const OwnerTabs = ({ role, lang }: { role: string; lang: Language }) => {
    const t = TRANSLATIONS[lang] || TRANSLATIONS.en;
    return (
        <Tab.Navigator screenOptions={makeTabOptions(t)}>
            <Tab.Screen name="home">{(props) => <HomeScreen {...props} role={role} lang={lang} />}</Tab.Screen>
            <Tab.Screen name="items" component={InventoryScreen} />
            <Tab.Screen name="billing" component={BillingScreen} />
            <Tab.Screen name="purchases" component={PurchasesListScreen} />
            <Tab.Screen name="customers" component={CustomersScreen} />
            <Tab.Screen name="dashboard" component={OwnerDashboard} />
        </Tab.Navigator>
    );
};

const CashierTabs = ({ role, lang }: { role: string; lang: Language }) => {
    const t = TRANSLATIONS[lang] || TRANSLATIONS.en;
    return (
        <Tab.Navigator screenOptions={makeTabOptions(t)}>
            <Tab.Screen name="home">{(props) => <HomeScreen {...props} role={role} lang={lang} />}</Tab.Screen>
            <Tab.Screen name="items" component={InventoryScreen} />
            <Tab.Screen name="billing" component={BillingScreen} />
            <Tab.Screen name="customers" component={CustomersScreen} />
        </Tab.Navigator>
    );
};

const StockTabs = ({ role, lang }: { role: string; lang: Language }) => {
    const t = TRANSLATIONS[lang] || TRANSLATIONS.en;
    return (
        <Tab.Navigator screenOptions={makeTabOptions(t)}>
            <Tab.Screen name="home">{(props) => <HomeScreen {...props} role={role} lang={lang} />}</Tab.Screen>
            <Tab.Screen name="items" component={InventoryScreen} />
            <Tab.Screen name="purchases" component={PurchasesListScreen} />
            <Tab.Screen name="customers" component={CustomersScreen} />
        </Tab.Navigator>
    );
};

const AccountantTabs = ({ role, lang }: { role: string; lang: Language }) => {
    const t = TRANSLATIONS[lang] || TRANSLATIONS.en;
    return (
        <Tab.Navigator screenOptions={makeTabOptions(t)}>
            <Tab.Screen name="dashboard" component={AccountantDashboard} />
            <Tab.Screen name="items" component={InventoryScreen} />
            <Tab.Screen name="customers" component={CustomersScreen} />
            <Tab.Screen name="reports" component={ReportsScreen} />
        </Tab.Navigator>
    );
};

const TabNavigator = ({ role, lang }: { role: string; lang: Language }) => {
    switch (role) {
        case ROLES.OWNER:         return <OwnerTabs role={role} lang={lang} />;
        case ROLES.CASHIER:       return <CashierTabs role={role} lang={lang} />;
        case ROLES.STOCK_MANAGER: return <StockTabs role={role} lang={lang} />;
        case ROLES.ACCOUNTANT:    return <AccountantTabs role={role} lang={lang} />;
        default:                  return <CashierTabs role={role} lang={lang} />;
    }
};

const AppNavigator = ({ role, lang, onLogout }: { role: string; lang: Language; onLogout: () => void }) => {
    return (
        <NavigationContainer>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
                <Stack.Screen name="MainTabs">
                    {() => <TabNavigator role={role} lang={lang} />}
                </Stack.Screen>
                <Stack.Screen name="Bills" component={BillsHistoryScreen} options={{ headerShown: true, title: 'Bills History' }} />
                <Stack.Screen name="ScanScreen" component={ScanScreen} options={{ headerShown: true, title: 'Scan' }} />
                <Stack.Screen name="SlipProcessing" component={SlipProcessingScreen} options={{ headerShown: true, title: 'Slips' }} />
                <Stack.Screen name="NewPurchase" component={NewPurchaseScreen} options={{ headerShown: false }} />
                <Stack.Screen name="PurchaseDetail" component={PurchaseDetailScreen} options={{ headerShown: false }} />
                <Stack.Screen name="SuppliersList" component={SuppliersListScreen} options={{ headerShown: false }} />
                <Stack.Screen name="StaffPins" component={StaffPinsScreen} options={{ headerShown: false }} />
            </Stack.Navigator>
        </NavigationContainer>
    );
};

export default AppNavigator;
