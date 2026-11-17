/**
 * kvStore.web.ts — device storage for offline data in the browser (localStorage).
 */
const hasStorage = () => {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
};

export const kvStore = {
  async get<T>(key: string): Promise<T | null> {
    if (!hasStorage()) return null;
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  },
  async set(key: string, value: unknown): Promise<void> {
    if (!hasStorage()) return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('[kvStore] could not save (storage full or blocked)', key, e);
    }
  },
  async remove(key: string): Promise<void> {
    if (!hasStorage()) return;
    try {
      localStorage.removeItem(key);
    } catch { /* ignore */ }
  },
};
