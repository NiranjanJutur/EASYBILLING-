import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, Text, TextInput, Switch, TouchableOpacity, Alert } from 'react-native';
import type { StoreSettings } from '../../models/Settings';
import type { PaymentMethod } from '../../models/Payment';
import { settingsService } from '../../services/settings/settingsService';

const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'upi', 'card', 'check', 'credit'];
const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  upi: 'UPI',
  card: 'Card',
  check: 'Cheque',
  credit: 'Udhaar (Credit)',
};

export function SettingsScreen() {
  const [settings, setSettings] = useState<StoreSettings>({
    storeName: 'Demo Store',
    phone: '9876543210',
    address: '',
    paymentConfig: {
      methods: ['cash', 'upi'],
      defaultMethod: 'cash',
      gst: 5,
      currency: 'INR',
    },
    creditDays: 30,
    lowStockThreshold: 10,
    stockAlertEnabled: true,
    voiceCommandEnabled: false,
    ocrEnabled: false,
    whatsappEnabled: false,
    currency: 'INR',
    timezone: 'Asia/Kolkata',
    updatedAt: Date.now(),
  });

  const [activeTab, setActiveTab] = useState<'store' | 'payment' | 'features' | 'notifications'>('store');

  const handleSave = () => {
    const validation = settingsService.validateStoreSettings(settings);
    if (!validation.isValid) {
      Alert.alert('Validation Error', validation.errors.join('\
'));
      return;
    }
    const updated = settingsService.updateStoreSettings(settings, settings);
    Alert.alert('Success', 'Settings saved successfully');
    setSettings(updated);
  };

  const togglePaymentMethod = (method: PaymentMethod) => {
    const currentMethods = settings.paymentConfig.methods;
    const newMethods = currentMethods.includes(method)
      ? currentMethods.filter(m => m !== method)
      : [...currentMethods, method];

    setSettings(prev => ({
      ...prev,
      paymentConfig: {
        ...prev.paymentConfig,
        methods: newMethods,
        defaultMethod: newMethods.includes(prev.paymentConfig.defaultMethod)
          ? prev.paymentConfig.defaultMethod
          : newMethods[0] || 'cash',
      },
    }));
  };

  return (
    <View style={styles.container}>
      {/* Tabs */}
      <View style={styles.tabsContainer}>
        {(['store', 'payment', 'features', 'notifications'] as const).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabLabel, activeTab === tab && styles.activeTabLabel]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.content}>
        {activeTab === 'store' && (
          <View>
            <Text style={styles.sectionTitle}>Store Information</Text>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Store Name</Text>
              <TextInput
                style={styles.input}
                value={settings.storeName}
                onChangeText={name => setSettings(prev => ({ ...prev, storeName: name }))}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Phone Number</Text>
              <TextInput
                style={styles.input}
                value={settings.phone}
                onChangeText={phone => setSettings(prev => ({ ...prev, phone }))}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Address</Text>
              <TextInput
                style={[styles.input, { height: 80 }]}
                value={settings.address}
                onChangeText={address => setSettings(prev => ({ ...prev, address }))}
                multiline
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>GST Number</Text>
              <TextInput
                style={styles.input}
                value={settings.gstNumber || ''}
                onChangeText={gstNumber => setSettings(prev => ({ ...prev, gstNumber }))}
                placeholder="29ABCXY1234H1Z0"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Credit Days (Default)</Text>
              <TextInput
                style={styles.input}
                value={settings.creditDays.toString()}
                onChangeText={creditDays =>
                  setSettings(prev => ({
                    ...prev,
                    creditDays: parseInt(creditDays) || 30,
                  }))
                }
                keyboardType="number-pad"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Low Stock Threshold</Text>
              <TextInput
                style={styles.input}
                value={settings.lowStockThreshold.toString()}
                onChangeText={threshold =>
                  setSettings(prev => ({
                    ...prev,
                    lowStockThreshold: parseInt(threshold) || 10,
                  }))
                }
                keyboardType="number-pad"
              />
            </View>
          </View>
        )}

        {activeTab === 'payment' && (
          <View>
            <Text style={styles.sectionTitle}>Payment Methods</Text>
            <View style={styles.formGroup}>
              <Text style={styles.label}>GST Rate (%)</Text>
              <TextInput
                style={styles.input}
                value={settings.paymentConfig.gst.toString()}
                onChangeText={gst =>
                  setSettings(prev => ({
                    ...prev,
                    paymentConfig: {
                      ...prev.paymentConfig,
                      gst: parseInt(gst) || 5,
                    },
                  }))
                }
                keyboardType="number-pad"
              />
            </View>

            <Text style={styles.label}>Enabled Methods</Text>
            {PAYMENT_METHODS.map(method => (
              <View key={method} style={styles.methodRow}>
                <Text style={styles.methodLabel}>{PAYMENT_LABELS[method]}</Text>
                <Switch
                  value={settings.paymentConfig.methods.includes(method)}
                  onValueChange={() => togglePaymentMethod(method)}
                />
              </View>
            ))}
          </View>
        )}

        {activeTab === 'features' && (
          <View>
            <Text style={styles.sectionTitle}>Feature Toggles</Text>

            <View style={styles.featureRow}>
              <View>
                <Text style={styles.featureName}>Voice Commands</Text>
                <Text style={styles.featureDesc}>Enable hands-free voice commands</Text>
              </View>
              <Switch
                value={settings.voiceCommandEnabled}
                onValueChange={enabled =>
                  setSettings(prev => ({ ...prev, voiceCommandEnabled: enabled }))
                }
              />
            </View>

            <View style={styles.featureRow}>
              <View>
                <Text style={styles.featureName}>Handwritten OCR</Text>
                <Text style={styles.featureDesc}>Process handwritten slips with AI</Text>
              </View>
              <Switch
                value={settings.ocrEnabled}
                onValueChange={enabled => setSettings(prev => ({ ...prev, ocrEnabled: enabled }))}
              />
            </View>

            <View style={styles.featureRow}>
              <View>
                <Text style={styles.featureName}>WhatsApp Integration</Text>
                <Text style={styles.featureDesc}>Send bills & messages via WhatsApp</Text>
              </View>
              <Switch
                value={settings.whatsappEnabled}
                onValueChange={enabled => setSettings(prev => ({ ...prev, whatsappEnabled: enabled }))}
              />
            </View>

            <View style={styles.featureRow}>
              <View>
                <Text style={styles.featureName}>Stock Alerts</Text>
                <Text style={styles.featureDesc}>Get notified on low stock</Text>
              </View>
              <Switch
                value={settings.stockAlertEnabled}
                onValueChange={enabled => setSettings(prev => ({ ...prev, stockAlertEnabled: enabled }))}
              />
            </View>
          </View>
        )}

        {activeTab === 'notifications' && (
          <View>
            <Text style={styles.sectionTitle}>WhatsApp Integration</Text>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Business Phone Number</Text>
              <TextInput
                style={styles.input}
                value={settings.whatsappBusinessNumber || ''}
                onChangeText={phone => setSettings(prev => ({ ...prev, whatsappBusinessNumber: phone }))}
                placeholder="Country code + number"
              />
            </View>
            <Text style={styles.hint}>
              Set up WhatsApp Business Account and add your phone number. Enable WhatsApp Integration in Features tab to use.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Save Button */}
      <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveButtonText}>Save Settings</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#2196F3',
  },
  tabLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  activeTabLabel: {
    color: '#2196F3',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
    color: '#333',
  },
  formGroup: {
    marginBottom: 16,
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#f9f9f9',
  },
  methodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    marginBottom: 8,
    borderRadius: 6,
  },
  methodLabel: {
    fontSize: 14,
    color: '#333',
  },
  featureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    marginBottom: 8,
    borderRadius: 6,
  },
  featureName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  featureDesc: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  hint: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
    padding: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 14,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

