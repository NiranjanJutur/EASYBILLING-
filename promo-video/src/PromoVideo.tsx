import React from 'react';
import { Series } from 'remotion';
import { HookScene } from './scenes/HookScene';
import { OnboardingScene } from './scenes/OnboardingScene';
import { BarcodeScene } from './scenes/BarcodeScene';
import { GstInvoiceScene } from './scenes/GstInvoiceScene';
import { UdhaarScene } from './scenes/UdhaarScene';
import { CtaScene } from './scenes/CtaScene';

export const PromoVideo: React.FC = () => {
  return (
    <Series>
      {/* 1. Hook & Intro (5.0s) */}
      <Series.Sequence durationInFrames={150}>
        <HookScene />
      </Series.Sequence>

      {/* 2. Onboarding Wizard & PIN (6.0s) */}
      <Series.Sequence durationInFrames={180}>
        <OnboardingScene />
      </Series.Sequence>

      {/* 3. Barcode Scanner (6.0s) */}
      <Series.Sequence durationInFrames={180}>
        <BarcodeScene />
      </Series.Sequence>

      {/* 4. GST & Invoicing (5.6s) */}
      <Series.Sequence durationInFrames={170}>
        <GstInvoiceScene />
      </Series.Sequence>

      {/* 5. Udhaar & WhatsApp Ledger (5.6s) */}
      <Series.Sequence durationInFrames={170}>
        <UdhaarScene />
      </Series.Sequence>

      {/* 6. GitHub & Reddit Call to Action (6.0s) */}
      <Series.Sequence durationInFrames={180}>
        <CtaScene />
      </Series.Sequence>
    </Series>
  );
};
