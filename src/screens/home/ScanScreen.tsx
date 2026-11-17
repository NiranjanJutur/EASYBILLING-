import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CodeScanner } from 'react-native-vision-camera-barcode-scanner';
import { useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { getProducts } from '../../services/firebase/firestoreService';
import type { Product } from '../../models/Product';

const ScanScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const scanLock = useRef(false);
  const cameraDevice = useCameraDevice('back');
  const { hasPermission, canRequestPermission, requestPermission } = useCameraPermission();

  useEffect(() => {
    getProducts().then(setProducts).catch(() => setProducts([]));
  }, []);

  useEffect(() => {
    if (!hasPermission && canRequestPermission) {
      requestPermission().catch(error => setCameraError(error instanceof Error ? error.message : 'Camera permission could not be requested.'));
    }
  }, [hasPermission, canRequestPermission, requestPermission]);

  const handleBarcode = useCallback((data?: string) => {
    if (!data || scanLock.current) return;
    scanLock.current = true;
    const code = data.trim().toLowerCase();
    const product = products.find(p =>
      [p.barcode, p.sku, p.id].some(value => value?.trim().toLowerCase() === code),
    );
    if (!product) {
      Alert.alert('Product not found', `No saved product matches barcode ${data}. Add this barcode to the product and scan again.`, [
        { text: 'Scan again', onPress: () => { scanLock.current = false; } },
        { text: 'Back', style: 'cancel', onPress: () => navigation?.goBack() },
      ]);
      return;
    }

    navigation?.navigate('billing', {
      importedItems: [{
        productId: product.id, name: product.name, qty: 1, unit: product.unit,
        price: product.price, gst: product.gstPercent,
      }],
    });
  }, [products, navigation]);

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation?.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Scan Product</Text>
        <View style={{ width: 62 }} />
      </View>

      {cameraError ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>Camera could not open</Text>
          <Text style={styles.errorText}>{cameraError}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => { setCameraError(null); scanLock.current = false; }}>
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        hasPermission && !cameraDevice ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>No camera found</Text>
            <Text style={styles.errorText}>This device does not provide a rear camera. Try scanning on a phone with a camera.</Text>
          </View>
        ) : hasPermission ? (
          <View style={styles.camera}>
            <CodeScanner
              style={StyleSheet.absoluteFill}
              isActive
              barcodeFormats={['all-formats']}
              onBarcodeScanned={codes => handleBarcode(codes[0]?.rawValue)}
              onError={error => setCameraError(error.message || 'The camera scanner could not start.')}
            />
            <View style={styles.overlay} pointerEvents="none">
              <View style={styles.scanFrame} />
              <Text style={styles.hint}>Point the camera at a product barcode</Text>
              <Text style={styles.subHint}>The matching item will be added to a new bill.</Text>
            </View>
          </View>
        ) : (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>Camera permission needed</Text>
            <Text style={styles.errorText}>Allow camera access to scan product barcodes.</Text>
            {canRequestPermission && (
              <TouchableOpacity style={styles.retryButton} onPress={() => requestPermission()}>
                <Text style={styles.retryText}>Allow camera</Text>
              </TouchableOpacity>
            )}
          </View>
        )
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#101714' },
  topBar: { height: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, backgroundColor: '#fff' },
  backButton: { width: 62 },
  backText: { color: '#216e4e', fontWeight: '700' },
  title: { color: '#202124', fontSize: 17, fontWeight: '800' },
  camera: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.16)' },
  scanFrame: { width: 270, height: 180, borderWidth: 3, borderColor: '#42d392', borderRadius: 18, backgroundColor: 'transparent' },
  hint: { color: '#fff', fontSize: 15, fontWeight: '700', marginTop: 22, textAlign: 'center', paddingHorizontal: 24 },
  subHint: { color: '#e4e7e5', fontSize: 12, marginTop: 8, textAlign: 'center', paddingHorizontal: 24 },
  errorBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  errorTitle: { color: '#fff', fontSize: 19, fontWeight: '800' },
  errorText: { color: '#d0d6d2', fontSize: 14, textAlign: 'center', marginTop: 10 },
  retryButton: { marginTop: 18, backgroundColor: '#216e4e', borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12 },
  retryText: { color: '#fff', fontWeight: '700' },
});

export default ScanScreen;
