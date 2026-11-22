import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { THEME } from '../theme';

export const UdhaarScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleSpring = spring({ frame, fps, config: { damping: 14 } });

  const customers = [
    { name: 'Rajesh Kumar', phone: '90012 34567', due: '₹1,450', limit: '₹5,000', badge: 'VIP Regular' },
    { name: 'Sai Krishna Store', phone: '90012 34569', due: '₹3,200', limit: '₹10,000', badge: 'Small Shop' },
    { name: 'Hotel Spice Garden', phone: '90012 34570', due: '₹8,500', limit: '₹15,000', badge: 'Hotel' },
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
            color: '#F43F5E',
            fontSize: 22,
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}
        >
          CREDIT LEDGER & RECOVERY
        </span>
        <h2
          style={{
            fontSize: 64,
            fontWeight: 900,
            color: THEME.textLight,
            margin: '8px 0 0 0',
          }}
        >
          Smart Udhaar Khata & 1-Click WhatsApp
        </h2>
        <p style={{ fontSize: 24, color: THEME.textMuted, margin: '8px 0 0 0' }}>
          Say goodbye to lost paper slips. Track credit limits and collect dues with automated reminders.
        </p>
      </div>

      {/* Customer List Container */}
      <div
        style={{
          width: '100%',
          maxWidth: 1100,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {customers.map((c, i) => {
          const appear = interpolate(frame, [i * 15, i * 15 + 20], [0, 1], { extrapolateRight: 'clamp' });
          const slide = interpolate(frame, [i * 15, i * 15 + 20], [30, 0], { extrapolateRight: 'clamp' });
          return (
            <div
              key={i}
              style={{
                opacity: appear,
                transform: `translateY(${slide}px)`,
                backgroundColor: THEME.cardDark,
                borderRadius: 18,
                border: `1.5px solid ${THEME.borderDark}`,
                padding: '20px 28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                <div
                  style={{
                    width: 50,
                    height: 50,
                    borderRadius: 25,
                    backgroundColor: 'rgba(39, 168, 90, 0.15)',
                    color: THEME.primaryLight,
                    fontSize: 24,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                  }}
                >
                  {c.name[0]}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 22, fontWeight: 800, color: THEME.textLight }}>{c.name}</span>
                    <span
                      style={{
                        fontSize: 12,
                        padding: '3px 10px',
                        borderRadius: 999,
                        backgroundColor: THEME.surfaceDark,
                        color: THEME.accentGold,
                        fontWeight: 700,
                      }}
                    >
                      {c.badge}
                    </span>
                  </div>
                  <div style={{ fontSize: 15, color: THEME.textDim, marginTop: 4 }}>{c.phone} · Limit {c.limit}</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, color: '#F43F5E', fontWeight: 700 }}>DUE AMOUNT</div>
                  <div style={{ fontSize: 26, fontWeight: 900, color: THEME.textLight }}>{c.due}</div>
                </div>
                <div
                  style={{
                    padding: '10px 20px',
                    borderRadius: 12,
                    backgroundColor: '#1E8449',
                    color: '#FFFFFF',
                    fontWeight: 700,
                    fontSize: 16,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    boxShadow: '0 4px 14px rgba(30, 132, 73, 0.4)',
                  }}
                >
                  <span>💬</span> WhatsApp Reminder
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
