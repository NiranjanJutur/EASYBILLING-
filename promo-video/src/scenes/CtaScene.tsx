import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { THEME } from '../theme';

export const CtaScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({ frame, fps, config: { damping: 12, mass: 0.9 } });

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
      {/* Glow */}
      <div
        style={{
          position: 'absolute',
          width: 700,
          height: 700,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${THEME.primaryGlow} 0%, rgba(10,21,15,0) 70%)`,
          pointerEvents: 'none',
        }}
      />

      {/* Main Container */}
      <div
        style={{
          transform: `scale(${scale})`,
          textAlign: 'center',
          maxWidth: 1000,
          zIndex: 1,
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 22px',
            borderRadius: 999,
            background: 'rgba(245, 158, 11, 0.15)',
            border: `1.5px solid ${THEME.accentGold}`,
            color: THEME.accentGold,
            fontSize: 20,
            fontWeight: 800,
            marginBottom: 28,
          }}
        >
          <span>⭐ OPEN SOURCE ON GITHUB</span>
        </div>

        <h2
          style={{
            fontSize: 76,
            fontWeight: 900,
            color: THEME.textLight,
            margin: '0 0 20px 0',
            lineHeight: 1.15,
          }}
        >
          Join Us in Modernizing India’s Retail Ecosystem
        </h2>

        <p
          style={{
            fontSize: 28,
            color: THEME.textMuted,
            margin: '0 0 44px 0',
            lineHeight: 1.5,
          }}
        >
          Built for 12+ Million Kirana shops. We welcome contributors, UI designers, tester feedback & feature requests!
        </p>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 20, justifyContent: 'center' }}>
          <div
            style={{
              padding: '18px 36px',
              borderRadius: 18,
              backgroundColor: THEME.primary,
              border: `2px solid ${THEME.primaryLight}`,
              color: '#FFFFFF',
              fontSize: 24,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              boxShadow: `0 8px 30px ${THEME.primaryGlow}`,
            }}
          >
            <span>⭐ Star on GitHub</span>
          </div>

          <div
            style={{
              padding: '18px 36px',
              borderRadius: 18,
              backgroundColor: THEME.surfaceDark,
              border: `1.5px solid ${THEME.borderDark}`,
              color: THEME.textLight,
              fontSize: 24,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <span>💬 Discuss on Reddit</span>
          </div>
        </div>

        {/* Repo details footer */}
        <div
          style={{
            marginTop: 48,
            fontSize: 20,
            color: THEME.textDim,
            display: 'flex',
            gap: 24,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <span>React Native 0.84</span>
          <span>•</span>
          <span>Vite 7</span>
          <span>•</span>
          <span>TypeScript</span>
          <span>•</span>
          <span>github.com/NiranjanJutur/EASYBILLING-</span>
        </div>
      </div>
    </div>
  );
};
