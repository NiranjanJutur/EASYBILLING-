/**
 * registrationService.ts — Save/load/check shop registration data.
 * Uses kvStore (AsyncStorage on native, localStorage on web).
 */
import { kvStore } from '../offline/kvStore';
import { sha256 } from '../../utils/ids';
import type { RegistrationData, PartialRegistration, StaffMember } from '../../models/Registration';
import type { StaffRole } from '../../models/Staff';
import type { Language } from '../../utils/i18n';

const REG_KEY = 'sms_registration';
const APP_VERSION = '1.3.0';

// ── PIN hashing ──────────────────────────────────────────────────────────────

/** Hash a PIN for safe storage. Never store raw PINs. */
export const hashPin = (pin: string): string => sha256(`sms-reg-v1|${pin}`);

/** Check if a PIN is too simple (1234, 0000, 1111, sequential, years) */
export const isWeakPin = (pin: string): boolean => {
  if (pin.length !== 4) return true;
  // All same digit: 0000, 1111, ...
  if (/^(\d)\1{3}$/.test(pin)) return true;
  // Sequential ascending: 1234, 2345, ...
  const digits = pin.split('').map(Number);
  const isAscending = digits.every((d, i) => i === 0 || d === digits[i - 1] + 1);
  const isDescending = digits.every((d, i) => i === 0 || d === digits[i - 1] - 1);
  if (isAscending || isDescending) return true;
  // Common years (19xx, 20xx)
  const num = parseInt(pin, 10);
  if (num >= 1900 && num <= 2099) return true;
  // Common patterns
  const weak = ['1234', '4321', '1111', '0000', '1122', '1212', '6969', '0007'];
  if (weak.includes(pin)) return true;
  return false;
};

// ── CRUD ─────────────────────────────────────────────────────────────────────

/** Save registration data */
export const saveRegistration = async (data: RegistrationData): Promise<void> => {
  await kvStore.set(REG_KEY, data);
};

/** Load registration data (null if not registered) */
export const getRegistration = async (): Promise<RegistrationData | null> => {
  return kvStore.get<RegistrationData>(REG_KEY);
};

/** Has registration been completed? */
export const isRegistered = async (): Promise<boolean> => {
  const data = await getRegistration();
  return data !== null && !!data.shopName && !!data.ownerPinHash;
};

/** Clear registration (for dev/testing) */
export const clearRegistration = async (): Promise<void> => {
  await kvStore.remove(REG_KEY);
};

/** Build a full RegistrationData from wizard partial data */
export const buildRegistration = (partial: PartialRegistration): RegistrationData => {
  if (!partial.shopName || !partial.ownerName || !partial.phone || !partial.state || !partial.stateCode || !partial.ownerPin) {
    throw new Error('Missing required fields');
  }
  return {
    shopName: partial.shopName.trim(),
    ownerName: partial.ownerName.trim(),
    phone: partial.phone.trim(),
    address: (partial.address || '').trim(),
    city: (partial.city || '').trim(),
    state: partial.state,
    stateCode: partial.stateCode,
    language: partial.language || 'en',
    ownerPinHash: hashPin(partial.ownerPin),
    gstRegistered: partial.gstRegistered || false,
    gstin: partial.gstin?.trim(),
    gstScheme: partial.gstScheme,
    upiId: partial.upiId?.trim() || undefined,
    registeredAt: new Date().toISOString(),
    appVersion: APP_VERSION,
  };
};

/** After registration, seed the owner PIN into localDataCore's staff_pins */
export const seedOwnerPin = async (
  storeId: string,
  ownerName: string,
  ownerPin: string,
  staffList?: Array<{ name: string; role: StaffRole; pin: string }>
): Promise<void> => {
  const pinKey = `sms_local:${storeId}:staff_pins`;
  const ownerHash = sha256(`sms-local-v1|${storeId}|OWNER|${ownerPin}`);
  const records: Array<{ id: string; name: string; role: StaffRole; hash: string }> = [
    { id: 'local-owner', name: ownerName, role: 'OWNER', hash: ownerHash },
  ];

  if (staffList && staffList.length > 0) {
    for (const s of staffList) {
      records.push({
        id: `local-${s.role.toLowerCase()}`,
        name: s.name,
        role: s.role,
        hash: sha256(`sms-local-v1|${storeId}|${s.role}|${s.pin}`),
      });
    }
  } else {
    // Keep 4-digit default staff PINs for other roles so staff logins work
    const defaults: Array<{ role: StaffRole; name: string; pin: string }> = [
      { role: 'CASHIER', name: 'Cashier', pin: '2001' },
      { role: 'STOCK_MANAGER', name: 'Stock Manager', pin: '1985' },
      { role: 'ACCOUNTANT', name: 'Accountant', pin: '1995' },
    ];
    for (const d of defaults) {
      records.push({
        id: `local-${d.role.toLowerCase()}`,
        name: d.name,
        role: d.role,
        hash: sha256(`sms-local-v1|${storeId}|${d.role}|${d.pin}`),
      });
    }
  }

  await kvStore.set(pinKey, records);
};

/** Validate owner PIN against saved registration */
export const verifyOwnerPin = async (pin: string): Promise<boolean> => {
  const data = await getRegistration();
  if (!data) return false;
  return data.ownerPinHash === hashPin(pin);
};
