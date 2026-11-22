/**
 * useIsDesktop.ts — Responsive breakpoint hook.
 *
 * Uses React Native's useWindowDimensions (not window.innerWidth) so it
 * works correctly on both Android and web without platform checks.
 */

import { useWindowDimensions } from 'react-native';

const DESKTOP_BREAKPOINT = 768;

export function useIsDesktop(): boolean {
  const { width } = useWindowDimensions();
  return width >= DESKTOP_BREAKPOINT;
}
