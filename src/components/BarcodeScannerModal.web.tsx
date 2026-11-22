import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Platform } from 'react-native';
import { COLORS, RADIUS, SPACING } from '../config/theme';

interface BarcodeScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onScanned: (barcode: string) => void;
  title?: string;
  continuous?: boolean;
}

/** Play a crisp POS scanner beep using Web Audio API */
function playBeep() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1800, ctx.currentTime); // 1.8kHz POS beep
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  } catch {
    // Ignore audio restrictions
  }
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  visible,
  onClose,
  onScanned,
  title = 'Scan Barcode',
  continuous = false,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<any>(null);
  const lastScannedCode = useRef<string>('');
  const lastScannedTime = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');

  // Stop camera stream
  const stopCamera = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  // Start camera and setup BarcodeDetector
  const startCamera = async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('Camera not supported by this browser. You can type or upload an image.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
        setupDetector();
      }
    } catch (err: any) {
      setCameraError(err.message || 'Unable to access camera. Please allow camera permissions.');
    }
  };

  const setupDetector = () => {
    const hasBarcodeDetector = 'BarcodeDetector' in window;
    let detector: any = null;
    if (hasBarcodeDetector) {
      try {
        detector = new (window as any).BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'],
        });
      } catch {
        detector = null;
      }
    }

    // Interval scanning of video element
    intervalRef.current = setInterval(async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) return;
      if (detector) {
        try {
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes && barcodes.length > 0) {
            const rawValue = barcodes[0].rawValue;
            if (rawValue) handleDetected(rawValue);
          }
        } catch {
          // ignore detector frame errors
        }
      }
    }, 250);
  };

  const handleDetected = (code: string) => {
    const clean = code.trim();
    if (!clean) return;
    const now = Date.now();
    // Debounce 1.5s for same code
    if (clean === lastScannedCode.current && now - lastScannedTime.current < 1500) {
      return;
    }
    lastScannedCode.current = clean;
    lastScannedTime.current = now;

    playBeep();
    setFeedback(`✅ Detected: ${clean}`);

    onScanned(clean);

    if (!continuous) {
      setTimeout(() => {
        stopCamera();
        onClose();
      }, 350);
    }
  };

  // Image upload fallback for barcode detection
  const handleFileUpload = async (event: any) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if ('BarcodeDetector' in window) {
      try {
        const img = new Image();
        img.src = URL.createObjectURL(file);
        img.onload = async () => {
          const detector = new (window as any).BarcodeDetector({
            formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'],
          });
          const codes = await detector.detect(img);
          if (codes && codes.length > 0) {
            handleDetected(codes[0].rawValue);
          } else {
            setCameraError('No barcode recognized in the uploaded image.');
          }
        };
      } catch {
        setCameraError('Could not process image.');
      }
    } else {
      setCameraError('Barcode detection from image requires a supported browser.');
    }
  };

  useEffect(() => {
    if (visible) {
      startCamera();
    } else {
      stopCamera();
      setFeedback(null);
      setCameraError(null);
    }
    return () => {
      stopCamera();
    };
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={() => { stopCamera(); onClose(); }}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={() => { stopCamera(); onClose(); }} style={styles.closeBtn}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Camera Viewfinder */}
          <View style={styles.viewport}>
            <video
              ref={videoRef}
              style={{
                width: '100%',
                height: 280,
                objectFit: 'cover',
                backgroundColor: '#000',
                borderRadius: 8,
              }}
              playsInline
              muted
            />

            {/* Scanning reticle / alignment box */}
            <View style={styles.reticleOverlay} pointerEvents="none">
              <View style={styles.reticleBox}>
                <View style={[styles.corner, styles.tl]} />
                <View style={[styles.corner, styles.tr]} />
                <View style={[styles.corner, styles.bl]} />
                <View style={[styles.corner, styles.br]} />
                <View style={styles.laserLine} />
              </View>
              <Text style={styles.reticleHint}>Align barcode within the frame</Text>
            </View>
          </View>

          {/* Live Feedback */}
          {feedback && (
            <View style={styles.feedbackBanner}>
              <Text style={styles.feedbackText}>{feedback}</Text>
            </View>
          )}

          {/* Camera Error / Permission Banner */}
          {cameraError && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{cameraError}</Text>
            </View>
          )}

          {/* Actions */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.uploadBtn}
              onPress={() => fileInputRef.current?.click()}
            >
              <Text style={styles.uploadBtnText}>📁 Upload Image</Text>
            </TouchableOpacity>
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              accept="image/*"
              onChange={handleFileUpload}
            />

            <TouchableOpacity
              style={styles.doneBtn}
              onPress={() => { stopCamera(); onClose(); }}
            >
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.MD,
  },
  container: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#fff',
    borderRadius: RADIUS.LG,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.MD,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  closeBtn: {
    padding: 6,
  },
  closeText: {
    fontSize: 18,
    color: '#6b7280',
    fontWeight: '600',
  },
  viewport: {
    position: 'relative',
    height: 280,
    backgroundColor: '#000',
  },
  reticleOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reticleBox: {
    width: 220,
    height: 140,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  corner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: '#10B981',
  },
  tl: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 },
  tr: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 },
  br: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },
  laserLine: {
    width: '100%',
    height: 2,
    backgroundColor: 'rgba(239, 68, 68, 0.85)',
    shadowColor: '#ef4444',
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  reticleHint: {
    color: '#fff',
    fontSize: 12,
    marginTop: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  feedbackBanner: {
    backgroundColor: '#dcfce7',
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  feedbackText: {
    color: '#15803d',
    fontWeight: '700',
    fontSize: 13,
  },
  errorBanner: {
    backgroundColor: '#fee2e2',
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 12,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: SPACING.MD,
    backgroundColor: '#f9fafb',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    gap: 8,
  },
  uploadBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: RADIUS.MD,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
  },
  uploadBtnText: {
    color: '#374151',
    fontWeight: '600',
    fontSize: 13,
  },
  doneBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: RADIUS.MD,
    backgroundColor: COLORS.PRIMARY,
    alignItems: 'center',
  },
  doneBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
});

export default BarcodeScannerModal;
