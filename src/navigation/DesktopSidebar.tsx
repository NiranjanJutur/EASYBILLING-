/**
 * DesktopSidebar.tsx — Left navigation sidebar shown on screens ≥ 768px.
 *
 * Replaces the bottom tab bar on desktop/tablet without touching the
 * mobile layout. Navigation is driven by the React Navigation tab state
 * so all existing routes, back-stacks, and deep-links continue to work.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useNavigationState, useNavigation, NavigationProp } from '@react-navigation/native';
import { COLORS, SPACING, RADIUS, FONT_SIZE, FONT_WEIGHT, SHADOW } from '../config/theme';
import { useSession } from '../context/SessionContext';
import { useStore } from '../context/StoreContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface NavItem {
  name: string;
  icon: string;
  label: string;
}

interface DesktopSidebarProps {
  items: NavItem[];
  onLogout?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

const DesktopSidebar: React.FC<DesktopSidebarProps> = ({ items, onLogout }) => {
  const navigation = useNavigation<NavigationProp<any>>();
  const { activeStore } = useStore();
  const { staff, logout } = useSession();

  // Get current route name from tab navigator state
  const activeRoute = useNavigationState(state => {
    // The tab navigator is at index 0 of the stack (MainTabs screen)
    const tabState = state?.routes?.[state.index]?.state;
    if (!tabState) return '';
    const idx = tabState.index ?? 0;
    return (tabState.routes?.[idx] as any)?.name ?? '';
  });

  const handleLogout = () => {
    if (onLogout) onLogout();
    else logout?.();
  };

  return (
    <View style={styles.sidebar}>
      {/* Store header */}
      <View style={styles.storeHeader}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoText}>
            {(activeStore?.name ?? 'S').charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.storeInfo}>
          <Text style={styles.storeName} numberOfLines={1}>
            {activeStore?.name ?? 'ShopLedger'}
          </Text>
          <Text style={styles.storeRole} numberOfLines={1}>
            {staff?.name ?? 'Owner'} · {staff?.role ?? ''}
          </Text>
        </View>
      </View>

      <View style={styles.divider} />

      {/* Navigation items */}
      <ScrollView style={styles.navList} showsVerticalScrollIndicator={false}>
        {items.map(item => {
          const isActive = activeRoute.toLowerCase() === item.name.toLowerCase();
          return (
            <TouchableOpacity
              key={item.name}
              style={[styles.navItem, isActive && styles.navItemActive]}
              onPress={() => navigation.navigate('MainTabs', { screen: item.name })}
              activeOpacity={0.75}
            >
              <Text style={[styles.navIcon, isActive && styles.navIconActive]}>
                {item.icon}
              </Text>
              <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
                {item.label}
              </Text>
              {isActive && <View style={styles.activeIndicator} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Logout at bottom */}
      <View style={styles.divider} />
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
        <Text style={styles.logoutIcon}>🚪</Text>
        <Text style={styles.logoutText}>Log out</Text>
      </TouchableOpacity>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  sidebar: {
    width: 220,
    backgroundColor: COLORS.WHITE,
    borderRightWidth: 1,
    borderRightColor: COLORS.BORDER,
    flexDirection: 'column',
    ...SHADOW.MEDIUM,
    // Clip the shadow to right side only
    shadowOffset: { width: 2, height: 0 },
  },
  storeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.LG,
    gap: SPACING.SM,
  },
  logoCircle: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.FULL,
    backgroundColor: COLORS.PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  logoText: {
    color: COLORS.WHITE,
    fontSize: FONT_SIZE.LG,
    fontWeight: FONT_WEIGHT.BLACK,
  },
  storeInfo: {
    flex: 1,
    overflow: 'hidden',
  },
  storeName: {
    fontSize: FONT_SIZE.SM,
    fontWeight: FONT_WEIGHT.BOLD,
    color: COLORS.TEXT_HEADING,
  },
  storeRole: {
    fontSize: FONT_SIZE.XS,
    color: COLORS.TEXT_DIM,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.BORDER,
    marginHorizontal: SPACING.MD,
  },
  navList: {
    flex: 1,
    paddingVertical: SPACING.SM,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.LG,
    paddingVertical: SPACING.MD,
    marginHorizontal: SPACING.SM,
    borderRadius: RADIUS.MD,
    gap: SPACING.MD,
    position: 'relative',
  },
  navItemActive: {
    backgroundColor: COLORS.PRIMARY_BG,
  },
  navIcon: {
    fontSize: 18,
  },
  navIconActive: {
    // emoji colors are native — just rely on the background highlight
  },
  navLabel: {
    flex: 1,
    fontSize: FONT_SIZE.SM,
    fontWeight: FONT_WEIGHT.MEDIUM,
    color: COLORS.TEXT_BODY,
  },
  navLabelActive: {
    color: COLORS.PRIMARY,
    fontWeight: FONT_WEIGHT.BOLD,
  },
  activeIndicator: {
    position: 'absolute',
    left: 0,
    top: 6,
    bottom: 6,
    width: 3,
    borderRadius: RADIUS.FULL,
    backgroundColor: COLORS.PRIMARY,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.MD,
    padding: SPACING.LG,
    marginBottom: SPACING.SM,
  },
  logoutIcon: {
    fontSize: 18,
  },
  logoutText: {
    fontSize: FONT_SIZE.SM,
    color: COLORS.ERROR,
    fontWeight: FONT_WEIGHT.SEMIBOLD,
  },
});

export default DesktopSidebar;
