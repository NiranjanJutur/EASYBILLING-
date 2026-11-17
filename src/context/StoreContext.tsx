/**
 * StoreContext.tsx — Multi-store context for ShopLedger.
 * 
 * Each store has its own isolated data in the same Supabase database,
 * separated by a `store_id` column. The active store is persisted
 * in localStorage so users return to their last-used store.
 */

import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

// ── Store Configuration ──────────────────────────────────────────────────────

export interface StoreConfig {
  id: string;           // unique key used as store_id in DB
  name: string;         // display name
  nameKn?: string;      // Kannada display name
  icon: string;         // emoji icon
  gstin: string;
  phone: string;
  email: string;
  address: string;
  pincode: string;
  color: string;        // theme accent color
  upiId?: string;       // store's UPI VPA for QR code payments
}

export const STORES: StoreConfig[] = [
  {
    id: 'sms',
    name: 'Demo Store',
    nameKn: 'ಡೆಮೊ ಅಂಗಡಿ',
    icon: '🏪',
    gstin: '29ABCDE1234F1Z5',
    phone: '+91 90000 00000',
    email: 'hello@example.com',
    address: '123 Market Road, Bengaluru, Karnataka 560001, India',
    pincode: '560001',
    color: '#2E7D32',
    upiId: 'demostore@upi',
  },
  {
    id: 'sample',
    name: 'Sample Store',
    nameKn: 'ಮಾದರಿ ಅಂಗಡಿ',
    icon: '🏬',
    gstin: '27ABCDE1234F1Z5',
    phone: '+91 90000 00001',
    email: 'sample@example.com',
    address: '45 Central Road, Mumbai, Maharashtra 400001, India',
    pincode: '400001',
    color: '#C62828',
  },
];

// ── Context ──────────────────────────────────────────────────────────────────

interface StoreContextValue {
  activeStore: StoreConfig;
  setActiveStore: (store: StoreConfig) => void;
  stores: StoreConfig[];
}

const StoreContext = createContext<StoreContextValue>({
  activeStore: STORES[0],
  setActiveStore: () => {},
  stores: STORES,
});

export const useStore = () => useContext(StoreContext);

// ── Provider ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'sms_active_store_id';

export const StoreProvider = ({ children }: { children: ReactNode }) => {
  const [activeStore, setActiveStoreState] = useState<StoreConfig>(() => {
    // Restore from localStorage
    try {
      const savedId = localStorage.getItem(STORAGE_KEY);
      if (savedId) {
        const found = STORES.find(s => s.id === savedId);
        if (found) return found;
      }
    } catch {}
    return STORES[0];
  });

  const setActiveStore = (store: StoreConfig) => {
    setActiveStoreState(store);
    try {
      localStorage.setItem(STORAGE_KEY, store.id);
    } catch {}
  };

  return (
    <StoreContext.Provider value={{ activeStore, setActiveStore, stores: STORES }}>
      {children}
    </StoreContext.Provider>
  );
};

export default StoreContext;
