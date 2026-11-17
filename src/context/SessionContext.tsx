/**
 * SessionContext.tsx — who is logged in on this device.
 *
 * Login checks the PIN in the database (staff_login), which returns the
 * person's name and role. The role is never picked by the user.
 * On web the session survives a page reload (sessionStorage, cleared when
 * the tab closes). On Android it lives in memory until logout / app close.
 */
import React, { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { StaffSession } from '../models/Staff';

const STORAGE_KEY = 'sms_staff_session';

let currentStaff: StaffSession | null = null;

/** For plain service functions that can't use React hooks. */
export const getCurrentStaff = () => currentStaff;

const readSaved = (): StaffSession | null => {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as StaffSession;
    return s && s.id && s.role && s.storeId ? s : null;
  } catch {
    return null;
  }
};

const save = (s: StaffSession | null) => {
  try {
    if (typeof sessionStorage === 'undefined') return;
    if (s) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch { /* storage blocked — session stays in memory */ }
};

interface SessionValue {
  staff: StaffSession | null;
  login: (s: StaffSession) => void;
  logout: () => void;
}

const SessionContext = createContext<SessionValue>({
  staff: null,
  login: () => {},
  logout: () => {},
});

export const useSession = () => useContext(SessionContext);

export const SessionProvider = ({ children, onLogout }: { children: ReactNode; onLogout?: () => void }) => {
  const [staff, setStaff] = useState<StaffSession | null>(() => {
    currentStaff = readSaved();
    return currentStaff;
  });

  const login = useCallback((s: StaffSession) => {
    currentStaff = s;
    save(s);
    setStaff(s);
  }, []);

  const logout = useCallback(() => {
    currentStaff = null;
    save(null);
    setStaff(null);
    onLogout?.();
  }, [onLogout]);

  const value = useMemo(() => ({ staff, login, logout }), [staff, login, logout]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
};
