export const ROLES = {
  OWNER: 'OWNER',
  CASHIER: 'CASHIER',
  STOCK_MANAGER: 'STOCK_MANAGER',
  ACCOUNTANT: 'ACCOUNTANT',
};

// Store information
export const STORE_INFO = {
  name: 'Demo Store',
  gstin: '29ABCDE1234F1Z5',
  phone: '+91 90000 00000',
  email: 'hello@example.com',
  address: '123 Market Road, Bengaluru, Karnataka 560001, India',
  pincode: '560001',
  upiId: 'demostore@upi',
};

// PIN Login: Map PINs to roles
// Each role has a unique PIN. Change these to actual year-of-birth values.
export const PIN_MAP: Record<string, { role: string; name: string }> = {
  '1990': { role: 'OWNER', name: 'Owner' },
  '2001': { role: 'CASHIER', name: 'Cashier' },
  '1985': { role: 'STOCK_MANAGER', name: 'Stock Manager' },
  '1995': { role: 'ACCOUNTANT', name: 'Accountant' },
};

// Security: Brute-force protection
export const AUTH_SECURITY = {
  MAX_PIN_ATTEMPTS: 5,             // Lock after 5 failed attempts
  LOCKOUT_DURATION_MS: 5 * 60 * 1000,  // 5 minute lockout
  SESSION_TIMEOUT_MS: 30 * 60 * 1000,  // Auto-logout after 30 minutes of inactivity
};

export const CUSTOMER_TYPES = {
  HOUSE_FAMILY: {
    label: 'House / Family',
    pricing: 1.0,
    creditLimit: 2000,
    icon: '🏠',
  },
  SMALL_RETAILER: {
    label: 'Small Shop / Retailer',
    pricing: 0.9,
    creditLimit: 5000,
    icon: '🏪',
  },
  HOTEL_RESTAURANT: {
    label: 'Hotel / Restaurant',
    pricing: 0.88,
    creditLimit: 10000,
    icon: '🍽️',
  },
  FUNCTION_EVENT: {
    label: 'Function / Event',
    pricing: 0.92,
    creditLimit: 15000,
    icon: '🎉',
  },
  WHOLESALE_BUYER: {
    label: 'Wholesale Buyer',
    pricing: 0.8,
    creditLimit: 25000,
    icon: '📦',
  },
  VIP_REGULAR: {
    label: 'Regular VIP',
    pricing: 1.0,
    creditLimit: 5000,
    icon: '⭐',
  },
};

export const GST_SLABS = [0, 5, 12, 18, 28];

export const PAYMENT_MODES = {
  CASH: 'CASH',
  UPI: 'UPI',
  CARD: 'CARD',
  UDHAAR: 'UDHAAR',
};
