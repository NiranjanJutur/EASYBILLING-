import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { THEME } from '../theme';

export const BarcodeScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleSpring = spring({ frame, fps, config: { damping: 14 } });

  // Laser scanner scan line animation
  const laserY = Math.sin(frame / 6) * 110 + 130;

  // Simulated items scanned
  const items = [
    { name: 'Basmati Rice 5kg', price: '₹450', gst: '5%', barcode: '8901030382910' },
    { name: 'Amul Butter 500g', price: '₹275', gst: '12%', barcode: '8901262010052' },
    { name: 'Tata Tea Gold 1kg', price: '₹580', gst: '5%', barcode: '8901052002341' },
  ];

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: THEME.bgDark,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: THEME.fontFamily,
        position: 'relative',
        padding: '0 80px',
      }}
    >
      {/* Header */}
      <div
        style={{
          transform: `scale(${titleSpring})`,
          textAlign: 'center',
          marginBottom: 40,
        }}
      >
        <span
          style={{
            color: THEME.primaryLight,
            fontSize: 22,
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}
        >
          CORE ENGINE · HIGH-SPEED POS
        </span>
        <h2
          style={{
            fontSize: 64,
            fontWeight: 900,
            color: THEME.textLight,
            margin: '8px 0 0 0',
          }}
        >
          Rear Camera Continuous Barcode Scanner
        </h2>
        <p style={{ fontSize: 24, color: THEME.textMuted, margin: '8px 0 0 0' }}>
          Zero camera switching glitches. Continuous ZXing POS decoding + Android Vision Camera.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 40, width: '100%', maxWidth: 1250, alignItems: 'center' }}>
        {/* Scanner Viewport Simulation */}
        <div
          style={{
            flex: 1.1,
            height: 380,
            backgroundColor: '#000000',
            borderRadius: 24,
            border: `2px solid ${THEME.primaryLight}`,
            position: 'relative',
            overflow: 'hidden',
            boxShadow: `0 0 35px ${THEME.primaryGlow}`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Target Reticle */}
          <div
            style={{
              width: 260,
              height: 260,
              border: `2px dashed ${THEME.textDim}`,
              borderRadius: 20,
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* Corner brackets */}
            <div style={{ position: 'absolute', top: -2, left: -2, width: 28, height: 28, borderTop: `4px solid ${THEME.primaryLight}`, borderLeft: `4px solid ${THEME.primaryLight}` }} />
            <div style={{ position: 'absolute', top: -2, right: -2, width: 28, height: 28, borderTop: `4px solid ${THEME.primaryLight}`, borderRight: `4px solid ${THEME.primaryLight}` }} />
            <div style={{ position: 'absolute', bottom: -2, left: -2, width: 28, height: 28, borderBottom: `4px solid ${THEME.primaryLight}`, borderLeft: `4px solid ${THEME.primaryLight}` }} />
            <div style={{ position: 'absolute', bottom: -2, right: -2, width: 28, height: 28, borderBottom: `4px solid ${THEME.primaryLight}`, borderRight: `4px solid ${THEME.primaryLight}` }} />

            {/* Red Laser Scan Line */}
            <div
              style={{
                position: 'absolute',
                top: laserY,
                left: 0,
                right: 0,
                height: 3,
                backgroundColor: '#EF4444',
                boxShadow: '0 0 12px #EF4444, 0 0 24px #EF4444',
              }}
            />

            {/* Barcode icon */}
            <div style={{ fontSize: 68, opacity: 0.35, color: '#FFFFFF' }}>||| | || |||</div>
          </div>

          {/* Scanner Status Badge */}
          <div
            style={{
              position: 'absolute',
              bottom: 20,
              padding: '8px 18px',
              borderRadius: 999,
              backgroundColor: 'rgba(39, 168, 90, 0.25)',
              border: `1px solid ${THEME.primaryLight}`,
              color: THEME.primaryLight,
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: '0.05em',
            }}
          >
            ● REAR CAMERA LOCKED · CONTINUOUS MODE
          </div>
        </div>

        {/* Live Cart Simulation */}
        <div
          style={{
            flex: 1,
            backgroundColor: THEME.cardDark,
            borderRadius: 24,
            border: `1.5px solid ${THEME.borderDark}`,
            padding: 28,
            boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ fontSize: 24, fontWeight: 800, color: THEME.textLight, margin: 0 }}>
              Live POS Cart
            </h3>
            <span style={{ fontSize: 16, color: THEME.primaryLight, fontWeight: 700 }}>
              3 items scanned
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {items.map((it, i) => {
              const show = frame > (i * 20 + 15);
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 18px',
                    borderRadius: 14,
                    background: THEME.surfaceDark,
                    border: `1px solid ${THEME.borderDark}`,
                    opacity: show ? 1 : 0.2,
                    transform: `translateX(${show ? 0 : 20}px)`,
                    transition: 'all 0.3s ease',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: THEME.textLight }}>{it.name}</div>
                    <div style={{ fontSize: 13, color: THEME.textDim, fontFamily: 'monospace' }}>{it.barcode}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: THEME.primaryLight }}>{it.price}</div>
                    <div style={{ fontSize: 12, color: THEME.accentGold }}>GST {it.gst}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Cart Total */}
          <div
            style={{
              marginTop: 20,
              paddingTop: 16,
              borderTop: `1px solid ${THEME.borderDark}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: 20, color: THEME.textMuted, fontWeight: 600 }}>Grand Total</span>
            <span style={{ fontSize: 32, color: THEME.textLight, fontWeight: 900 }}>₹1,305.00</span>
          </div>
        </div>
      </div>
    </div>
  );
};
