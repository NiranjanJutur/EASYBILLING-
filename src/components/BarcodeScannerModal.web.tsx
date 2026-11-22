import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator } from 'react-native';
import { COLORS, RADIUS, SPACING } from '../config/theme';

interface BarcodeScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onScanned: (barcode: string) => void;
  title?: string;
  continuous?: boolean;
}

/** Play sound using the real scan.mp3 from flutter_billing_app with oscillator fallback */
function playScanSound() {
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(100);
    }
  } catch {
    // ignore
  }
  try {
    const audio = new Audio('/sounds/scan.mp3');
    audio.play().catch(() => playOscillatorBeep());
  } catch {
    playOscillatorBeep();
  }
}

function playOscillatorBeep() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1850, ctx.currentTime);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  } catch {
    // Ignore audio autoplay restrictions
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
  const zxingReaderRef = useRef<any>(null);
  const intervalRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const lastScannedCode = useRef<string>('');
  const lastScannedTime = useRef<number>(0);

  const [cameraActive, setCameraActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Hardware controls
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [zoomSupported, setZoomSupported] = useState(false);
  const [maxZoom, setMaxZoom] = useState(3);
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
  const [currentDeviceIndex, setCurrentDeviceIndex] = useState(0);

  // Stop all camera and decoding processes
  const stopCamera = useCallback(() => {
    if (zxingReaderRef.current) {
      try {
        zxingReaderRef.current.reset();
      } catch {
        // ignore
      }
      zxingReaderRef.current = null;
    }
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
    setTorchOn(false);
    setLoading(false);
  }, []);

  const handleDetected = useCallback((code: string) => {
    const clean = code.trim();
    if (!clean) return;
    const now = Date.now();

    // Debounce duplicate reads within 1.5 seconds
    if (clean === lastScannedCode.current && now - lastScannedTime.current < 1500) {
      return;
    }
    lastScannedCode.current = clean;
    lastScannedTime.current = now;

    playScanSound();
    setFeedback(`✅ Detected: ${clean}`);

    onScanned(clean);

    if (!continuous) {
      setTimeout(() => {
        stopCamera();
        onClose();
      }, 350);
    }
  }, [continuous, onClose, onScanned, stopCamera]);

  // Start Camera with high resolution & continuous auto-focus
  const startCamera = useCallback(async (deviceIndex = 0) => {
    stopCamera();
    setLoading(true);
    setCameraError(null);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('Camera API is not supported in this browser environment.');
        setLoading(false);
        return;
      }

      // Discover video input devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === 'videoinput');
      setAvailableDevices(videoDevices);

      const targetDevice = videoDevices[deviceIndex];
      const videoConstraints: MediaTrackConstraints = targetDevice?.deviceId
        ? { deviceId: { exact: targetDevice.deviceId } }
        : { facingMode: { ideal: 'environment' } };

      // High performance constraints matching mobile_scanner in Flutter
      const constraints: MediaStreamConstraints = {
        video: {
          ...videoConstraints,
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
          ...({ focusMode: { ideal: 'continuous' } } as any),
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      const track = stream.getVideoTracks()[0];
      if (track) {
        const capabilities = (track.getCapabilities ? track.getCapabilities() : {}) as any;
        // Check Torch capability
        if ('torch' in capabilities) {
          setHasTorch(true);
        }
        // Check Zoom capability
        if ('zoom' in capabilities) {
          setZoomSupported(true);
          setMaxZoom(capabilities.zoom.max || 3);
        }
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
        setLoading(false);
        setupDecodingEngine();
      }
    } catch (err: any) {
      console.error('Camera start error:', err);
      setCameraError(err.message || 'Camera permission denied or camera device in use.');
      setLoading(false);
    }
  }, [stopCamera]);

  // Setup dual decoding engines (ZXing + Native BarcodeDetector fallback)
  const setupDecodingEngine = () => {
    const ZXing = (window as any).ZXing;

    // Method 1: Use ZXing (identical to mobile_scanner in Flutter)
    if (ZXing && ZXing.BrowserMultiFormatReader) {
      try {
        const hints = new Map();
        // Optimize for retail barcodes
        const formats = [
          ZXing.BarcodeFormat.EAN_13,
          ZXing.BarcodeFormat.EAN_8,
          ZXing.BarcodeFormat.UPC_A,
          ZXing.BarcodeFormat.UPC_E,
          ZXing.BarcodeFormat.CODE_128,
          ZXing.BarcodeFormat.CODE_39,
          ZXing.BarcodeFormat.QR_CODE,
          ZXing.BarcodeFormat.ITF,
        ];
        hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, formats);
        hints.set(ZXing.DecodeHintType.TRY_HARDER, true);

        const reader = new ZXing.BrowserMultiFormatReader(hints, 200);
        zxingReaderRef.current = reader;

        reader.decodeFromVideoElement(videoRef.current, (result: any, err: any) => {
          if (result && result.getText()) {
            handleDetected(result.getText());
          }
        });
        return;
      } catch (e) {
        console.warn('ZXing init fallback to BarcodeDetector:', e);
      }
    }

    // Method 2: Native BarcodeDetector API
    if ('BarcodeDetector' in window) {
      try {
        const detector = new (window as any).BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'],
        });

        intervalRef.current = setInterval(async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) return;
          try {
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes && barcodes.length > 0) {
              const raw = barcodes[0].rawValue;
              if (raw) handleDetected(raw);
            }
          } catch {
            // frame detection error
          }
        }, 180);
        return;
      } catch (e) {
        console.warn('BarcodeDetector error:', e);
      }
    }

    // Method 3: Fallback warning if neither engine available
    setCameraError('Please use a modern browser (Chrome, Edge, or Safari) for live camera decoding, or upload an image.');
  };

  // Toggle Torch / Flashlight
  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (track) {
      const nextState = !torchOn;
      try {
        await (track as any).applyConstraints({
          advanced: [{ torch: nextState }],
        });
        setTorchOn(nextState);
      } catch (e) {
        console.error('Torch toggle failed:', e);
      }
    }
  };

  // Switch between cameras
  const switchCamera = () => {
    if (availableDevices.length <= 1) return;
    const nextIndex = (currentDeviceIndex + 1) % availableDevices.length;
    setCurrentDeviceIndex(nextIndex);
    startCamera(nextIndex);
  };

  // Toggle Zoom level (1x -> 2x -> 1x)
  const toggleZoom = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (track && zoomSupported) {
      const nextZoom = zoomLevel === 1 ? Math.min(2, maxZoom) : 1;
      try {
        await (track as any).applyConstraints({
          advanced: [{ zoom: nextZoom }],
        });
        setZoomLevel(nextZoom);
      } catch (e) {
        console.error('Zoom constraint failed:', e);
      }
    }
  };

  // Image Upload Fallback
  const handleFileUpload = async (event: any) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const ZXing = (window as any).ZXing;
    if (ZXing && ZXing.BrowserMultiFormatReader) {
      try {
        const reader = new ZXing.BrowserMultiFormatReader();
        const img = new Image();
        img.src = URL.createObjectURL(file);
        img.onload = async () => {
          try {
            const result = await reader.decodeFromImageElement(img);
            if (result && result.getText()) {
              handleDetected(result.getText());
            } else {
              setCameraError('No barcode recognized in the image.');
            }
          } catch {
            setCameraError('Could not decode barcode from this image.');
          }
        };
        return;
      } catch {
        // fallback
      }
    }

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
        setCameraError('Could not decode barcode from image.');
      }
    }
  };

  useEffect(() => {
    if (visible) {
      startCamera(0);
    } else {
      stopCamera();
      setFeedback(null);
      setCameraError(null);
    }
    return () => {
      stopCamera();
    };
  }, [visible, startCamera, stopCamera]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={() => { stopCamera(); onClose(); }}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Top Bar matching Flutter POS Scanner */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerTitle}>{title}</Text>
              <Text style={styles.headerSub}>
                {continuous ? 'Continuous POS scan mode' : 'Hold barcode inside the box'}
              </Text>
            </View>

            <View style={styles.headerControls}>
              {/* Torch button */}
              {hasTorch && (
                <TouchableOpacity
                  style={[styles.controlBtn, torchOn && styles.controlBtnActive]}
                  onPress={toggleTorch}
                >
                  <Text style={styles.controlIcon}>{torchOn ? '🔦' : '⚡'}</Text>
                </TouchableOpacity>
              )}

              {/* Zoom button */}
              {zoomSupported && (
                <TouchableOpacity
                  style={[styles.controlBtn, zoomLevel > 1 && styles.controlBtnActive]}
                  onPress={toggleZoom}
                >
                  <Text style={styles.controlText}>{zoomLevel}x</Text>
                </TouchableOpacity>
              )}

              {/* Switch camera */}
              {availableDevices.length > 1 && (
                <TouchableOpacity style={styles.controlBtn} onPress={switchCamera}>
                  <Text style={styles.controlIcon}>🔄</Text>
                </TouchableOpacity>
              )}

              {/* Close */}
              <TouchableOpacity onPress={() => { stopCamera(); onClose(); }} style={styles.closeBtn}>
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* High-Resolution Viewfinder */}
          <View style={styles.viewport}>
            <video
              ref={videoRef}
              style={{
                width: '100%',
                height: 380,
                objectFit: 'cover',
                backgroundColor: '#000',
              }}
              playsInline
              muted
            />

            {loading && (
              <View style={styles.loaderOverlay}>
                <ActivityIndicator size="large" color="#10B981" />
                <Text style={styles.loaderText}>Starting camera…</Text>
              </View>
            )}

            {/* Target Reticle Overlay with Neon Green Corners */}
            <View style={styles.reticleOverlay} pointerEvents="none">
              <View style={styles.reticleBox}>
                <View style={[styles.corner, styles.tl]} />
                <View style={[styles.corner, styles.tr]} />
                <View style={[styles.corner, styles.bl]} />
                <View style={[styles.corner, styles.br]} />
                <View style={styles.laserLine} />
              </View>
              <Text style={styles.reticleHint}>Center barcode in the box</Text>
            </View>
          </View>

          {/* Live Feedback Toast */}
          {feedback && (
            <View style={styles.feedbackBanner}>
              <Text style={styles.feedbackText}>{feedback}</Text>
            </View>
          )}

          {/* Error Banner */}
          {cameraError && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{cameraError}</Text>
            </View>
          )}

          {/* Bottom Bar */}
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
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.MD,
  },
  container: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#111827',
    borderRadius: RADIUS.LG,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#374151',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.MD,
    paddingVertical: 12,
    backgroundColor: '#1f2937',
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f9fafb',
  },
  headerSub: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 2,
  },
  headerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  controlBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlBtnActive: {
    backgroundColor: '#10B981',
  },
  controlIcon: {
    fontSize: 16,
  },
  controlText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 6,
    marginLeft: 4,
  },
  closeText: {
    fontSize: 18,
    color: '#9ca3af',
    fontWeight: '600',
  },
  viewport: {
    position: 'relative',
    height: 380,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loaderText: {
    color: '#fff',
    fontSize: 13,
    marginTop: 10,
    fontWeight: '600',
  },
  reticleOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  reticleBox: {
    width: 260,
    height: 160,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#10B981',
  },
  tl: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 },
  tr: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 },
  br: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },
  laserLine: {
    width: '100%',
    height: 2,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    shadowColor: '#ef4444',
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },
  reticleHint: {
    color: '#fff',
    fontSize: 12,
    marginTop: 16,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
  },
  feedbackBanner: {
    backgroundColor: '#065f46',
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  feedbackText: {
    color: '#34d399',
    fontWeight: '700',
    fontSize: 13,
  },
  errorBanner: {
    backgroundColor: '#7f1d1d',
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 12,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: SPACING.MD,
    backgroundColor: '#1f2937',
    borderTopWidth: 1,
    borderTopColor: '#374151',
    gap: 10,
  },
  uploadBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: RADIUS.MD,
    backgroundColor: '#374151',
    alignItems: 'center',
  },
  uploadBtnText: {
    color: '#f9fafb',
    fontWeight: '600',
    fontSize: 13,
  },
  doneBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: RADIUS.MD,
    backgroundColor: '#10B981',
    alignItems: 'center',
  },
  doneBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
});

export default BarcodeScannerModal;
