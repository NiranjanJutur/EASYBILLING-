import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { THEME } from '../theme';

export const OnboardingScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleSpring = spring({ frame, fps, config: { damping: 14 } });

  const languages = [
    { native: 'English', sub: 'EN' },
    { native: 'ಕನ್ನಡ', sub: 'Kannada' },
    { native: 'हिन्दी', sub: 'Hindi' },
    { native: 'తెలుగు', sub: 'Telugu' },
    { native: 'मराठी', sub: 'Marathi' },
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
          marginBottom: 44,
        }}
      >
        <span
          style={{
            color: THEME.accentGold,
            fontSize: 22,
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}
        >
          STEP 1 · READY IN 2 MINUTES
        </span>
        <h2
          style={{
            fontSize: 64,
            fontWeight: 900,
            color: THEME.textLight,
            margin: '8px 0 0 0',
          }}
        >
          First-Launch Registration Wizard
        </h2>
        <p style={{ fontSize: 24, color: THEME.textMuted, margin: '8px 0 0 0' }}>
          No passwords. No external dependencies. Local 4-digit PIN security.
        </p>
      </div>

      {/* Main Showcase Cards Row */}
      <div style={{ display: 'flex', gap: 32, width: '100%', maxWidth: 1300, justifyContent: 'center' }}>
        {/* Card 1: Multi-language Support */}
        <div
          style={{
            flex: 1,
            backgroundColor: THEME.cardDark,
            border: `1.5px solid ${THEME.borderDark}`,
            borderRadius: 24,
            padding: 32,
            boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
            transform: `translateY(${interpolate(frame, [10, 30], [40, 0], { extrapolateRight: 'clamp' })}px)`,
            opacity: interpolate(frame, [10, 25], [0, 1], { extrapolateRight: 'clamp' }),
          }}
        >
          <div style={{ fontSize: 36, marginBottom: 12 }}>🌐</div>
          <h3 style={{ fontSize: 28, fontWeight: 800, color: THEME.textLight, margin: '0 0 16px 0' }}>
            5 Indian Languages
          </h3>
          <p style={{ fontSize: 18, color: THEME.textMuted, lineHeight: 1.5, marginBottom: 20 }}>
            Every screen, receipt, and navigation label is translated natively for local shopkeepers.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {languages.map((l, i) => (
              <div
                key={i}
                style={{
                  padding: '8px 16px',
                  borderRadius: 12,
                  background: i === 1 ? THEME.primary : THEME.surfaceDark,
                  border: `1px solid ${i === 1 ? THEME.primaryLight : THEME.borderDark}`,
                  color: THEME.textLight,
                  fontWeight: 700,
                  fontSize: 18,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span>{l.native}</span>
                <span style={{ fontSize: 13, opacity: 0.7 }}>({l.sub})</span>
              </div>
            ))}
          </div>
        </div>

        {/* Card 2: 4-Digit Owner PIN */}
        <div
          style={{
            flex: 1,
            backgroundColor: THEME.cardDark,
            border: `1.5px solid ${THEME.borderDark}`,
            borderRadius: 24,
            padding: 32,
            boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
            transform: `translateY(${interpolate(frame, [20, 40], [40, 0], { extrapolateRight: 'clamp' })}px)`,
            opacity: interpolate(frame, [20, 35], [0, 1], { extrapolateRight: 'clamp' }),
          }}
        >
          <div style={{ fontSize: 36, marginBottom: 12 }}>🔒</div>
          <h3 style={{ fontSize: 28, fontWeight: 800, color: THEME.textLight, margin: '0 0 16px 0' }}>
            4-Digit PIN Security
          </h3>
          <p style={{ fontSize: 18, color: THEME.textMuted, lineHeight: 1.5, marginBottom: 20 }}>
            Blocks weak patterns (`1234`, `0000`, birth years). Auto-submits on 4th digit for high-speed POS entry.
          </p>
          <div
            style={{
              display: 'flex',
              gap: 16,
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px 0',
              background: THEME.surfaceDark,
              borderRadius: 16,
              border: `1px solid ${THEME.borderDark}`,
            }}
          >
            {[0, 1, 2, 3].map(i => {
              const filled = i < Math.min(4, Math.floor(frame / 12));
              return (
                <div
                  key={i}
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    border: `2.5px solid ${filled ? THEME.primaryLight : THEME.textDim}`,
                    backgroundColor: filled ? THEME.primaryLight : 'transparent',
                    boxShadow: filled ? `0 0 14px ${THEME.primaryGlow}` : 'none',
                    transition: 'all 0.2s ease',
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* Card 3: GST & State Auto-detect */}
        <div
          style={{
            flex: 1,
            backgroundColor: THEME.cardDark,
            border: `1.5px solid ${THEME.borderDark}`,
            borderRadius: 24,
            padding: 32,
            boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
            transform: `translateY(${interpolate(frame, [30, 50], [40, 0], { extrapolateRight: 'clamp' })}px)`,
            opacity: interpolate(frame, [30, 45], [0, 1], { extrapolateRight: 'clamp' }),
          }}
        >
          <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
          <h3 style={{ fontSize: 28, fontWeight: 800, color: THEME.textLight, margin: '0 0 16px 0' }}>
            GSTIN Cross-Check
          </h3>
          <p style={{ fontSize: 18, color: THEME.textMuted, lineHeight: 1.5, marginBottom: 20 }}>
            36 Indian states & union territory codes. Automatically checks state code prefix against the 15-char GSTIN.
          </p>
          <div
            style={{
              padding: '16px 20px',
              borderRadius: 14,
              background: 'rgba(39, 168, 90, 0.1)',
              border: `1px solid ${THEME.primaryLight}`,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <div style={{ fontSize: 16, color: THEME.primaryLight, fontWeight: 700 }}>
              ✓ Verified GSTIN Format
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: 19, color: THEME.textLight }}>
              29ABCDE1234F1Z5 <span style={{ color: THEME.accentGold }}>(Karnataka 29)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
