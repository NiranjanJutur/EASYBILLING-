/**
 * Registration.ts — TypeScript interfaces for shop registration data.
 * Stored locally in AsyncStorage / localStorage on first launch.
 */
import type { StaffRole } from './Staff';
import type { Language } from '../utils/i18n';

/** GST scheme type — determines invoice title */
export type GSTScheme = 'regular' | 'composition';

/** A staff member created during registration */
export interface StaffMember {
  id: string;
  name: string;
  role: StaffRole;
  pinHash: string; // SHA-256 hash, never store raw PINs
}

/** Complete registration data saved on first launch */
export interface RegistrationData {
  // ── Required ──
  shopName: string;
  ownerName: string;
  phone: string;           // 10 digits
  address: string;
  city: string;
  state: string;           // Full state name
  stateCode: string;       // 2-digit GST state code
  language: Language;
  ownerPinHash: string;    // SHA-256 of owner's 4-digit PIN

  // ── GST (optional) ──
  gstRegistered: boolean;
  gstin?: string;          // 15 characters if GST registered
  gstScheme?: GSTScheme;   // 'regular' or 'composition'

  // ── Optional (can fill later in Settings) ──
  upiId?: string;          // e.g. 'shop@upi'
  invoicePrefix?: string;  // e.g. 'SMS/26-27/'
  invoiceStartNo?: number; // Starting invoice number
  fyStartMonth?: number;   // Financial year start month (default April = 4)
  storeLogo?: string;      // base64 or local URI
  invoiceFooter?: string;  // Custom message on invoices
  fssaiNo?: string;        // FSSAI license for food shops
  staff?: StaffMember[];   // Additional staff (cashier, stock manager, etc.)
  bankName?: string;
  bankAccountNo?: string;
  bankIfsc?: string;

  // ── Meta ──
  registeredAt: string;    // ISO timestamp
  appVersion: string;
}

/** Partial registration — used while stepping through the wizard */
export interface PartialRegistration {
  shopName?: string;
  ownerName?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  stateCode?: string;
  language?: Language;
  gstRegistered?: boolean;
  gstin?: string;
  gstScheme?: GSTScheme;
  ownerPin?: string;       // Raw PIN, only held in memory during registration
  upiId?: string;
}
