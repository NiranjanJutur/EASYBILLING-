import React, { useEffect } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Modal } from 'react-native';
import { CodeScanner } from 'react-native-vision-camera-barcode-scanner';
import { useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { COLORS, RADIUS, SPACING } from '../config/theme';

interface BarcodeScannerModalProps {
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
  continuous = false,
}) => {
  const cameraDevice = useCameraDevice('back');
  const { hasPermission, canRequestPermission, requestPermission } = useCameraPermission();

  useEffect(() => {
    if (visible && !hasPermission && canRequestPermission) {
      requestPermission().catch(() => undefined);
    }
  }, [visible, hasPermission, canRequestPermission, requestPermission]);

  const handleScanned = (codes: any[]) => {
    const raw = codes[0]?.rawValue;
    if (raw) {
      onScanned(raw.trim());
      if (!continuous) {
        onClose();
      }
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        {hasPermission && !cameraDevice ? (
          <View style={[styles.preview, styles.permission]}>
            <Text style={styles.instructions}>No rear camera is available on this device.</Text>
          </View>
        ) : hasPermission ? (
          <View style={styles.preview}>
            <CodeScanner
              style={StyleSheet.absoluteFill}
              isActive={visible}
              barcodeFormats={['all-formats']}
              onBarcodeScanned={handleScanned}
              onError={() => undefined}
            />
            <View style={styles.overlay} pointerEvents="none">
              <View style={styles.scanBox} />
              <Text style={styles.instructions}>Align barcode within the box</Text>
            </View>
          </View>
        ) : (
          <View style={[styles.preview, styles.permission]}>
            <Text style={styles.instructions}>Allow camera access to scan a barcode.</Text>
            {canRequestPermission && (
              <TouchableOpacity style={styles.allowButton} onPress={() => requestPermission()}>
                <Text style={styles.allowText}>Allow camera</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
          <Text style={styles.cancelText}>Done</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.MD,
    paddingTop: 40,
    paddingBottom: 12,
    backgroundColor: '#111',
  },
  title: { fontSize: 16, fontWeight: '700', color: '#fff' },
  closeBtn: { padding: 6 },
  closeText: { fontSize: 18, color: '#aaa', fontWeight: '600' },
  preview: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  permission: { justifyContent: 'center', paddingHorizontal: 28 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  scanBox: {
    width: 250,
    height: 160,
    borderWidth: 2,
    borderColor: '#10B981',
    borderRadius: 8,
  },
  instructions: {
    color: 'white',
    marginTop: 20,
    fontSize: 14,
    fontWeight: 'bold',
  },
  cancelButton: {
    padding: 16,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  cancelText: {
    color: COLORS.PRIMARY,
    fontWeight: 'bold',
    fontSize: 16,
  },
  allowButton: { marginTop: 18, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10, backgroundColor: '#216e4e' },
  allowText: { color: '#fff', fontWeight: '700' },
});

export default BarcodeScannerModal;
