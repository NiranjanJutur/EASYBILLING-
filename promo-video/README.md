# 🎬 EasyBilling (ShopLedger) — Remotion Promo Video

Programmatic marketing and contribution promo video created using **Remotion** and shotcraft principles.

## 🌟 Video Overview

- **Duration:** ~34.3 seconds (1030 frames @ 30fps)
- **Resolution:** 1920 × 1080 (16:9 Full HD)
- **Target Audience:** GitHub developers, Reddit (`r/developersIndia`, `r/reactnative`, `r/opensource`), and retail store owners.

### 6-Scene Shotcraft Breakdown:
1. **0:00 - 0:05 | The Hook:** "⚡ Open Source Smart Retail POS" with forest-green brand styling and platform badges (Android APK + Web POS).
2. **0:05 - 0:11 | 2-Minute Onboarding:** 5 Indian languages (English, Kannada, Hindi, Telugu, Marathi), 4-digit PIN security, and GSTIN state validation.
3. **0:11 - 0:17 | Continuous Barcode Scanner:** Camera locked to rear lens without switching, real-time laser scan reticle, live cart updates.
4. **0:17 - 0:23 | GST Invoicing & Dynamic UPI:** Automatic CGST/SGST/IGST split, Composition "Bill of Supply", scan-to-pay UPI QR.
5. **0:23 - 0:28 | Smart Udhaar Khata:** Customer credit limits, balance tracking, and 1-click WhatsApp payment reminders.
6. **0:28 - 0:34 | Open Source Call to Action:** "Star on GitHub", contributor invitation, tech stack highlights.

---

## 🚀 How to Run & Render

### 1. Interactive Web Preview (Watch in Browser)
Launch the interactive Remotion Studio player with live scrubbing:
```bash
cd promo-video
npm start
```
Open [http://localhost:3000](http://localhost:3000) to view, pause, and preview frame-by-frame.

### 2. Render MP4 Video (for Reddit / YouTube / Twitter)
```bash
cd promo-video
npm run build
```
The output file will be saved to:
`promo-video/out/easybilling-promo.mp4`

### 3. Render Animated GIF (for GitHub README)
```bash
cd promo-video
npm run render-gif
```
The output file will be saved to:
`promo-video/out/easybilling-promo.gif`
