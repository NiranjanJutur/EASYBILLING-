/**
 * activeStoreId.ts — Global accessor for the current store ID.
 * 
 * React context can't be used inside plain service functions,
 * so this module provides a simple getter/setter that stays in sync
 * with the StoreContext via a useEffect in App.web.tsx.
 */

let _activeStoreId = 'sms';

// Read from localStorage on module load
try {
  const saved = localStorage.getItem('sms_active_store_id');
  if (saved) _activeStoreId = saved;
} catch {}

export function getActiveStoreId(): string {
  return _activeStoreId;
}

export function setActiveStoreId(id: string) {
  _activeStoreId = id;
}
