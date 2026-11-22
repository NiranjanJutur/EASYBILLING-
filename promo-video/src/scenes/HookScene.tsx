import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { THEME } from '../theme';

export const HookScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrance spring
  const scale = spring({ frame, fps, config: { damping: 12, mass: 0.8 } });
  const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  const badgeOpacity = interpolate(frame, [25, 45], [0, 1], { extrapolateRight: 'clamp' });
  const subtitleY = interpolate(frame, [30, 50], [30, 0], { extrapolateRight: 'clamp' });

  // Floating ambient pulse
  const glowPulse = Math.sin(frame / 12) * 8 + 24;

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
        overflow: 'hidden',
      }}
    >
      {/* Background radial glow */}
      <div
        style={{
          position: 'absolute',
          width: 800,
          height: 800,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${THEME.primaryGlow} 0%, rgba(10,21,15,0) 70%)`,
          filter: `blur(${glowPulse}px)`,
          pointerEvents: 'none',
        }}
      />

      {/* Pill Badge */}
      <div
        style={{
          opacity: badgeOpacity,
          transform: `scale(${interpolate(frame, [25, 45], [0.8, 1], { extrapolateRight: 'clamp' })})`,
          padding: '10px 24px',
          borderRadius: 999,
          background: 'rgba(39, 168, 90, 0.15)',
          border: `1.5px solid ${THEME.primaryLight}`,
          color: THEME.primaryLight,
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom: 32,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <span>⚡ Open Source Smart Retail POS</span>
      </div>

      {/* Main Title */}
      <div
        style={{
          opacity,
          transform: `scale(${scale})`,
          textAlign: 'center',
        }}
      >
        <h1
          style={{
            fontSize: 96,
            fontWeight: 900,
            margin: 0,
            letterSpacing: '-0.03em',
            color: THEME.textLight,
            textShadow: '0 8px 32px rgba(0,0,0,0.8)',
          }}
        >
          EasyBilling{' '}
          <span
            style={{
              background: `linear-gradient(135deg, ${THEME.primaryLight} 0%, ${THEME.accentGold} 100%)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            (ShopLedger)
          </span>
        </h1>
      </div>

      {/* Tagline */}
      <div
        style={{
          opacity: interpolate(frame, [30, 50], [0, 1], { extrapolateRight: 'clamp' }),
          transform: `translateY(${subtitleY}px)`,
          marginTop: 24,
          maxWidth: 950,
          textAlign: 'center',
        }}
      >
        <p
          style={{
            fontSize: 34,
            fontWeight: 500,
            color: THEME.textMuted,
            margin: 0,
            lineHeight: 1.4,
          }}
        >
          Lightning-fast billing, 100% offline-first architecture, GST tax engine & Udhaar Khata for India’s retail shops.
        </p>
      </div>

      {/* Platform Chips */}
      <div
        style={{
          opacity: interpolate(frame, [50, 70], [0, 1], { extrapolateRight: 'clamp' }),
          display: 'flex',
          gap: 20,
          marginTop: 48,
        }}
      >
        {[
          { icon: '📱', label: 'Android APK (React Native)' },
          { icon: '💻', label: 'Web POS (Vite Web)' },
          { icon: '🔒', label: 'Zero-Cloud Local Mode' },
        ].map((item, i) => (
          <div
            key={i}
            style={{
              padding: '12px 22px',
              borderRadius: 16,
              background: THEME.surfaceDark,
              border: `1px solid ${THEME.borderDark}`,
              color: THEME.textLight,
              fontSize: 20,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            }}
          >
            <span style={{ fontSize: 24 }}>{item.icon}</span>
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
