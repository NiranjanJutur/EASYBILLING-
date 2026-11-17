import React, { useEffect } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Modal } from 'react-native';
import { CodeScanner } from 'react-native-vision-camera-barcode-scanner';
import { useCameraDevice, useCameraPermission } from 'react-native-vision-camera';

interface BarcodeScannerProps {
  visible?: boolean;
  onScanned: (data: string) => void;
  onCancel: () => void;
}

export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({
  visible = true,
  onScanned,
  onCancel,
}) => {
  const cameraDevice = useCameraDevice('back');
  const { hasPermission, canRequestPermission, requestPermission } = useCameraPermission();

  useEffect(() => {
    if (visible && !hasPermission && canRequestPermission) {
      requestPermission().catch(() => undefined);
    }
  }, [visible, hasPermission, canRequestPermission, requestPermission]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <View style={styles.container}>
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
              onBarcodeScanned={codes => {
                const value = codes[0]?.rawValue;
                if (value) onScanned(value);
              }}
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

        <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  preview: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  permission: { justifyContent: 'center', paddingHorizontal: 28 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  scanBox: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: '#00ff00',
    borderRadius: 8,
  },
  instructions: {
    color: 'white',
    marginTop: 20,
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelButton: {
    padding: 20,
    backgroundColor: 'white',
    alignItems: 'center',
  },
  cancelText: {
    color: 'red',
    fontWeight: 'bold',
    fontSize: 18,
  },
  allowButton: { marginTop: 18, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10, backgroundColor: '#216e4e' },
  allowText: { color: '#fff', fontWeight: '700' },
});
