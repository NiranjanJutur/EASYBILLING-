import React from 'react';
import { Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ROLES } from '../config/constants';
import { COLORS } from '../config/theme';
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
import GodownScreen from '../screens/godown/GodownScreen';
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
    compliance: '📋',
    godown: '🏢',
    purchases: '🛒',
};

const getTabOptions = (t: any, routeName: string) => ({
    tabBarActiveTintColor: COLORS.PRIMARY,
    tabBarInactiveTintColor: '#6c7a89',
    tabBarLabel: t?.tabs?.[routeName.toLowerCase()] || routeName,
    tabBarIcon: ({ color, size, focused }: any) => (
        <Text style={{ fontSize: size + (focused ? 2 : 0) }}>
            {TAB_ICONS[routeName.toLowerCase()] || '⚪'}
        </Text>
    ),
    headerShown: false,
    tabBarLabelStyle: { fontSize: 11, fontWeight: '600' as any },
    tabBarStyle: {
        height: 62,
        paddingBottom: 8,
        paddingTop: 6,
        backgroundColor: '#ffffff',
        borderTopWidth: 1,
        borderTopColor: '#e0e0e0',
        // @ts-ignore — web-only: make tabs scroll horizontally when they overflow
        overflowX: 'auto' as any,
        flexWrap: 'nowrap' as any,
    },
    tabBarItemStyle: { minWidth: 68, paddingHorizontal: 2 },
});

const OwnerTabs = ({ role, lang }: { role: string; lang: Language }) => {
    const t = TRANSLATIONS[lang] || TRANSLATIONS.en;
    return (
        <Tab.Navigator screenOptions={({ route }) => getTabOptions(t, route.name)}>
            <Tab.Screen name="home">{(props) => <HomeScreen {...props} role={role} lang={lang} />}</Tab.Screen>
            <Tab.Screen name="items" component={InventoryScreen} />
            <Tab.Screen name="godown" component={GodownScreen} />
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
        <Tab.Navigator screenOptions={({ route }) => getTabOptions(t, route.name)}>
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
        <Tab.Navigator screenOptions={({ route }) => getTabOptions(t, route.name)}>
            <Tab.Screen name="home">{(props) => <HomeScreen {...props} role={role} lang={lang} />}</Tab.Screen>
            <Tab.Screen name="items" component={InventoryScreen} />
            <Tab.Screen name="purchases" component={PurchasesListScreen} />
            <Tab.Screen name="godown" component={GodownScreen} />
            <Tab.Screen name="customers" component={CustomersScreen} />
        </Tab.Navigator>
    );
};

const AccountantTabs = ({ role, lang }: { role: string; lang: Language }) => {
    const t = TRANSLATIONS[lang] || TRANSLATIONS.en;
    return (
        <Tab.Navigator screenOptions={({ route }) => getTabOptions(t, route.name)}>
            <Tab.Screen name="dashboard" component={AccountantDashboard} />
            <Tab.Screen name="items" component={InventoryScreen} />
            <Tab.Screen name="customers" component={CustomersScreen} />
            <Tab.Screen name="reports" component={ReportsScreen} />
        </Tab.Navigator>
    );
};

const TabNavigator = ({ role, lang }: { role: string; lang: Language }) => {
    switch (role) {
        case ROLES.OWNER: return <OwnerTabs role={role} lang={lang} />;
        case ROLES.CASHIER: return <CashierTabs role={role} lang={lang} />;
        case ROLES.STOCK_MANAGER: return <StockTabs role={role} lang={lang} />;
        case ROLES.ACCOUNTANT: return <AccountantTabs role={role} lang={lang} />;
        default: return <CashierTabs role={role} lang={lang} />;
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
                <Stack.Screen name="ScanScreen" component={ScanScreen} options={{ headerShown: true, title: 'Scan Product' }} />
                <Stack.Screen name="SlipProcessing" component={SlipProcessingScreen} options={{ headerShown: true, title: 'Process Slip' }} />
                <Stack.Screen name="NewPurchase" component={NewPurchaseScreen} options={{ headerShown: false }} />
                <Stack.Screen name="PurchaseDetail" component={PurchaseDetailScreen} options={{ headerShown: false }} />
                <Stack.Screen name="SuppliersList" component={SuppliersListScreen} options={{ headerShown: false }} />
                <Stack.Screen name="StaffPins" component={StaffPinsScreen} options={{ headerShown: false }} />
            </Stack.Navigator>
        </NavigationContainer>
    );
};

export default AppNavigator;
