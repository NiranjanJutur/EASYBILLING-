/**
 * AppNavigator.tsx — Role-based navigation with desktop sidebar support.
 *
 * On wide screens (≥ 768px):
 *   - DesktopSidebar rendered on the left
 *   - Bottom tab bar hidden via tabBarStyle: { display: 'none' }
 *   - Navigation still driven by React Navigation tab state
 *
 * On narrow screens / Android:
 *   - Standard bottom tab bar (zero change from original)
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ROLES } from '../config/constants';
import { COLORS, COMPONENT, FONT_SIZE, FONT_WEIGHT } from '../config/theme';
import { TRANSLATIONS, Language } from '../utils/i18n';
import { useIsDesktop } from '../hooks/useIsDesktop';

import HomeScreen         from '../screens/home/HomeScreen';
import InventoryScreen    from '../screens/stock/InventoryScreen';
import BillingScreen      from '../screens/cashier/BillingScreen';
import CustomersScreen    from '../screens/customers/CustomersScreen';
import OwnerDashboard     from '../screens/owner/OwnerDashboard';
import AccountantDashboard from '../screens/accountant/AccountantDashboard';
import ReportsScreen      from '../screens/accountant/ReportsScreen';
import BillsHistoryScreen from '../screens/bills/BillsHistoryScreen';
import ScanScreen         from '../screens/home/ScanScreen';
import SlipProcessingScreen from '../screens/home/SlipProcessingScreen';
import PurchasesListScreen  from '../screens/purchases/PurchasesListScreen';
import NewPurchaseScreen    from '../screens/purchases/NewPurchaseScreen';
import PurchaseDetailScreen from '../screens/purchases/PurchaseDetailScreen';
import SuppliersListScreen  from '../screens/purchases/SuppliersListScreen';
import StaffPinsScreen      from '../screens/owner/StaffPinsScreen';
import DesktopSidebar from './DesktopSidebar';

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

// ─── Tab icon config ──────────────────────────────────────────────────────────

const TAB_ICONS: Record<string, string> = {
  home:      '🏠',
  items:     '📦',
  billing:   '🧾',
  customers: '👥',
  dashboard: '📊',
  reports:   '📈',
  purchases: '🛒',
};

const TAB_LABELS: Record<string, string> = {
  home:      'Home',
  items:     'Inventory',
  billing:   'Billing',
  customers: 'Customers',
  dashboard: 'Dashboard',
  reports:   'Reports',
  purchases: 'Purchases',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeTabOptions = (t: any, isDesktop: boolean) => ({ route }: { route: any }) => ({
  tabBarActiveTintColor:   COLORS.PRIMARY,
  tabBarInactiveTintColor: COLORS.TEXT_DIM,
  tabBarLabel: ({ focused, color }: { focused: boolean; color: string }) => (
    <Text style={{
      fontSize:   FONT_SIZE.XS,
      fontWeight: focused ? FONT_WEIGHT.BOLD : FONT_WEIGHT.MEDIUM,
      color,
      marginTop:  2,
    }}>
      {t?.tabs?.[route.name.toLowerCase()] ?? TAB_LABELS[route.name.toLowerCase()] ?? route.name}
    </Text>
  ),
  tabBarIcon: ({ color, size, focused }: { color: string; size: number; focused: boolean }) => (
    <Text style={{ fontSize: size + (focused ? 2 : 0) }}>
      {TAB_ICONS[route.name.toLowerCase()] || '⚪'}
    </Text>
  ),
  headerShown: false,
  // Hide the entire tab bar on desktop — navigation is via DesktopSidebar
  tabBarStyle: isDesktop ? { display: 'none' as const } : COMPONENT.TAB_BAR,
});

// ─── Desktop sidebar nav items per role ──────────────────────────────────────

const OWNER_ITEMS = [
  { name: 'home',      icon: '🏠', label: 'Home' },
  { name: 'items',     icon: '📦', label: 'Inventory' },
  { name: 'billing',   icon: '🧾', label: 'Billing' },
  { name: 'purchases', icon: '🛒', label: 'Purchases' },
  { name: 'customers', icon: '👥', label: 'Customers' },
  { name: 'dashboard', icon: '📊', label: 'Dashboard' },
];
const CASHIER_ITEMS = [
  { name: 'home',      icon: '🏠', label: 'Home' },
  { name: 'items',     icon: '📦', label: 'Inventory' },
  { name: 'billing',   icon: '🧾', label: 'Billing' },
  { name: 'customers', icon: '👥', label: 'Customers' },
];
const STOCK_ITEMS = [
  { name: 'home',      icon: '🏠', label: 'Home' },
  { name: 'items',     icon: '📦', label: 'Inventory' },
  { name: 'purchases', icon: '🛒', label: 'Purchases' },
  { name: 'customers', icon: '👥', label: 'Customers' },
];
const ACCOUNTANT_ITEMS = [
  { name: 'dashboard', icon: '📊', label: 'Dashboard' },
  { name: 'items',     icon: '📦', label: 'Inventory' },
  { name: 'customers', icon: '👥', label: 'Customers' },
  { name: 'reports',   icon: '📈', label: 'Reports' },
];

function sidebarItemsForRole(role: string) {
  switch (role) {
    case ROLES.OWNER:         return OWNER_ITEMS;
    case ROLES.CASHIER:       return CASHIER_ITEMS;
    case ROLES.STOCK_MANAGER: return STOCK_ITEMS;
    case ROLES.ACCOUNTANT:    return ACCOUNTANT_ITEMS;
    default:                  return CASHIER_ITEMS;
  }
}

// ─── Tab Navigators (unchanged logic, desktop hides tab bar via style) ────────

const OwnerTabs = ({ role, lang, isDesktop }: { role: string; lang: Language; isDesktop: boolean }) => {
  const t = TRANSLATIONS[lang] || TRANSLATIONS.en;
  return (
    <Tab.Navigator screenOptions={makeTabOptions(t, isDesktop)}>
      <Tab.Screen name="home">{(props) => <HomeScreen {...props} role={role} lang={lang} />}</Tab.Screen>
      <Tab.Screen name="items"     component={InventoryScreen} />
      <Tab.Screen name="billing"   component={BillingScreen} />
      <Tab.Screen name="purchases" component={PurchasesListScreen} />
      <Tab.Screen name="customers" component={CustomersScreen} />
      <Tab.Screen name="dashboard" component={OwnerDashboard} />
    </Tab.Navigator>
  );
};

const CashierTabs = ({ role, lang, isDesktop }: { role: string; lang: Language; isDesktop: boolean }) => {
  const t = TRANSLATIONS[lang] || TRANSLATIONS.en;
  return (
    <Tab.Navigator screenOptions={makeTabOptions(t, isDesktop)}>
      <Tab.Screen name="home">{(props) => <HomeScreen {...props} role={role} lang={lang} />}</Tab.Screen>
      <Tab.Screen name="items"     component={InventoryScreen} />
      <Tab.Screen name="billing"   component={BillingScreen} />
      <Tab.Screen name="customers" component={CustomersScreen} />
    </Tab.Navigator>
  );
};

const StockTabs = ({ role, lang, isDesktop }: { role: string; lang: Language; isDesktop: boolean }) => {
  const t = TRANSLATIONS[lang] || TRANSLATIONS.en;
  return (
    <Tab.Navigator screenOptions={makeTabOptions(t, isDesktop)}>
      <Tab.Screen name="home">{(props) => <HomeScreen {...props} role={role} lang={lang} />}</Tab.Screen>
      <Tab.Screen name="items"     component={InventoryScreen} />
      <Tab.Screen name="purchases" component={PurchasesListScreen} />
      <Tab.Screen name="customers" component={CustomersScreen} />
    </Tab.Navigator>
  );
};

const AccountantTabs = ({ role, lang, isDesktop }: { role: string; lang: Language; isDesktop: boolean }) => {
  const t = TRANSLATIONS[lang] || TRANSLATIONS.en;
  return (
    <Tab.Navigator screenOptions={makeTabOptions(t, isDesktop)}>
      <Tab.Screen name="dashboard" component={AccountantDashboard} />
      <Tab.Screen name="items"     component={InventoryScreen} />
      <Tab.Screen name="customers" component={CustomersScreen} />
      <Tab.Screen name="reports"   component={ReportsScreen} />
    </Tab.Navigator>
  );
};

// ─── Wrapper: sidebar + tab content on desktop ────────────────────────────────

const TabNavigator = ({ role, lang }: { role: string; lang: Language }) => {
  const isDesktop = useIsDesktop();

  const tabContent = (() => {
    switch (role) {
      case ROLES.OWNER:         return <OwnerTabs     role={role} lang={lang} isDesktop={isDesktop} />;
      case ROLES.CASHIER:       return <CashierTabs   role={role} lang={lang} isDesktop={isDesktop} />;
      case ROLES.STOCK_MANAGER: return <StockTabs     role={role} lang={lang} isDesktop={isDesktop} />;
      case ROLES.ACCOUNTANT:    return <AccountantTabs role={role} lang={lang} isDesktop={isDesktop} />;
      default:                  return <CashierTabs   role={role} lang={lang} isDesktop={isDesktop} />;
    }
  })();

  if (!isDesktop) return tabContent;

  // Desktop layout: sidebar left + content right
  return (
    <View style={styles.desktopContainer}>
      <DesktopSidebar items={sidebarItemsForRole(role)} />
      <View style={styles.desktopContent}>
        {tabContent}
      </View>
    </View>
  );
};

// ─── App Navigator ────────────────────────────────────────────────────────────

const AppNavigator = ({ role, lang, onLogout }: { role: string; lang: Language; onLogout?: () => void }) => (
  <NavigationContainer>
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs">
        {() => <TabNavigator role={role} lang={lang} />}
      </Stack.Screen>
      <Stack.Screen name="Bills"          component={BillsHistoryScreen}   options={{ headerShown: true,  title: 'Bills History' }} />
      <Stack.Screen name="ScanScreen"     component={ScanScreen}            options={{ headerShown: true,  title: 'Scan' }} />
      <Stack.Screen name="SlipProcessing" component={SlipProcessingScreen}  options={{ headerShown: true,  title: 'Slips' }} />
      <Stack.Screen name="NewPurchase"    component={NewPurchaseScreen}     options={{ headerShown: false }} />
      <Stack.Screen name="PurchaseDetail" component={PurchaseDetailScreen}  options={{ headerShown: false }} />
      <Stack.Screen name="SuppliersList"  component={SuppliersListScreen}   options={{ headerShown: false }} />
      <Stack.Screen name="StaffPins"      component={StaffPinsScreen}       options={{ headerShown: false }} />
    </Stack.Navigator>
  </NavigationContainer>
);

const styles = StyleSheet.create({
  desktopContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: COLORS.BACKGROUND,
  },
  desktopContent: {
    flex: 1,
    overflow: 'hidden',
  },
});

export default AppNavigator;
