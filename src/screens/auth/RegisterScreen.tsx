/**
 * RegisterScreen.tsx — First-launch shop registration wizard.
 *
 * 6 steps:
 *   1. Welcome & Language
 *   2. Shop Details
 *   3. GST (skippable)
 *   4. Set Owner PIN (4-digit)
 *   5. UPI ID (skippable)
 *   6. Done → Dashboard
 *
 * Runs once on first launch. Saves everything locally (AsyncStorage / localStorage).
 */
import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Animated, KeyboardAvoidingView, Platform,
} from 'react-native';
import { COLORS, SPACING, RADIUS, FONT_SIZE, FONT_WEIGHT, SHADOW, COMPONENT } from '../../config/theme';
import { Language } from '../../utils/i18n';
import { INDIAN_STATES, isValidGSTIN, getStateCodeFromGSTIN } from '../../config/indianStates';
import type { PartialRegistration, GSTScheme } from '../../models/Registration';
import {
  saveRegistration, buildRegistration, isWeakPin, seedOwnerPin,
} from '../../services/local/registrationService';

// ── Props ────────────────────────────────────────────────────────────────────

interface RegisterScreenProps {
  onComplete: () => void;
}

// ── Languages ────────────────────────────────────────────────────────────────

const LANGUAGES: { key: Language; label: string; native: string }[] = [
  { key: 'en', label: 'English', native: 'English' },
  { key: 'kn', label: 'Kannada', native: 'ಕನ್ನಡ' },
  { key: 'hi', label: 'Hindi', native: 'हिन्दी' },
  { key: 'te', label: 'Telugu', native: 'తెలుగు' },
  { key: 'mr', label: 'Marathi', native: 'मराठी' },
];

// ── i18n for registration ────────────────────────────────────────────────────

