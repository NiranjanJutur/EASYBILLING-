import type { StoreSettings, UserSettings } from '../../models/Settings';
import type { PaymentConfig, PaymentMethod } from '../../models/Payment';

const DEFAULT_PAYMENT_CONFIG: PaymentConfig = {
  methods: ['cash', 'upi'],
  defaultMethod: 'cash',
  gst: 5,
  currency: 'INR',
};

const DEFAULT_STORE_SETTINGS: Partial<StoreSettings> = {
  storeName: 'My Store',
  phone: '',
  address: '',
  paymentConfig: DEFAULT_PAYMENT_CONFIG,
  creditDays: 30,
  lowStockThreshold: 10,
  stockAlertEnabled: true,
  voiceCommandEnabled: false,
  ocrEnabled: false,
  whatsappEnabled: false,
  currency: 'INR',
  timezone: 'Asia/Kolkata',
};

const DEFAULT_USER_SETTINGS: Partial<UserSettings> = {
  theme: 'light',
  language: 'en',
  notifications: {
    email: false,
    whatsapp: false,
    push: false,
  },
};

export const settingsService = {
  /**
   * Initialize store settings
   */
  initializeStoreSettings(partial: Partial<StoreSettings>): StoreSettings {
    return {
      ...DEFAULT_STORE_SETTINGS,
      ...partial,
      updatedAt: Date.now(),
    } as StoreSettings;
  },

  /**
   * Initialize user settings
   */
  initializeUserSettings(
    userId: string,
    partial: Partial<UserSettings>
  ): UserSettings {
    return {
      ...DEFAULT_USER_SETTINGS,
      userId,
      ...partial,
      updatedAt: Date.now(),
    } as UserSettings;
  },

  /**
   * Update store settings
   */
  updateStoreSettings(
    current: StoreSettings,
    updates: Partial<StoreSettings>
  ): StoreSettings {
    return {
      ...current,
      ...updates,
      updatedAt: Date.now(),
    };
  },

  /**
   * Update user settings
   */
  updateUserSettings(
    current: UserSettings,
    updates: Partial<UserSettings>
  ): UserSettings {
    return {
      ...current,
      ...updates,
      updatedAt: Date.now(),
    };
  },

  /**
   * Update payment methods
   */
  updatePaymentMethods(
    config: PaymentConfig,
    methods: PaymentMethod[]
  ): PaymentConfig {
    return {
      ...config,
      methods,
      // Ensure default method is in enabled methods
      defaultMethod: methods.includes(config.defaultMethod)
        ? config.defaultMethod
        : methods[0],
    };
  },

  /**
   * Validate store settings
   */
  validateStoreSettings(settings: Partial<StoreSettings>): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!settings.storeName || settings.storeName.trim() === '') {
      errors.push('Store name is required');
    }

    if (!settings.phone || settings.phone.trim() === '') {
      errors.push('Phone number is required');
    }

    if (settings.gstNumber) {
      if (!/^[A-Z0-9]{15}$/.test(settings.gstNumber)) {
        errors.push('Invalid GST number format');
      }
    }

    if (settings.creditDays && settings.creditDays < 0) {
      errors.push('Credit days cannot be negative');
    }

    if (settings.lowStockThreshold && settings.lowStockThreshold < 0) {
      errors.push('Stock threshold cannot be negative');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  },

  /**
   * Get GST inclusive price
   */
  calculateGST(
    amount: number,
    gstPercent: number
  ): { subtotal: number; gst: number; total: number } {
    const gst = (amount * gstPercent) / 100;
    return {
      subtotal: amount,
      gst,
      total: amount + gst,
    };
  },

  /**
   * Format currency
   */
  formatCurrency(amount: number, currency: string = 'INR'): string {
    if (currency === 'INR') {
      return `₹${amount.toFixed(2)}`;
    }
    return `${currency} ${amount.toFixed(2)}`;
  },

  /**
   * Check if feature is enabled
   */
  isFeatureEnabled(
    settings: StoreSettings,
    feature: 'voice' | 'ocr' | 'whatsapp' | 'stock-alerts'
  ): boolean {
    const featureMap = {
      voice: settings.voiceCommandEnabled,
      ocr: settings.ocrEnabled,
      whatsapp: settings.whatsappEnabled,
      'stock-alerts': settings.stockAlertEnabled,
    };
    return featureMap[feature];
  },
};

