import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Image, ScrollView, ActivityIndicator } from 'react-native';
import { COLORS, SPACING, RADIUS, SHADOW, GRADIENTS } from '../../config/theme';
import { useScanner } from '../../services/ai/scannerService';
import { useSlipExtraction } from '../../hooks/useSlipExtraction';
import { Product } from '../../models/Product';
import GradientView from '../../components/GradientView';

interface ScanScreenProps {
    navigation?: any;
    onProductAdded?: (product: Product) => void;
}

type ScanMode = 'PRODUCT' | 'SLIP';

const ScanScreen = ({ navigation, onProductAdded }: ScanScreenProps) => {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    
    const [mode, setMode] = useState<ScanMode>('PRODUCT');
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [cameraActive, setCameraActive] = useState(false);
    const [cameraError, setCameraError] = useState<string | null>(null);

    const { scanProduct, isScanning: isScanningProduct, lastResult: productResult } = useScanner();
    const { extract: processSlip, loading: isProcessingSlip, result: slipResult, reset: resetSlip } = useSlipExtraction();

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' },
            });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play();
                setCameraActive(true);
                setCameraError(null);
            }
        } catch (err) {
            setCameraError('Camera access denied or not available. Try uploading an image instead.');
        }
    };

    const stopCamera = () => {
        if (videoRef.current?.srcObject) {
            const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
            tracks.forEach(t => t.stop());
            videoRef.current.srcObject = null;
        }
        setCameraActive(false);
    };

    const captureAndProcess = async () => {
        if (!cameraActive) {
            await startCamera();
            return;
        }

        try {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            if (!video || !canvas) return;

            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(video, 0, 0);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            setCapturedImage(dataUrl);
            stopCamera();

            const base64 = dataUrl.split(',')[1];
            if (mode === 'PRODUCT') {
                await scanProduct(base64);
            } else {
                await processSlip(base64);
            }
        } catch (err) {
            Alert.alert('Scan Error', 'Failed to capture photo. Try again.');
        }
    };

    const handleUpload = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (event: any) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (cameraActive) stopCamera();

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const dataUrl = e.target?.result as string;
                setCapturedImage(dataUrl);
                const base64 = dataUrl.split(',')[1];
                
                if (mode === 'PRODUCT') {
                    await scanProduct(base64);
                } else {
                    await processSlip(base64);
                }
            } catch (err: any) {
                Alert.alert('Analysis Error', err?.message || 'Failed to analyze properly.');
                setCapturedImage(null);
            }
        };
        reader.readAsDataURL(file);
        event.target.value = '';
    };

    const reset = () => {
        setCapturedImage(null);
        resetSlip();
    };

    return (
        <View style={styles.container}>
            <input ref={fileInputRef as any} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <Text style={styles.backText}>←</Text>
                </TouchableOpacity>
                <View style={styles.tabBar}>
                    <TouchableOpacity onPress={() => { setMode('PRODUCT'); reset(); }} style={[styles.tab, mode === 'PRODUCT' && styles.activeTab]}>
                        <Text style={[styles.tabText, mode === 'PRODUCT' && styles.activeTabText]}>Product</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => { setMode('SLIP'); reset(); }} style={[styles.tab, mode === 'SLIP' && styles.activeTab]}>
                        <Text style={[styles.tabText, mode === 'SLIP' && styles.activeTabText]}>Bill Slip</Text>
                    </TouchableOpacity>
                </View>
                <View style={{ width: 40 }} />
            </View>

            {/* Preview Section */}
            <View style={styles.preview}>
                {capturedImage ? (
                    <Image source={{ uri: capturedImage }} style={StyleSheet.absoluteFill} resizeMode="contain" />
                ) : (
                    <>
                        <canvas ref={canvasRef as any} style={{ display: 'none' }} />
                        <video ref={videoRef as any} style={styles.video} autoPlay playsInline muted />
                        <View style={[styles.targetBox, mode === 'SLIP' && styles.slipTarget]} />
                        <Text style={styles.hintText}>
                            {cameraActive ? (mode === 'PRODUCT' ? 'Point at product' : 'Center the full bill paper') : 'Start Camera or Upload'}
                        </Text>
                    </>
                )}

                {/* Loading Overlay */}
                {(isScanningProduct || isProcessingSlip) && (
                    <View style={styles.loadingOverlay}>
                        <GradientView colors={GRADIENTS.DARK_FOREST} style={styles.loadingPill}>
                            <ActivityIndicator color={COLORS.PRIMARY_LIGHT} />
                            <Text style={styles.loadingText}>Gemini AI analyzing...</Text>
                        </GradientView>
                    </View>
                )}
            </View>

            {/* Results Section */}
            {mode === 'PRODUCT' && productResult && capturedImage && (
                <View style={styles.resultCard}>
                    <Text style={styles.resultCaption}>Product Identified</Text>
                    <Text style={styles.resultTitle}>{productResult.name}</Text>
                    <Text style={styles.resultPrice}>₹{productResult.price} / {productResult.unit}</Text>
                    <View style={styles.actionRow}>
                        <TouchableOpacity style={styles.secondaryBtn} onPress={reset}><Text style={styles.btnText}>Retry</Text></TouchableOpacity>
                        <TouchableOpacity style={styles.primaryBtn} onPress={() => { onProductAdded?.(productResult); navigation.goBack(); }}><Text style={styles.btnText}>Add to Cart</Text></TouchableOpacity>
                    </View>
                </View>
            )}

            {mode === 'SLIP' && slipResult && capturedImage && (
                <View style={styles.slipCard}>
                    <Text style={styles.resultCaption}>Extracted from Slip (Customer: {slipResult.customerName})</Text>
                    <ScrollView style={{ maxHeight: 150, marginVertical: 8 }}>
                        {slipResult.items.map((item, idx) => (
                            <View key={idx} style={styles.slipItem}>
                                <Text style={styles.slipItemName}>{item.name}</Text>
                                <Text style={styles.slipItemPrice}>{item.qty} {item.unit} · ₹{item.price}</Text>
                            </View>
                        ))}
                    </ScrollView>
                    <View style={styles.actionRow}>
                        <TouchableOpacity style={styles.secondaryBtn} onPress={reset}><Text style={styles.btnText}>Retry</Text></TouchableOpacity>
                        <TouchableOpacity style={styles.primaryBtn} onPress={() => { Alert.alert('Processing', 'Adding items to billing cart...'); navigation.navigate('billing', { items: slipResult.items }); }}><Text style={styles.btnText}>Apply All</Text></TouchableOpacity>
                    </View>
                </View>
            )}

            {/* Action Bar */}
            {!capturedImage && !isScanningProduct && !isProcessingSlip && (
                <View style={styles.actionBar}>
                    <TouchableOpacity style={styles.sideBtn} onPress={handleUpload}>
                        <Text style={styles.sideIcon}>📁</Text>
                        <Text style={styles.sideLabel}>Upload</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity style={styles.captureBtn} onPress={captureAndProcess}>
                        <GradientView colors={GRADIENTS.PRIMARY_HEADER} style={styles.captureCircle}>
                            <Text style={{ fontSize: 28 }}>{mode === 'PRODUCT' ? '📸' : '📄'}</Text>
                        </GradientView>
                        <Text style={styles.captureLabel}>{cameraActive ? 'Capture' : 'Start'}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.sideBtn} onPress={reset}>
                        <Text style={styles.sideIcon}>🔄</Text>
                        <Text style={styles.sideLabel}>Reset</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0B1A10' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACING.MD, backgroundColor: 'rgba(0,0,0,0.5)' },
    backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
    backText: { color: '#fff', fontSize: 24 },
    tabBar: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: RADIUS.PILL, padding: 4 },
    tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: RADIUS.PILL },
    activeTab: { backgroundColor: '#27A85A' },
    tabText: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 'bold' },
    activeTabText: { color: '#fff' },
    preview: { flex: 1, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
    video: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%', objectFit: 'cover' },
    targetBox: { width: 220, height: 220, borderWidth: 2, borderColor: '#27A85A', borderRadius: 20, borderStyle: 'dashed' },
    slipTarget: { width: 300, height: 450 },
    hintText: { position: 'absolute', top: 40, color: '#fff', backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: RADIUS.LG, fontSize: 12 },
    loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
    loadingPill: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 12, borderRadius: RADIUS.PILL, ...SHADOW.STRONG },
    loadingText: { color: '#fff', fontWeight: 'bold' },
    resultCard: { position: 'absolute', bottom: 30, left: 20, right: 20, backgroundColor: '#fff', borderRadius: RADIUS.XL, padding: SPACING.LG, ...SHADOW.STRONG },
    slipCard: { position: 'absolute', bottom: 30, left: 10, right: 10, backgroundColor: '#fff', borderRadius: RADIUS.XL, padding: SPACING.LG, ...SHADOW.STRONG },
    resultCaption: { fontSize: 10, fontWeight: '900', color: COLORS.PRIMARY, textTransform: 'uppercase', marginBottom: 4 },
    resultTitle: { fontSize: 20, fontWeight: '900', color: COLORS.TEXT_HEADING },
    resultPrice: { fontSize: 14, color: COLORS.TEXT_DIM, marginTop: 4 },
    slipItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
    slipItemName: { fontSize: 13, fontWeight: '700', color: '#333' },
    slipItemPrice: { fontSize: 13, color: '#666' },
    actionRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
    primaryBtn: { flex: 2, backgroundColor: '#27A85A', height: 48, borderRadius: RADIUS.LG, justifyContent: 'center', alignItems: 'center' },
    secondaryBtn: { flex: 1, backgroundColor: '#f0f0f0', height: 48, borderRadius: RADIUS.LG, justifyContent: 'center', alignItems: 'center' },
    btnText: { fontWeight: 'bold', fontSize: 14, color: '#333' },
    actionBar: { flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center', paddingBottom: 40, paddingTop: 20 },
    captureBtn: { alignItems: 'center' },
    captureCircle: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', ...SHADOW.GLOW_GREEN },
    captureLabel: { color: '#fff', fontSize: 12, fontWeight: 'bold', marginTop: 8 },
    sideBtn: { alignItems: 'center', width: 60 },
    sideIcon: { fontSize: 24 },
    sideLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 10, marginTop: 4 },
});

export default ScanScreen;
