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

const STORAGE_CAMERA_KEY = 'shopledger_preferred_camera_id';

function getStoredCameraId(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_CAMERA_KEY);
  } catch {
    return null;
  }
}

function setStoredCameraId(id: string) {
  try {
    sessionStorage.setItem(STORAGE_CAMERA_KEY, id);
  } catch {
    // ignore
  }
}

/** Play real scan sound from flutter_billing_app with audio oscillator fallback */
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
    audio.play().catch(() => playBeepFallback());
  } catch {
    playBeepFallback();
  }
}

function playBeepFallback() {
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
    // ignore
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
  const zxingReaderRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Keep callback refs stable to prevent camera teardown on parent re-renders
  const onScannedRef = useRef(onScanned);
  onScannedRef.current = onScanned;

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const continuousRef = useRef(continuous);
  continuousRef.current = continuous;

  const lastScannedCode = useRef<string>('');
  const lastScannedTime = useRef<number>(0);
  const activeDeviceIdRef = useRef<string | null>(getStoredCameraId());

  const [cameraActive, setCameraActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [adjustingNotice, setAdjustingNotice] = useState<string | null>(null);

  // Zoom & Focus states
  const [zoom, setZoom] = useState<number>(1.5);
  const [hardwareZoomSupported, setHardwareZoomSupported] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceIndex, setSelectedDeviceIndex] = useState(0);

  // Stop camera and decoding
  const stopScanner = useCallback(() => {
    if (zxingReaderRef.current) {
      try {
        if (typeof zxingReaderRef.current.reset === 'function') {
          zxingReaderRef.current.reset();
        }
      } catch {
        // ignore
      }
      zxingReaderRef.current = null;
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

  // Handle detected barcode with 2-second cooldown (exact Flutter logic)
  const handleDetected = useCallback((code: string) => {
    const clean = code.trim();
    if (!clean) return;
    const now = Date.now();

    // 2-second cooldown on same barcode to prevent multi-firing
    if (clean === lastScannedCode.current && now - lastScannedTime.current < 2000) {
      return;
    }
    lastScannedCode.current = clean;
    lastScannedTime.current = now;

    playScanSound();
    setFeedback(`✅ ${clean}`);
    setTimeout(() => {
      setFeedback(prev => (prev === `✅ ${clean}` ? null : prev));
    }, 1800);

    // Call parent handler without causing camera to restart or re-init
    onScannedRef.current(clean);

    if (!continuousRef.current) {
      setTimeout(() => {
        stopScanner();
        onCloseRef.current();
      }, 350);
    }
  }, [stopScanner]);

  // Apply Hardware / Software Zoom
  const applyZoom = useCallback(async (newZoom: number) => {
    setZoom(newZoom);
    const track = streamRef.current?.getVideoTracks()[0];
    if (track) {
      try {
        const caps = (track.getCapabilities ? track.getCapabilities() : {}) as any;
        if (caps.zoom) {
          const clamped = Math.max(caps.zoom.min || 1, Math.min(newZoom, caps.zoom.max || 3));
          await (track as any).applyConstraints({
            advanced: [{ zoom: clamped }],
          });
          setHardwareZoomSupported(true);
        } else {
          setHardwareZoomSupported(false);
        }
      } catch {
        setHardwareZoomSupported(false);
      }
    }
  }, []);

  // Auto-Adjust Focus, Exposure, and Zoom
  const autoAdjustCamera = useCallback(async () => {
    setAdjustingNotice('✨ Calibrating focus & auto-zoom…');
    const track = streamRef.current?.getVideoTracks()[0];
    if (track) {
      try {
        const caps = (track.getCapabilities ? track.getCapabilities() : {}) as any;
        const adv: any = {};
        if (caps.focusMode?.includes('continuous')) adv.focusMode = 'continuous';
        if (caps.exposureMode?.includes('continuous')) adv.exposureMode = 'continuous';
        if (caps.whiteBalanceMode?.includes('continuous')) adv.whiteBalanceMode = 'continuous';
        if (caps.pointsOfInterest) adv.pointsOfInterest = [{ x: 0.5, y: 0.5 }];
        if (caps.zoom) {
          const optimal = Math.min(2.0, caps.zoom.max || 2.0);
          adv.zoom = optimal;
          setZoom(optimal);
          setHardwareZoomSupported(true);
        } else {
          setZoom(2.0); // software 2x digital zoom
        }

        if (Object.keys(adv).length > 0) {
          await (track as any).applyConstraints({ advanced: [adv] });
        }
      } catch {
        setZoom(2.0);
      }
    } else {
      setZoom(2.0);
    }

    setTimeout(() => {
      setAdjustingNotice('✅ Camera focused & zoomed');
      setTimeout(() => setAdjustingNotice(null), 1800);
    }, 400);
  }, []);

  // Start Scanner with self-hosted ZXing engine & continuous auto-focus
  // PERSISTENT: remembers camera choice and ALWAYS defaults to rear/environment camera
  const startScanner = useCallback(async (explicitDeviceId?: string) => {
    stopScanner();
    setLoading(true);
    setCameraError(null);
    setFeedback(null);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('Camera access not supported in this browser.');
        setLoading(false);
        return;
      }

      // Step 1: Enumerate devices to identify rear camera explicitly
      let targetDeviceId = explicitDeviceId || getStoredCameraId();

      if (!targetDeviceId && navigator.mediaDevices.enumerateDevices) {
        try {
          const devs = await navigator.mediaDevices.enumerateDevices();
          const cams = devs.filter(d => d.kind === 'videoinput');
          const rearCam = cams.find(c => /back|rear|environment/i.test(c.label))
            || cams.find(c => c.label && !/front|user|selfie/i.test(c.label));
          if (rearCam?.deviceId) {
            targetDeviceId = rearCam.deviceId;
          }
        } catch {
          // ignore
        }
      }

      let videoConstraints: MediaTrackConstraints;
      if (targetDeviceId) {
        videoConstraints = { deviceId: { exact: targetDeviceId } };
      } else {
        videoConstraints = { facingMode: { ideal: 'environment' } };
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            ...videoConstraints,
            width: { ideal: 1920, min: 1280 },
            height: { ideal: 1080, min: 720 },
          },
          audio: false,
        });
      } catch (e: any) {
        // Fallback without exact constraint if device was busy or not found
        console.warn('Primary camera constraint failed, falling back:', e);
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1920, min: 1280 }, height: { ideal: 1080, min: 720 } },
          audio: false,
        });
      }
      streamRef.current = stream;

      // Step 2: Store the ACTUAL active device ID so subsequent operations lock to it
      const activeTrack = stream.getVideoTracks()[0];
      const settings = activeTrack?.getSettings?.() || {};
      const actualId = settings.deviceId || targetDeviceId;
      if (actualId) {
        setStoredCameraId(actualId);
        activeDeviceIdRef.current = actualId;
      }

      // Populate camera list with real labels now that camera permission is granted
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter(d => d.kind === 'videoinput');
        setVideoDevices(cameras);

        if (actualId) {
          const idx = cameras.findIndex(c => c.deviceId === actualId);
          if (idx >= 0) setSelectedDeviceIndex(idx);
        }
      } catch {
        // ignore enumeration errors
      }

      if (activeTrack) {
        const caps = (activeTrack.getCapabilities ? activeTrack.getCapabilities() : {}) as any;
        if ('torch' in caps) setHasTorch(true);

        // Auto-configure optimal focus and default 1.5x zoom
        const adv: any = {};
        if (caps.focusMode?.includes('continuous')) adv.focusMode = 'continuous';
        if (caps.exposureMode?.includes('continuous')) adv.exposureMode = 'continuous';
        if (caps.zoom) {
          const initialZoom = Math.min(1.5, caps.zoom.max || 1.5);
          adv.zoom = initialZoom;
          setZoom(initialZoom);
          setHardwareZoomSupported(true);
        } else {
          setZoom(1.5);
          setHardwareZoomSupported(false);
        }

        if (Object.keys(adv).length > 0) {
          activeTrack.applyConstraints({ advanced: [adv] }).catch(() => undefined);
        }
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
        setLoading(false);

        // Initialize ZXing MultiFormat Reader directly on video element using CONTINUOUS decoding
        const ZXing = (window as any).ZXing;
        if (ZXing && ZXing.BrowserMultiFormatReader) {
          const hints = new Map();
          hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [
            ZXing.BarcodeFormat.EAN_13,
            ZXing.BarcodeFormat.EAN_8,
            ZXing.BarcodeFormat.UPC_A,
            ZXing.BarcodeFormat.UPC_E,
            ZXing.BarcodeFormat.CODE_128,
            ZXing.BarcodeFormat.CODE_39,
            ZXing.BarcodeFormat.QR_CODE,
            ZXing.BarcodeFormat.ITF,
          ]);
          hints.set(ZXing.DecodeHintType.TRY_HARDER, true);

          const codeReader = new ZXing.BrowserMultiFormatReader(hints, 180);
          zxingReaderRef.current = codeReader;

          // Use continuous decoding so it never stops after 1 item
          codeReader.decodeFromVideoElementContinuously(videoRef.current, (result: any) => {
            if (result && result.getText()) {
              handleDetected(result.getText());
            }
          });
        } else if ('BarcodeDetector' in window) {
          // Native BarcodeDetector fallback
          const detector = new (window as any).BarcodeDetector({
            formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'],
          });
          const timer = setInterval(async () => {
            if (!videoRef.current || videoRef.current.readyState < 2) return;
            try {
              const codes = await detector.detect(videoRef.current);
              if (codes && codes.length > 0) {
                handleDetected(codes[0].rawValue);
              }
            } catch {
              // frame error
            }
          }, 180);
          (zxingReaderRef as any).current = { reset: () => clearInterval(timer) };
        }
      }
    } catch (err: any) {
      console.error('Camera start error:', err);
      setCameraError(err.message || 'Camera permission denied or camera device busy.');
      setLoading(false);
    }
  }, [handleDetected, stopScanner]);

  // Flashlight / Torch toggle
  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (track) {
      const next = !torchOn;
      try {
        await (track as any).applyConstraints({ advanced: [{ torch: next }] });
        setTorchOn(next);
      } catch (e) {
        console.error('Torch toggle failed:', e);
      }
    }
  };

  // Switch Camera to next available device & persist preference
  const switchCamera = () => {
    if (videoDevices.length <= 1) return;
    const nextIdx = (selectedDeviceIndex + 1) % videoDevices.length;
    setSelectedDeviceIndex(nextIdx);
    const target = videoDevices[nextIdx];
    if (target?.deviceId) {
      setStoredCameraId(target.deviceId);
      activeDeviceIdRef.current = target.deviceId;
      startScanner(target.deviceId);
    }
  };

  // Image Upload fallback
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
            const res = await reader.decodeFromImageElement(img);
            if (res && res.getText()) {
              handleDetected(res.getText());
            } else {
              setCameraError('No barcode recognized in image.');
            }
          } catch {
            setCameraError('Could not decode barcode from this photo.');
          }
        };
      } catch {
        setCameraError('Image processing error.');
      }
    }
  };

  // Camera lifecycle: ONLY starts when modal opens, stops when modal closes.
  // NEVER re-runs on parent re-renders or handler reference changes!
  useEffect(() => {
    if (visible) {
      startScanner();
    } else {
      stopScanner();
    }
    return () => {
      stopScanner();
    };
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={() => { stopScanner(); onCloseRef.current(); }}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header matching Flutter's ScannerPage */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => { stopScanner(); onCloseRef.current(); }} style={styles.backButton}>
              <Text style={styles.backIcon}>←</Text>
              <Text style={styles.title}>{title}</Text>
            </TouchableOpacity>

            <View style={styles.headerActions}>
              {/* Auto-Adjust Focus & Zoom */}
              <TouchableOpacity
                style={styles.autoAdjustBtn}
                onPress={autoAdjustCamera}
              >
                <Text style={styles.autoAdjustText}>✨ Auto-Focus</Text>
              </TouchableOpacity>

              {hasTorch && (
                <TouchableOpacity
                  style={[styles.actionBtn, torchOn && styles.actionBtnActive]}
                  onPress={toggleTorch}
                >
                  <Text style={styles.actionIcon}>{torchOn ? '🔦' : '⚡'}</Text>
                </TouchableOpacity>
              )}

              {videoDevices.length > 1 && (
                <TouchableOpacity style={styles.actionBtn} onPress={switchCamera}>
                  <Text style={styles.actionIcon}>🔄</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => fileInputRef.current?.click()}
              >
                <Text style={styles.actionIcon}>📁</Text>
              </TouchableOpacity>
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept="image/*"
                onChange={handleFileUpload}
              />
            </View>
          </View>

          {/* Full Camera Viewfinder with Digital/Hardware Zoom */}
          <View style={styles.viewport} onClick={autoAdjustCamera}>
            <div style={{ width: '100%', height: '100%', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <video
                ref={videoRef}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  backgroundColor: '#000',
                  transform: !hardwareZoomSupported && zoom > 1 ? `scale(${zoom})` : 'none',
                  transformOrigin: 'center center',
                  transition: 'transform 0.2s ease-out',
                }}
                playsInline
                muted
              />
            </div>

            {loading && (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color="#10B981" />
                <Text style={styles.loadingText}>Connecting camera…</Text>
              </View>
            )}

            {/* Target Reticle (exact Flutter Scanner style) */}
            <View style={styles.targetLayer} pointerEvents="none">
              <View style={styles.reticleBox}>
                {/* 4 White Corner L-shapes */}
                <View style={[styles.corner, styles.tl]} />
                <View style={[styles.corner, styles.tr]} />
                <View style={[styles.corner, styles.bl]} />
                <View style={[styles.corner, styles.br]} />
                {/* Red Laser Bar */}
                <View style={styles.laserBar} />
              </View>
              <Text style={styles.instructions}>Align barcode within frame</Text>
            </View>

            {/* Zoom selector pills (1.0x, 1.5x, 2.0x, 2.5x) */}
            <View style={styles.zoomBar}>
              {[1.0, 1.5, 2.0, 2.5].map((level) => (
                <TouchableOpacity
                  key={level}
                  style={[styles.zoomPill, zoom === level && styles.zoomPillActive]}
                  onPress={(e) => {
                    e.stopPropagation();
                    applyZoom(level);
                  }}
                >
                  <Text style={[styles.zoomPillText, zoom === level && styles.zoomPillTextActive]}>
                    {level.toFixed(1)}x
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Calibrating Notification */}
          {adjustingNotice && (
            <View style={styles.adjustingBanner}>
              <Text style={styles.adjustingText}>{adjustingNotice}</Text>
            </View>
          )}

          {/* Detected Feedback Toast */}
          {feedback && (
            <View style={styles.feedbackBanner}>
              <Text style={styles.feedbackText}>{feedback}</Text>
            </View>
          )}

          {/* Error Message */}
          {cameraError && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{cameraError}</Text>
            </View>
          )}

          {/* Bottom Bar */}
          <View style={styles.footer}>
            <Text style={styles.footerHint}>
              {continuous ? 'Continuous POS Mode: holds camera active' : 'Tap camera view to auto-focus'}
            </Text>
            <TouchableOpacity style={styles.doneBtn} onPress={() => { stopScanner(); onCloseRef.current(); }}>
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
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.SM,
  },
  container: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#0f172a',
    borderRadius: RADIUS.LG,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.MD,
    paddingVertical: 14,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backIcon: {
    fontSize: 20,
    color: '#38bdf8',
    fontWeight: 'bold',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f8fafc',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  autoAdjustBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#0284c7',
    marginRight: 4,
  },
  autoAdjustText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  actionBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnActive: {
    backgroundColor: '#10b981',
  },
  actionIcon: {
    fontSize: 15,
  },
  viewport: {
    position: 'relative',
    height: 400,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    cursor: 'pointer',
  },
  loadingBox: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 10,
  },
  targetLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  reticleBox: {
    width: 250,
    height: 250,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#22c55e',
  },
  corner: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderColor: '#ffffff',
  },
  tl: { top: -2, left: -2, borderTopWidth: 3, borderLeftWidth: 3 },
  tr: { top: -2, right: -2, borderTopWidth: 3, borderRightWidth: 3 },
  bl: { bottom: -2, left: -2, borderBottomWidth: 3, borderLeftWidth: 3 },
  br: { bottom: -2, right: -2, borderBottomWidth: 3, borderRightWidth: 3 },
  laserBar: {
    width: '100%',
    height: 2,
    backgroundColor: 'rgba(239, 68, 68, 0.95)',
    shadowColor: '#ef4444',
    shadowOpacity: 0.9,
    shadowRadius: 5,
  },
  instructions: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 18,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 16,
    paddingVertical: 5,
    borderRadius: 8,
  },
  zoomBar: {
    position: 'absolute',
    bottom: 12,
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    zIndex: 15,
  },
  zoomPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  zoomPillActive: {
    backgroundColor: '#10b981',
  },
  zoomPillText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '600',
  },
  zoomPillTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  adjustingBanner: {
    backgroundColor: '#0284c7',
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  adjustingText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 12,
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
    fontSize: 14,
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
    alignItems: 'center',
    paddingHorizontal: SPACING.MD,
    paddingVertical: 12,
    backgroundColor: '#1e293b',
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  footerHint: {
    fontSize: 11,
    color: '#94a3b8',
    flex: 1,
  },
  doneBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: RADIUS.MD,
    backgroundColor: '#10b981',
  },
  doneBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
});

export default BarcodeScannerModal;
