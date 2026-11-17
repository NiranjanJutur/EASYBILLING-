import type { PaymentConfig } from './Payment';
import type { UserRole } from './Role';

export interface StoreSettings {
  storeName: string;
  phone: string;
  email?: string;
  address: string;
  gstNumber?: string;
  logo?: string; // base64
  paymentConfig: PaymentConfig;
  creditDays: number; // default credit days for customers
  lowStockThreshold: number; // quantity
  stockAlertEnabled: boolean;
  voiceCommandEnabled: boolean;
  ocrEnabled: boolean;
  whatsappEnabled: boolean;
  whatsappBusinessNumber?: string;
  currency: string; // INR
  timezone: string;
  updatedAt: number;
}

export interface UserSettings {
  userId: string;
  role: UserRole;
  theme: 'light' | 'dark';
  language: 'en' | 'kn' | 'hi';
  notifications: {
    email: boolean;
    whatsapp: boolean;
    push: boolean;
  };
  updatedAt: number;
}