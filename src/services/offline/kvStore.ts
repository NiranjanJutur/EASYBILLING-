/**
 * kvStore.ts — device storage for offline data (Android / iOS: AsyncStorage).
 * The web build uses kvStore.web.ts (localStorage).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export const kvStore = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await AsyncStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  },
  async set(key: string, value: unknown): Promise<void> {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('[kvStore] could not save', key, e);
    }
  },
  async remove(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch { /* ignore */ }
  },
};
