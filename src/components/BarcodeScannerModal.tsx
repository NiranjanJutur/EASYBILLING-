import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  SafeAreaView,
  Vibration,
} from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useCodeScanner,
  CodeType,
} from 'react-native-vision-camera';
import { COLORS, RADIUS, SPACING } from '../config/theme';

export interface BarcodeScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onScanned: (barcode: string) => void;
  title?: string;
  continuous?: boolean;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  visible,
  onClose,
  onScanned,
  title = 'Scan Barcode',
  continuous = true,
}) => {
  const device = useCameraDevice('back');
  const { hasPermission, canRequestPermission, requestPermission } = useCameraPermission();
  const [torch, setTorch] = useState(false);
  const [scannedBadge, setScannedBadge] = useState<string | null>(null);
  const lastScanned = useRef<{ code: string; at: number }>({ code: '', at: 0 });

  useEffect(() => {
    if (visible && !hasPermission && canRequestPermission) {
      requestPermission().catch(() => undefined);
    }
  }, [visible, hasPermission, canRequestPermission, requestPermission]);

  useEffect(() => {
    if (!visible) {
      setTorch(false);
      setScannedBadge(null);
      lastScanned.current = { code: '', at: 0 };
    }
  }, [visible]);

  const codeTypes: CodeType[] = [
    'ean-13',
    'ean-8',
    'upc-a',
    'upc-e',
    'code-128',
    'code-39',
    'code-93',
    'qr',
    'itf',
  ];

  const codeScanner = useCodeScanner({
    codeTypes,
    onCodeScanned: codes => {
      const code = codes[0];
      const value = code?.value?.trim();
      if (!value) return;

      const now = Date.now();
      // Cooldown: Ignore same code within 1500ms
      if (value === lastScanned.current.code && now - lastScanned.current.at < 1500) {
        return;
      }

      lastScanned.current = { code: value, at: now };

      // Haptic feedback
      try {
        Vibration.vibrate(100);
      } catch {
        // ignore
      }

      setScannedBadge(value);
      setTimeout(() => setScannedBadge(null), 1200);

      onScanned(value);

      if (!continuous) {
        onClose();
      }
    },
  });

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>
              {continuous ? 'Continuous POS Mode · Point at any barcode' : 'Align barcode within reticle'}
            </Text>
          </View>
          <View style={styles.headerActions}>
            {device?.hasTorch && (
              <TouchableOpacity
                onPress={() => setTorch(t => !t)}
                style={[styles.headerBtn, torch && styles.headerBtnActive]}
                accessibilityLabel="Toggle Torch"
              >
                <Text style={styles.headerBtnText}>{torch ? '🔦 On' : '🔦 Off'}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityLabel="Close Scanner">
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Viewfinder area */}
        <View style={styles.previewContainer}>
          {!hasPermission ? (
            <View style={styles.permissionBox}>
              <Text style={styles.permissionTitle}>Camera Permission Required</Text>
              <Text style={styles.permissionDesc}>
                ShopLedger uses your device camera for instant offline barcode scanning at checkout.
              </Text>
              {canRequestPermission ? (
                <TouchableOpacity style={styles.allowButton} onPress={() => requestPermission()}>
                  <Text style={styles.allowButtonText}>Allow Camera Access</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.permissionWarning}>
                  Permission was denied. Please enable camera permissions in your device Settings.
                </Text>
              )}
            </View>
          ) : !device ? (
            <View style={styles.permissionBox}>
              <Text style={styles.permissionTitle}>No Camera Detected</Text>
              <Text style={styles.permissionDesc}>
                No rear camera is available on this device. You can still enter or search barcodes manually.
              </Text>
            </View>
          ) : (
            <>
              <Camera
                style={StyleSheet.absoluteFill}
                device={device}
                isActive={visible}
                codeScanner={codeScanner}
                torch={torch ? 'on' : 'off'}
                enableZoomGesture
              />

              {/* Viewfinder Overlay with Flutter-style Reticle */}
              <View style={styles.overlay} pointerEvents="none">
                <View style={styles.reticleContainer}>
                  {/* Top-left corner */}
                  <View style={[styles.corner, styles.cornerTL]} />
                  {/* Top-right corner */}
                  <View style={[styles.corner, styles.cornerTR]} />
                  {/* Bottom-left corner */}
                  <View style={[styles.corner, styles.cornerBL]} />
                  {/* Bottom-right corner */}
                  <View style={[styles.corner, styles.cornerBR]} />

                  {/* Red Laser Scanning Guide Line */}
                  <View style={styles.laserLine} />
                </View>

                {scannedBadge ? (
                  <View style={styles.scannedBadge}>
                    <Text style={styles.scannedBadgeText}>✓ Scanned: {scannedBadge}</Text>
                  </View>
                ) : (
                  <Text style={styles.hintText}>Center barcode inside box (EAN, UPC, Code-128, QR)</Text>
                )}
              </View>
            </>
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.doneBtn} onPress={onClose}>
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.MD,
    paddingVertical: 14,
    backgroundColor: '#111827',
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  subtitle: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#374151',
  },
  headerBtnActive: {
    backgroundColor: '#2563eb',
  },
  headerBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  previewContainer: {
    flex: 1,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reticleContainer: {
    width: 280,
    height: 180,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#ffffff',
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 6,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 6,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 6,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 6,
  },
  laserLine: {
    position: 'absolute',
    width: '92%',
    height: 2,
    backgroundColor: '#ef4444',
    shadowColor: '#ef4444',
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 3,
  },
  hintText: {
    color: '#f3f4f6',
    fontSize: 13,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 20,
    textAlign: 'center',
  },
  scannedBadge: {
    backgroundColor: '#16a34a',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 20,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  scannedBadgeText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  permissionBox: {
    padding: SPACING.LG,
    alignItems: 'center',
    maxWidth: 320,
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  permissionDesc: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  permissionWarning: {
    fontSize: 12,
    color: '#f87171',
    textAlign: 'center',
    marginTop: 8,
  },
  allowButton: {
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: RADIUS.MD,
  },
  allowButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  footer: {
    padding: SPACING.MD,
    backgroundColor: '#111827',
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
  },
  doneBtn: {
    backgroundColor: '#374151',
    paddingVertical: 14,
    borderRadius: RADIUS.MD,
    alignItems: 'center',
  },
  doneBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default BarcodeScannerModal;
