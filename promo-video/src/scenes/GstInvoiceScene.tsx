import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { THEME } from '../theme';

export const GstInvoiceScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleSpring = spring({ frame, fps, config: { damping: 14 } });

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
          marginBottom: 36,
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
          COMPLIANCE & PAYMENTS
        </span>
        <h2
          style={{
            fontSize: 64,
            fontWeight: 900,
            color: THEME.textLight,
            margin: '8px 0 0 0',
          }}
        >
          GST Invoicing & Dynamic UPI QR
        </h2>
        <p style={{ fontSize: 24, color: THEME.textMuted, margin: '8px 0 0 0' }}>
          Supports Regular Tax Invoices and Composition "Bill of Supply" with zero manual calculations.
        </p>
      </div>

      {/* Bill Preview Card */}
      <div
        style={{
          width: '100%',
          maxWidth: 960,
          backgroundColor: '#FFFFFF',
          borderRadius: 20,
          padding: '30px 40px',
          color: '#14291E',
          boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
          transform: `scale(${interpolate(frame, [10, 35], [0.92, 1], { extrapolateRight: 'clamp' })})`,
          opacity: interpolate(frame, [10, 25], [0, 1], { extrapolateRight: 'clamp' }),
        }}
      >
        {/* Bill Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #EBF1EE', paddingBottom: 16 }}>
          <div>
            <div style={{ fontSize: 26, fontWeight: 900, color: '#1E6B3C' }}>SRI RAGHAVENDRA STORES</div>
            <div style={{ fontSize: 14, color: '#7A9485', marginTop: 4 }}>123 Main Road, Hubballi · GSTIN: 29ABCDE1234F1Z5</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div
              style={{
                display: 'inline-block',
                padding: '4px 14px',
                borderRadius: 8,
                backgroundColor: 'rgba(30, 107, 60, 0.1)',
                color: '#1E6B3C',
                fontWeight: 800,
                fontSize: 16,
              }}
            >
              TAX INVOICE
            </div>
            <div style={{ fontSize: 13, color: '#7A9485', marginTop: 4 }}>Bill #9024 · 22-Nov-2026</div>
          </div>
        </div>

        {/* Bill Summary Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 }}>
          <div style={{ display: 'flex', gap: 32 }}>
            <div>
              <div style={{ fontSize: 12, color: '#7A9485', fontWeight: 700, textTransform: 'uppercase' }}>Taxable Value</div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>₹1,240.00</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#7A9485', fontWeight: 700, textTransform: 'uppercase' }}>CGST (2.5%)</div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>₹32.50</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#7A9485', fontWeight: 700, textTransform: 'uppercase' }}>SGST (2.5%)</div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>₹32.50</div>
            </div>
          </div>

          {/* Dynamic UPI Section */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              padding: '10px 18px',
              backgroundColor: '#F5F3FF',
              borderRadius: 14,
              border: '1.5px solid #DDD6FE',
            }}
          >
            <div
              style={{
                width: 54,
                height: 54,
                backgroundColor: '#FFFFFF',
                borderRadius: 8,
                border: '1px solid #7C3AED',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 28,
              }}
            >
              🏁
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#7C3AED', fontWeight: 800 }}>SCAN TO PAY VIA ANY UPI</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#4C1D95' }}>raghavendra@upi</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