const REG_TEXT: Record<string, Record<string, string>> = {
  en: {
    welcome: 'Welcome to EasyBilling',
    subtitle: 'Set up your shop in 2 minutes',
    chooseLang: 'Choose your language',
    getStarted: 'Get Started',
    shopDetails: 'Shop Details',
    shopName: 'Shop Name',
    ownerName: 'Owner Name',
    phone: 'Phone Number',
    address: 'Address',
    city: 'City / Town',
    state: 'State',
    selectState: 'Select State',
    next: 'Next',
    back: 'Back',
    gstTitle: 'GST Registration',
    gstQuestion: 'Are you GST registered?',
    yes: 'Yes',
    no: 'No',
    gstin: 'GSTIN',
    gstinHint: '15-character GST number',
    gstScheme: 'GST Scheme',
    regular: 'Regular',
    composition: 'Composition',
    compositionHint: 'Composition dealers issue "Bill of Supply" instead of "Tax Invoice"',
    skip: 'Skip',
    pinTitle: 'Set Owner PIN',
    pinSubtitle: 'This 4-digit PIN unlocks your shop dashboard',
    enterPin: 'Enter 4-digit PIN',
    confirmPin: 'Confirm PIN',
    pinWeak: 'PIN is too easy to guess. Avoid sequences, repeated digits, or years.',
    pinMismatch: 'PINs do not match',
    upiTitle: 'UPI Payment',
    upiSubtitle: 'Add your UPI ID to show QR code on bills',
    upiId: 'UPI ID',
    upiHint: 'e.g. yourshop@upi',
    doneTitle: '🎉 All Set!',
    doneSubtitle: 'Your shop is ready to bill',
    openDashboard: 'Open Dashboard',
    required: 'This field is required',
    invalidPhone: 'Enter a valid 10-digit phone number',
    invalidGstin: 'Enter a valid 15-character GSTIN',
    gstinStateMismatch: 'GSTIN state code does not match your state',
    step: 'Step',
    of: 'of',
  },
  kn: {
    welcome: 'EasyBilling ಗೆ ಸ್ವಾಗತ',
    subtitle: '2 ನಿಮಿಷದಲ್ಲಿ ನಿಮ್ಮ ಅಂಗಡಿಯನ್ನು ಸೆಟಪ್ ಮಾಡಿ',
    chooseLang: 'ನಿಮ್ಮ ಭಾಷೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ',
    getStarted: 'ಪ್ರಾರಂಭಿಸಿ',
    shopDetails: 'ಅಂಗಡಿ ವಿವರಗಳು',
    shopName: 'ಅಂಗಡಿ ಹೆಸರು',
    ownerName: 'ಮಾಲೀಕರ ಹೆಸರು',
    phone: 'ಫೋನ್ ನಂಬರ್',
    address: 'ವಿಳಾಸ',
    city: 'ನಗರ / ಪಟ್ಟಣ',
    state: 'ರಾಜ್ಯ',
    selectState: 'ರಾಜ್ಯ ಆಯ್ಕೆಮಾಡಿ',
    next: 'ಮುಂದೆ',
    back: 'ಹಿಂದಕ್ಕೆ',
    gstTitle: 'GST ನೋಂದಣಿ',
    gstQuestion: 'ನೀವು GST ನೋಂದಣಿ ಮಾಡಿದ್ದೀರಾ?',
    yes: 'ಹೌದು',
    no: 'ಇಲ್ಲ',
    gstin: 'GSTIN',
    gstinHint: '15-ಅಕ್ಷರಗಳ GST ಸಂಖ್ಯೆ',
    gstScheme: 'GST ಯೋಜನೆ',
    regular: 'ನಿಯಮಿತ',
    composition: 'ಕಂಪೋಸಿಷನ್',
    compositionHint: 'ಕಂಪೋಸಿಷನ್ ವ್ಯಾಪಾರಿಗಳು "ಬಿಲ್ ಆಫ್ ಸಪ್ಲೈ" ನೀಡುತ್ತಾರೆ',
    skip: 'ಬಿಡಿ',
    pinTitle: 'ಮಾಲೀಕ PIN ಹೊಂದಿಸಿ',
    pinSubtitle: 'ಈ 4-ಅಂಕಿ PIN ನಿಮ್ಮ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್ ತೆರೆಯುತ್ತದೆ',
    enterPin: '4-ಅಂಕಿ PIN ನಮೂದಿಸಿ',
    confirmPin: 'PIN ದೃಢೀಕರಿಸಿ',
    pinWeak: 'PIN ಊಹಿಸಲು ತುಂಬಾ ಸುಲಭ',
    pinMismatch: 'PIN ಹೊಂದಿಕೆಯಾಗಿಲ್ಲ',
    upiTitle: 'UPI ಪಾವತಿ',
    upiSubtitle: 'ಬಿಲ್‌ಗಳಲ್ಲಿ QR ಕೋಡ್ ತೋರಿಸಲು ನಿಮ್ಮ UPI ID ಸೇರಿಸಿ',
    upiId: 'UPI ID',
    upiHint: 'ಉದಾ. yourshop@upi',
    doneTitle: '🎉 ಎಲ್ಲಾ ಸಿದ್ಧ!',
    doneSubtitle: 'ನಿಮ್ಮ ಅಂಗಡಿ ಬಿಲ್ ಮಾಡಲು ಸಿದ್ಧವಾಗಿದೆ',
    openDashboard: 'ಡ್ಯಾಶ್‌ಬೋರ್ಡ್ ತೆರೆಯಿರಿ',
    required: 'ಈ ಕ್ಷೇತ್ರ ಅಗತ್ಯ',
    invalidPhone: 'ಸರಿಯಾದ 10-ಅಂಕಿ ಫೋನ್ ನಂಬರ್ ನಮೂದಿಸಿ',
    invalidGstin: 'ಸರಿಯಾದ 15-ಅಕ್ಷರ GSTIN ನಮೂದಿಸಿ',
    gstinStateMismatch: 'GSTIN ರಾಜ್ಯ ಕೋಡ್ ನಿಮ್ಮ ರಾಜ್ಯಕ್ಕೆ ಹೊಂದಿಕೆಯಾಗಿಲ್ಲ',
    step: 'ಹಂತ',
    of: 'ರಲ್ಲಿ',
  },
  hi: {
    welcome: 'EasyBilling में आपका स्वागत है',
    subtitle: '2 मिनट में अपनी दुकान सेटअप करें',
    chooseLang: 'अपनी भाषा चुनें',
    getStarted: 'शुरू करें',
    shopDetails: 'दुकान की जानकारी',
    shopName: 'दुकान का नाम',
    ownerName: 'मालिक का नाम',
    phone: 'फ़ोन नंबर',
    address: 'पता',
    city: 'शहर / कस्बा',
    state: 'राज्य',
    selectState: 'राज्य चुनें',
    next: 'आगे',
    back: 'पीछे',
    gstTitle: 'GST पंजीकरण',
    gstQuestion: 'क्या आप GST पंजीकृत हैं?',
    yes: 'हाँ',
    no: 'नहीं',
    gstin: 'GSTIN',
    gstinHint: '15-अक्षर GST नंबर',
    gstScheme: 'GST योजना',
    regular: 'रेगुलर',
    composition: 'कंपोज़िशन',
    compositionHint: 'कंपोज़िशन डीलर "बिल ऑफ़ सप्लाई" जारी करते हैं',
    skip: 'छोड़ें',
    pinTitle: 'मालिक PIN सेट करें',
    pinSubtitle: 'यह 4-अंकों का PIN आपका डैशबोर्ड खोलेगा',
    enterPin: '4-अंकों का PIN डालें',
    confirmPin: 'PIN की पुष्टि करें',
    pinWeak: 'PIN का अनुमान लगाना बहुत आसान है',
    pinMismatch: 'PIN मेल नहीं खा रहे',
    upiTitle: 'UPI भुगतान',
    upiSubtitle: 'बिल पर QR कोड दिखाने के लिए अपना UPI ID जोड़ें',
    upiId: 'UPI ID',
    upiHint: 'जैसे yourshop@upi',
    doneTitle: '🎉 सब तैयार!',
    doneSubtitle: 'आपकी दुकान बिल बनाने के लिए तैयार है',
    openDashboard: 'डैशबोर्ड खोलें',
    required: 'यह फ़ील्ड आवश्यक है',
    invalidPhone: 'सही 10-अंकों का फ़ोन नंबर डालें',
    invalidGstin: 'सही 15-अक्षर GSTIN डालें',
    gstinStateMismatch: 'GSTIN राज्य कोड आपके राज्य से मेल नहीं खाता',
    step: 'चरण',
    of: 'में से',
  },
  te: {
    welcome: 'EasyBilling కు స్వాగతం',
    subtitle: '2 నిమిషాల్లో మీ షాపును సెటప్ చేయండి',
    chooseLang: 'మీ భాషను ఎంచుకోండి',
    getStarted: 'ప్రారంభించండి',
    shopDetails: 'షాపు వివరాలు',
    shopName: 'షాపు పేరు',
    ownerName: 'యజమాని పేరు',
    phone: 'ఫోన్ నంబర్',
    address: 'చిరునామా',
    city: 'నగరం / పట్టణం',
    state: 'రాష్ట్రం',
    selectState: 'రాష్ట్రం ఎంచుకోండి',
    next: 'తదుపరి',
    back: 'వెనుకకు',
    gstTitle: 'GST నమోదు',
    gstQuestion: 'మీరు GST నమోదు చేసుకున్నారా?',
    yes: 'అవును',
    no: 'లేదు',
    gstin: 'GSTIN',
    gstinHint: '15-అక్షరాల GST నంబర్',
    gstScheme: 'GST పథకం',
    regular: 'రెగ్యులర్',
    composition: 'కంపోజిషన్',
    compositionHint: 'కంపోజిషన్ డీలర్లు "బిల్ ఆఫ్ సప్లై" జారీ చేస్తారు',
    skip: 'దాటవేయి',
    pinTitle: 'యజమాని PIN సెట్ చేయండి',
    pinSubtitle: 'ఈ 4-అంకెల PIN మీ డ్యాష్‌బోర్డ్‌ను తెరుస్తుంది',
    enterPin: '4-అంకెల PIN నమోదు చేయండి',
    confirmPin: 'PIN నిర్ధారించండి',
    pinWeak: 'PIN ఊహించడం చాలా సులభం',
    pinMismatch: 'PINలు సరిపోలడం లేదు',
    upiTitle: 'UPI చెల్లింపు',
    upiSubtitle: 'బిల్లులపై QR కోడ్ చూపించడానికి మీ UPI ID జోడించండి',
    upiId: 'UPI ID',
    upiHint: 'ఉదా. yourshop@upi',
    doneTitle: '🎉 అంతా సిద్ధం!',
    doneSubtitle: 'మీ షాపు బిల్లింగ్‌కు సిద్ధంగా ఉంది',
    openDashboard: 'డ్యాష్‌బోర్డ్ తెరవండి',
    required: 'ఈ ఫీల్డ్ అవసరం',
    invalidPhone: 'సరైన 10-అంకెల ఫోన్ నంబర్ నమోదు చేయండి',
    invalidGstin: 'సరైన 15-అక్షరాల GSTIN నమోదు చేయండి',
    gstinStateMismatch: 'GSTIN రాష్ట్ర కోడ్ మీ రాష్ట్రంతో సరిపోలడం లేదు',
    step: 'దశ',
    of: 'లో',
  },
  mr: {
    welcome: 'EasyBilling मध्ये आपले स्वागत',
    subtitle: '2 मिनिटांत तुमचे दुकान सेटअप करा',
    chooseLang: 'तुमची भाषा निवडा',
    getStarted: 'सुरू करा',
    shopDetails: 'दुकानाची माहिती',
    shopName: 'दुकानाचे नाव',
    ownerName: 'मालकाचे नाव',
    phone: 'फोन नंबर',
    address: 'पत्ता',
    city: 'शहर / गाव',
    state: 'राज्य',
    selectState: 'राज्य निवडा',
    next: 'पुढे',
    back: 'मागे',
    gstTitle: 'GST नोंदणी',
    gstQuestion: 'तुम्ही GST नोंदणीकृत आहात का?',
    yes: 'होय',
    no: 'नाही',
    gstin: 'GSTIN',
    gstinHint: '15-अक्षरी GST क्रमांक',
    gstScheme: 'GST योजना',
    regular: 'रेग्युलर',
    composition: 'कंपोझिशन',
    compositionHint: 'कंपोझिशन विक्रेते "बिल ऑफ सप्लाय" देतात',
    skip: 'वगळा',
    pinTitle: 'मालक PIN सेट करा',
    pinSubtitle: 'हा 4-अंकी PIN तुमचा डॅशबोर्ड उघडेल',
    enterPin: '4-अंकी PIN टाका',
    confirmPin: 'PIN पुष्टी करा',
    pinWeak: 'PIN खूप सोपा आहे',
    pinMismatch: 'PIN जुळत नाहीत',
    upiTitle: 'UPI पेमेंट',
    upiSubtitle: 'बिलांवर QR कोड दाखवण्यासाठी तुमचा UPI ID जोडा',
    upiId: 'UPI ID',
    upiHint: 'उदा. yourshop@upi',
    doneTitle: '🎉 सर्व तयार!',
    doneSubtitle: 'तुमचे दुकान बिल बनवण्यासाठी तयार आहे',
    openDashboard: 'डॅशबोर्ड उघडा',
    required: 'हे फील्ड आवश्यक आहे',
    invalidPhone: 'योग्य 10-अंकी फोन नंबर टाका',
    invalidGstin: 'योग्य 15-अक्षरी GSTIN टाका',
    gstinStateMismatch: 'GSTIN राज्य कोड तुमच्या राज्याशी जुळत नाही',
    step: 'टप्पा',
    of: 'पैकी',
  },
};

const TOTAL_STEPS = 6;

// ── Component ────────────────────────────────────────────────────────────────

const RegisterScreen = ({ onComplete }: RegisterScreenProps) => {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<PartialRegistration>({ language: 'en', gstRegistered: false, gstScheme: 'regular' });
  const [confirmPin, setConfirmPin] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showStates, setShowStates] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const lang = data.language || 'en';
  const t = REG_TEXT[lang] || REG_TEXT.en;

  const update = useCallback((field: keyof PartialRegistration, value: any) => {
    setData(prev => ({ ...prev, [field]: value }));
    setErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
  }, []);

  const animateStep = useCallback((next: number) => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => {
      setStep(next);
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    });
  }, [fadeAnim]);

  const goNext = () => animateStep(step + 1);
  const goBack = () => animateStep(step - 1);

  // ── Validators ───────────────────────────────────────────────

  const validateShopDetails = (): boolean => {
    const e: Record<string, string> = {};
    if (!data.shopName?.trim()) e.shopName = t.required;
    if (!data.ownerName?.trim()) e.ownerName = t.required;
    if (!data.phone?.trim() || !/^\d{10}$/.test(data.phone.trim())) e.phone = t.invalidPhone;
    if (!data.address?.trim()) e.address = t.required;
    if (!data.city?.trim()) e.city = t.required;
    if (!data.state) e.state = t.required;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateGST = (): boolean => {
    if (!data.gstRegistered) return true;
    const e: Record<string, string> = {};
    if (!data.gstin || !isValidGSTIN(data.gstin.toUpperCase())) {
      e.gstin = t.invalidGstin;
    } else if (data.stateCode && getStateCodeFromGSTIN(data.gstin.toUpperCase()) !== data.stateCode) {
      e.gstin = t.gstinStateMismatch;
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validatePin = (): boolean => {
    const e: Record<string, string> = {};
    const pin = data.ownerPin || '';
    if (pin.length !== 4) e.ownerPin = t.enterPin;
    else if (isWeakPin(pin)) e.ownerPin = t.pinWeak;
    if (confirmPin !== pin) e.confirmPin = t.pinMismatch;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Save & Finish ────────────────────────────────────────────

  const handleFinish = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const reg = buildRegistration(data);
      await saveRegistration(reg);
      // Seed the owner PIN into the local staff_pins store
      await seedOwnerPin('sms', data.ownerName!.trim(), data.ownerPin!);
      onComplete();
    } catch (err: any) {
      setErrors({ save: err?.message || 'Could not save' });
    } finally {
      setIsSaving(false);
    }
  };

  // ── Render Helpers ───────────────────────────────────────────

  const renderInput = (
    field: keyof PartialRegistration,
    label: string,
    placeholder?: string,
    opts?: { keyboardType?: string; maxLength?: number; autoCapitalize?: string; secureTextEntry?: boolean }
  ) => (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, errors[field] && styles.inputError]}
        value={(data[field] as string) || ''}
        onChangeText={v => update(field, v)}
        placeholder={placeholder || label}
        placeholderTextColor={COLORS.TEXT_PLACEHOLDER}
        keyboardType={opts?.keyboardType as any || 'default'}
        maxLength={opts?.maxLength}
        autoCapitalize={opts?.autoCapitalize as any || 'sentences'}
        secureTextEntry={opts?.secureTextEntry}
      />
      {errors[field] ? <Text style={styles.errorText}>{errors[field]}</Text> : null}
    </View>
  );

  const renderProgressBar = () => {
    if (step === 1 || step === 6) return null;
    const progress = (step - 1) / (TOTAL_STEPS - 2); // steps 2-5 map to 0.25-1.0
    return (
      <View style={styles.progressContainer}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={styles.progressText}>{t.step} {step - 1} {t.of} 4</Text>
      </View>
    );
  };

  // ── Step 1: Welcome & Language ─────────────────────────────

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <View style={styles.welcomeHeader}>
        <Text style={styles.welcomeIcon}>🛒</Text>
        <Text style={styles.welcomeTitle}>{t.welcome}</Text>
        <Text style={styles.welcomeSubtitle}>{t.subtitle}</Text>
      </View>
      <Text style={styles.sectionTitle}>{t.chooseLang}</Text>
      <View style={styles.langGrid}>
        {LANGUAGES.map(l => (
          <TouchableOpacity
            key={l.key}
            style={[styles.langCard, lang === l.key && styles.langCardActive]}
            onPress={() => update('language', l.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.langNative, lang === l.key && styles.langTextActiveColor]}>{l.native}</Text>
            <Text style={[styles.langEnglish, lang === l.key && styles.langTextActiveColorDim]}>{l.label}</Text>
            {lang === l.key && (
              <View style={styles.langCheck}>
                <Text style={styles.langCheckText}>✓</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity style={styles.primaryBtn} onPress={goNext} activeOpacity={0.8}>
        <Text style={styles.primaryBtnText}>{t.getStarted} →</Text>
      </TouchableOpacity>
    </View>
  );

  // ── Step 2: Shop Details ───────────────────────────────────

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>{t.shopDetails}</Text>
      {renderInput('shopName', t.shopName)}
      {renderInput('ownerName', t.ownerName)}
      {renderInput('phone', t.phone, '9876543210', { keyboardType: 'phone-pad', maxLength: 10 })}
      {renderInput('address', t.address)}
      {renderInput('city', t.city)}

      {/* State picker */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>{t.state}</Text>
        <TouchableOpacity
          style={[styles.input, styles.selectInput, errors.state && styles.inputError]}
          onPress={() => setShowStates(!showStates)}
          activeOpacity={0.7}
        >
          <Text style={data.state ? styles.selectText : styles.selectPlaceholder}>
            {data.state || t.selectState}
          </Text>
          <Text style={styles.selectArrow}>{showStates ? '▲' : '▼'}</Text>
        </TouchableOpacity>
        {errors.state ? <Text style={styles.errorText}>{errors.state}</Text> : null}
        {showStates && (
          <View style={styles.stateList}>
            <ScrollView style={styles.stateScroll} nestedScrollEnabled>
              {INDIAN_STATES.map(s => (
                <TouchableOpacity
                  key={s.code}
                  style={[styles.stateItem, data.stateCode === s.code && styles.stateItemActive]}
                  onPress={() => {
                    update('state', s.name);
                    setData(prev => ({ ...prev, stateCode: s.code }));
                    setShowStates(false);
                  }}
                >
                  <Text style={[styles.stateItemText, data.stateCode === s.code && styles.stateItemTextActive]}>
                    {s.name}
                  </Text>
                  <Text style={styles.stateCode}>{s.code}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>

      <View style={styles.btnRow}>
        <TouchableOpacity style={styles.secondaryBtn} onPress={goBack}><Text style={styles.secondaryBtnText}>{t.back}</Text></TouchableOpacity>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => { if (validateShopDetails()) goNext(); }}><Text style={styles.primaryBtnText}>{t.next} →</Text></TouchableOpacity>
      </View>
    </View>
  );

  // ── Step 3: GST ────────────────────────────────────────────

  const renderStep3 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>{t.gstTitle}</Text>
      <Text style={styles.stepSubtitle}>{t.gstQuestion}</Text>

      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleBtn, data.gstRegistered === true && styles.toggleBtnActive]}
          onPress={() => update('gstRegistered', true)}
        >
          <Text style={[styles.toggleBtnText, data.gstRegistered === true && styles.toggleBtnTextActive]}>{t.yes}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, data.gstRegistered === false && styles.toggleBtnActive]}
          onPress={() => update('gstRegistered', false)}
        >
          <Text style={[styles.toggleBtnText, data.gstRegistered === false && styles.toggleBtnTextActive]}>{t.no}</Text>
        </TouchableOpacity>
      </View>

      {data.gstRegistered && (
        <>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>{t.gstin}</Text>
            <TextInput
              style={[styles.input, errors.gstin && styles.inputError]}
              value={data.gstin || ''}
              onChangeText={v => update('gstin', v.toUpperCase())}
              placeholder={t.gstinHint}
              placeholderTextColor={COLORS.TEXT_PLACEHOLDER}
              maxLength={15}
              autoCapitalize="characters"
            />
            {errors.gstin ? <Text style={styles.errorText}>{errors.gstin}</Text> : null}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>{t.gstScheme}</Text>
            <View style={styles.schemeRow}>
              {(['regular', 'composition'] as GSTScheme[]).map(scheme => (
                <TouchableOpacity
                  key={scheme}
                  style={[styles.schemeBtn, data.gstScheme === scheme && styles.schemeBtnActive]}
                  onPress={() => update('gstScheme', scheme)}
                >
                  <Text style={[styles.schemeBtnText, data.gstScheme === scheme && styles.schemeBtnTextActive]}>
                    {scheme === 'regular' ? t.regular : t.composition}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {data.gstScheme === 'composition' && (
              <Text style={styles.hintText}>{t.compositionHint}</Text>
            )}
          </View>
        </>
      )}

      <View style={styles.btnRow}>
        <TouchableOpacity style={styles.secondaryBtn} onPress={goBack}><Text style={styles.secondaryBtnText}>{t.back}</Text></TouchableOpacity>
        {!data.gstRegistered ? (
          <TouchableOpacity style={styles.primaryBtn} onPress={goNext}><Text style={styles.primaryBtnText}>{t.skip} →</Text></TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.primaryBtn} onPress={() => { if (validateGST()) goNext(); }}><Text style={styles.primaryBtnText}>{t.next} →</Text></TouchableOpacity>
        )}
      </View>
    </View>
  );

  // ── Step 4: PIN ────────────────────────────────────────────

  const renderPinDots = (value: string) => (
    <View style={styles.pinDotsRow}>
      {[0, 1, 2, 3].map(i => (
        <View key={i} style={[styles.pinDot, i < value.length && styles.pinDotFilled]} />
      ))}
    </View>
  );

  const renderStep4 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>{t.pinTitle}</Text>
      <Text style={styles.stepSubtitle}>{t.pinSubtitle}</Text>

      <View style={styles.pinSection}>
        <Text style={styles.pinLabel}>{t.enterPin}</Text>
        {renderPinDots(data.ownerPin || '')}
        <TextInput
          style={styles.pinInput}
          value={data.ownerPin || ''}
          onChangeText={v => update('ownerPin', v.replace(/\D/g, '').slice(0, 4))}
          keyboardType="number-pad"
          inputMode="numeric"
          autoComplete="off"
          textContentType="none"
          secureTextEntry
          maxLength={4}
          autoFocus
        />
        {errors.ownerPin ? <Text style={styles.errorText}>{errors.ownerPin}</Text> : null}
      </View>

      <View style={styles.pinSection}>
        <Text style={styles.pinLabel}>{t.confirmPin}</Text>
        {renderPinDots(confirmPin)}
        <TextInput
          style={styles.pinInput}
          value={confirmPin}
          onChangeText={v => { setConfirmPin(v.replace(/\D/g, '').slice(0, 4)); setErrors(prev => { const n = { ...prev }; delete n.confirmPin; return n; }); }}
          keyboardType="number-pad"
          inputMode="numeric"
          autoComplete="off"
          textContentType="none"
          secureTextEntry
          maxLength={4}
        />
        {errors.confirmPin ? <Text style={styles.errorText}>{errors.confirmPin}</Text> : null}
      </View>

      <View style={styles.btnRow}>
        <TouchableOpacity style={styles.secondaryBtn} onPress={goBack}><Text style={styles.secondaryBtnText}>{t.back}</Text></TouchableOpacity>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => { if (validatePin()) goNext(); }}><Text style={styles.primaryBtnText}>{t.next} →</Text></TouchableOpacity>
      </View>
    </View>
  );

  // ── Step 5: UPI ────────────────────────────────────────────

  const renderStep5 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>{t.upiTitle}</Text>
      <Text style={styles.stepSubtitle}>{t.upiSubtitle}</Text>

      <View style={styles.upiIconRow}>
        <Text style={styles.upiIcon}>💳</Text>
      </View>

      {renderInput('upiId', t.upiId, t.upiHint, { autoCapitalize: 'none' })}

      <View style={styles.btnRow}>
        <TouchableOpacity style={styles.secondaryBtn} onPress={goBack}><Text style={styles.secondaryBtnText}>{t.back}</Text></TouchableOpacity>
        <TouchableOpacity style={styles.primaryBtn} onPress={goNext}><Text style={styles.primaryBtnText}>{data.upiId ? t.next : t.skip} →</Text></TouchableOpacity>
      </View>
    </View>
  );

  // ── Step 6: Done ───────────────────────────────────────────

  const renderStep6 = () => (
    <View style={styles.stepContainer}>
      <View style={styles.doneHeader}>
        <Text style={styles.doneIcon}>🎉</Text>
        <Text style={styles.doneTitle}>{t.doneTitle}</Text>
        <Text style={styles.doneSubtitle}>{t.doneSubtitle}</Text>
      </View>

      <View style={styles.summaryCard}>
        <SummaryRow icon="🏪" label={t.shopName} value={data.shopName} />
        <SummaryRow icon="👤" label={t.ownerName} value={data.ownerName} />
        <SummaryRow icon="📞" label={t.phone} value={data.phone} />
        <SummaryRow icon="📍" label={t.city} value={`${data.city || ''}, ${data.state || ''}`} />
        {data.gstRegistered && <SummaryRow icon="📋" label={t.gstin} value={data.gstin} />}
        {data.upiId && <SummaryRow icon="💳" label={t.upiId} value={data.upiId} />}
      </View>

      {errors.save ? <Text style={styles.errorText}>{errors.save}</Text> : null}

      <TouchableOpacity
        style={[styles.primaryBtn, styles.doneBtn, isSaving && { opacity: 0.6 }]}
        onPress={handleFinish}
        disabled={isSaving}
        activeOpacity={0.8}
      >
        <Text style={styles.primaryBtnText}>{isSaving ? '...' : t.openDashboard}</Text>
      </TouchableOpacity>
    </View>
  );

  // ── Main Render ────────────────────────────────────────────

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {renderProgressBar()}
        <Animated.View style={{ opacity: fadeAnim, flex: 1 }}>
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
          {step === 5 && renderStep5()}
          {step === 6 && renderStep6()}
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// ── Summary Row ──────────────────────────────────────────────────────────────

const SummaryRow = ({ icon, label, value }: { icon: string; label: string; value?: string }) => (
  <View style={styles.summaryRow}>
    <Text style={styles.summaryIcon}>{icon}</Text>
    <View style={styles.summaryTextWrap}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value || '—'}</Text>
    </View>
  </View>
);

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BACKGROUND },
  scrollContent: { flexGrow: 1, paddingBottom: 40 },

  // Progress bar
  progressContainer: { paddingHorizontal: SPACING.LG, paddingTop: SPACING.LG, alignItems: 'center' },
  progressTrack: { width: '100%', maxWidth: 440, height: 4, borderRadius: 2, backgroundColor: COLORS.BORDER },
  progressFill: { height: 4, borderRadius: 2, backgroundColor: COLORS.PRIMARY },
  progressText: { marginTop: SPACING.XS, fontSize: FONT_SIZE.XS, color: COLORS.TEXT_DIM, fontWeight: FONT_WEIGHT.SEMIBOLD },

  // Step container
  stepContainer: { width: '100%', maxWidth: 440, alignSelf: 'center', paddingHorizontal: SPACING.LG, paddingTop: SPACING.XL },
  stepTitle: { fontSize: FONT_SIZE.XL, fontWeight: FONT_WEIGHT.EXTRABOLD, color: COLORS.TEXT_HEADING, marginBottom: SPACING.XS },
  stepSubtitle: { fontSize: FONT_SIZE.SM, color: COLORS.TEXT_DIM, marginBottom: SPACING.LG },

  // Welcome
  welcomeHeader: { alignItems: 'center', paddingTop: 48, paddingBottom: SPACING.XXL },
  welcomeIcon: { fontSize: 56, marginBottom: SPACING.MD },
  welcomeTitle: { fontSize: FONT_SIZE.XXL, fontWeight: FONT_WEIGHT.EXTRABOLD, color: COLORS.TEXT_HEADING, textAlign: 'center' },
  welcomeSubtitle: { fontSize: FONT_SIZE.MD, color: COLORS.TEXT_DIM, marginTop: SPACING.SM, textAlign: 'center' },

  // Language grid
  sectionTitle: { fontSize: FONT_SIZE.SM, fontWeight: FONT_WEIGHT.BOLD, color: COLORS.TEXT_DIM, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: SPACING.MD, textAlign: 'center' },
  langGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.SM, justifyContent: 'center', marginBottom: SPACING.XXL },
  langCard: { width: '45%', maxWidth: 180, paddingVertical: SPACING.MD, paddingHorizontal: SPACING.MD, borderRadius: RADIUS.LG, borderWidth: 1.5, borderColor: COLORS.BORDER, backgroundColor: COLORS.WHITE, alignItems: 'center', ...SHADOW.LIGHT },
  langCardActive: { borderColor: COLORS.PRIMARY, backgroundColor: COLORS.PRIMARY_BG },
  langNative: { fontSize: FONT_SIZE.LG, fontWeight: FONT_WEIGHT.BOLD, color: COLORS.TEXT_HEADING, marginBottom: 2 },
  langEnglish: { fontSize: FONT_SIZE.XS, color: COLORS.TEXT_DIM },
  langTextActiveColor: { color: COLORS.PRIMARY },
  langTextActiveColorDim: { color: COLORS.PRIMARY_LIGHT },
  langCheck: { position: 'absolute', top: 6, right: 6, width: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.PRIMARY, alignItems: 'center', justifyContent: 'center' },
  langCheckText: { color: '#fff', fontSize: 11, fontWeight: FONT_WEIGHT.BLACK },

  // Form inputs
  fieldGroup: { marginBottom: SPACING.MD },
  label: { fontSize: FONT_SIZE.SM, fontWeight: FONT_WEIGHT.SEMIBOLD, color: COLORS.TEXT_BODY, marginBottom: SPACING.XS },
  input: { borderWidth: 1, borderColor: COLORS.BORDER, borderRadius: RADIUS.MD, paddingHorizontal: SPACING.MD, paddingVertical: 10, fontSize: FONT_SIZE.MD, color: COLORS.TEXT_BODY, backgroundColor: COLORS.WHITE },
  inputError: { borderColor: COLORS.ERROR },
  errorText: { color: COLORS.ERROR, fontSize: FONT_SIZE.XS, fontWeight: FONT_WEIGHT.SEMIBOLD, marginTop: SPACING.XS },

  // State picker
  selectInput: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  selectText: { fontSize: FONT_SIZE.MD, color: COLORS.TEXT_BODY },
  selectPlaceholder: { fontSize: FONT_SIZE.MD, color: COLORS.TEXT_PLACEHOLDER },
  selectArrow: { fontSize: 12, color: COLORS.TEXT_DIM },
  stateList: { borderWidth: 1, borderColor: COLORS.BORDER, borderRadius: RADIUS.MD, backgroundColor: COLORS.WHITE, marginTop: SPACING.XS, ...SHADOW.MEDIUM },
  stateScroll: { maxHeight: 200 },
  stateItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.MD, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.DIVIDER },
  stateItemActive: { backgroundColor: COLORS.PRIMARY_BG },
  stateItemText: { fontSize: FONT_SIZE.SM, color: COLORS.TEXT_BODY },
  stateItemTextActive: { color: COLORS.PRIMARY, fontWeight: FONT_WEIGHT.BOLD },
  stateCode: { fontSize: FONT_SIZE.XS, color: COLORS.TEXT_DIM, fontWeight: FONT_WEIGHT.SEMIBOLD },

  // GST toggle
  toggleRow: { flexDirection: 'row', gap: SPACING.MD, marginBottom: SPACING.LG },
  toggleBtn: { flex: 1, paddingVertical: SPACING.MD, borderRadius: RADIUS.LG, borderWidth: 1.5, borderColor: COLORS.BORDER, backgroundColor: COLORS.WHITE, alignItems: 'center' },
  toggleBtnActive: { borderColor: COLORS.PRIMARY, backgroundColor: COLORS.PRIMARY_BG },
  toggleBtnText: { fontSize: FONT_SIZE.MD, fontWeight: FONT_WEIGHT.BOLD, color: COLORS.TEXT_DIM },
  toggleBtnTextActive: { color: COLORS.PRIMARY },

  // GST scheme
  schemeRow: { flexDirection: 'row', gap: SPACING.SM },
  schemeBtn: { flex: 1, paddingVertical: SPACING.SM, borderRadius: RADIUS.MD, borderWidth: 1, borderColor: COLORS.BORDER, backgroundColor: COLORS.WHITE, alignItems: 'center' },
  schemeBtnActive: { borderColor: COLORS.PRIMARY, backgroundColor: COLORS.PRIMARY_BG },
  schemeBtnText: { fontSize: FONT_SIZE.SM, fontWeight: FONT_WEIGHT.SEMIBOLD, color: COLORS.TEXT_DIM },
  schemeBtnTextActive: { color: COLORS.PRIMARY },
  hintText: { fontSize: FONT_SIZE.XS, color: COLORS.WARNING, marginTop: SPACING.SM, fontStyle: 'italic' },

  // PIN
  pinSection: { marginBottom: SPACING.LG, alignItems: 'center' },
  pinLabel: { fontSize: FONT_SIZE.SM, fontWeight: FONT_WEIGHT.SEMIBOLD, color: COLORS.TEXT_BODY, marginBottom: SPACING.SM },
  pinDotsRow: { flexDirection: 'row', gap: 16, marginBottom: SPACING.SM },
  pinDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: COLORS.BORDER, backgroundColor: COLORS.WHITE },
  pinDotFilled: { backgroundColor: COLORS.PRIMARY, borderColor: COLORS.PRIMARY },
  pinInput: { borderWidth: 1, borderColor: COLORS.BORDER, borderRadius: RADIUS.MD, paddingHorizontal: SPACING.MD, paddingVertical: 8, fontSize: FONT_SIZE.LG, color: COLORS.TEXT_BODY, backgroundColor: COLORS.WHITE, textAlign: 'center', width: 160, letterSpacing: 8 },

  // UPI
  upiIconRow: { alignItems: 'center', marginBottom: SPACING.LG },
  upiIcon: { fontSize: 48 },

  // Buttons
  btnRow: { flexDirection: 'row', gap: SPACING.MD, marginTop: SPACING.LG },
  primaryBtn: { flex: 1, paddingVertical: 14, borderRadius: RADIUS.LG, backgroundColor: COLORS.PRIMARY, alignItems: 'center', ...SHADOW.GLOW_GREEN },
  primaryBtnText: { color: '#fff', fontSize: FONT_SIZE.MD, fontWeight: FONT_WEIGHT.EXTRABOLD },
  secondaryBtn: { paddingVertical: 14, paddingHorizontal: SPACING.LG, borderRadius: RADIUS.LG, borderWidth: 1.5, borderColor: COLORS.BORDER, backgroundColor: COLORS.WHITE, alignItems: 'center' },
  secondaryBtnText: { fontSize: FONT_SIZE.MD, fontWeight: FONT_WEIGHT.BOLD, color: COLORS.TEXT_DIM },

  // Done
  doneHeader: { alignItems: 'center', paddingTop: 32, paddingBottom: SPACING.LG },
  doneIcon: { fontSize: 56, marginBottom: SPACING.MD },
  doneTitle: { fontSize: FONT_SIZE.XXL, fontWeight: FONT_WEIGHT.EXTRABOLD, color: COLORS.TEXT_HEADING },
  doneSubtitle: { fontSize: FONT_SIZE.MD, color: COLORS.TEXT_DIM, marginTop: SPACING.SM },
  doneBtn: { marginTop: SPACING.LG },

  // Summary card
  summaryCard: { backgroundColor: COLORS.WHITE, borderRadius: RADIUS.XL, padding: SPACING.LG, borderWidth: 1, borderColor: COLORS.BORDER, ...SHADOW.MEDIUM },
  summaryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.SM, borderBottomWidth: 1, borderBottomColor: COLORS.DIVIDER },
  summaryIcon: { fontSize: 20, width: 32 },
  summaryTextWrap: { flex: 1 },
  summaryLabel: { fontSize: FONT_SIZE.XS, color: COLORS.TEXT_DIM, fontWeight: FONT_WEIGHT.SEMIBOLD },
  summaryValue: { fontSize: FONT_SIZE.MD, color: COLORS.TEXT_HEADING, fontWeight: FONT_WEIGHT.BOLD },
});

export default RegisterScreen;
