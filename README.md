# 🏪 EasyBilling (ShopLedger)

> An open-source, 100% offline-first retail operating system & smart POS built for India's 12M+ Kirana and small retail stores.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![React Native](https://img.shields.io/badge/React%20Native-0.84-blue.svg)](https://reactnative.dev/)
[![Vite](https://img.shields.io/badge/Vite-7.0-purple.svg)](https://vitejs.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![Live Demo](https://img.shields.io/badge/Live%20Demo-Vercel-black.svg)](https://easybilling-green.vercel.app/)

---

## 🌐 Live Web Demo

Try the live Web POS right in your browser (no installation required):  
👉 **[easybilling-green.vercel.app](https://easybilling-green.vercel.app/)**

---

## 🌟 Key Highlights

- **⚡ 100% Offline-First Local Architecture:** Operates entirely on device memory and local storage (`AsyncStorage` / `kvStore`). Never stops billing even if internet or Wi-Fi drops. (Optional Supabase cloud sync for multi-counter shops).
- **🚀 2-Minute Onboarding Wizard:** First launch wizard gets the store ready in 2 minutes. Configures shop profile, 36 Indian state GST codes, UPI VPA, and a **4-digit PIN** (with smart blocking of weak PINs like `1234`, `0000`, and birth years).
- **🌐 5 Indian Regional Languages:** Full native UI support for:
  - English
  - Kannada (ಕನ್ನಡ)
  - Hindi (हिन्दी)
  - Telugu (తెలుగు)
  - Marathi (मराठी)
- **📷 Continuous Rear-Camera Barcode Scanner:** Real-time decoding powered by ZXing and Android Vision Camera with exact lens-locking to prevent camera-flipping glitches.
- **📋 Smart Indian GST Compliance:** Full CGST/SGST/IGST breakdown with round-off and amount-in-words converter. Automatically issues **"Bill of Supply"** for Composition Scheme dealers and **"Tax Invoice"** for Regular GST shops.
- **📒 Smart Udhaar Khata (Credit Ledger):** Digital credit tracking with customizable limits, balance safeguards, and 1-click **WhatsApp payment reminders** with dynamic UPI QR codes.
- **🖨️ Thermal Printing & PDF Receipts:** Formatted for standard 2-inch (58mm) and 3-inch (80mm) thermal receipt printers, as well as printable PDFs with QR codes.

---

## 🛠️ Feature Overview

| Area | Features |
|---|---|
| **POS Billing** | Fast cart management, item quantity stepper, weight-based & piece-based pricing, instant search, barcode scan trigger, and multi-mode settlement. |
| **Payment Modes** | Cash, UPI, Card, Udhaar (Credit), and Split settlement with dynamic bill-total UPI QR codes. |
| **GST & Compliance** | 36 Indian state codes, HSN codes, multi-slab tax breakdowns, customer GSTIN verification, and Composition Scheme support. |
| **Customer Credit (Udhaar)** | Profile management, credit limits, outstanding balances, repayment history, and WhatsApp reminder buttons. |
| **Inventory & Purchasing** | Low-stock alerts, supplier tracking, purchase entries, and stock adjustments. |
| **Security & Roles** | Strictly 4-digit PIN login with roles for Owner, Cashier, Stock Manager, and Accountant. |

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ (tested up to Node 24)
- npm 9+

### 1. Clone & Install
```bash
git clone https://github.com/NiranjanJutur/EASYBILLING-.git
cd EASYBILLING-
npm install --legacy-peer-deps
```

### 2. Configure Environment
```bash
# Windows
copy .env.example .env

# macOS / Linux
cp .env.example .env
```
*Note: The default `.env` is configured for `DATA_MODE=LOCAL`, requiring no external database or API keys.*

### 3. Run Locally

**Run Web POS (Vite):**
```bash
npm run web:dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

**Run Android App (React Native):**
```bash
npm run android
```

---

## 🔐 Default Demo PINs (Local Mode)

| Role | 4-Digit PIN | Permissions |
|---|---|---|
| **Owner** | `1990` *(or custom set during registration)* | Full administrative access, settings, PIN management |
| **Cashier** | `2001` | Fast POS billing, customer checkout, payment collection |
| **Stock Manager** | `1985` | Product catalog, supplier orders, purchase entries |
| **Accountant** | `1995` | Tax summaries, daily sales reports, compliance view |

---

## 🎬 Marketing & Promo Video (Remotion)

This repository includes a programmatic marketing video studio powered by [Remotion](https://remotion.dev):

```bash
cd promo-video
npm install
npm start # Interactive Remotion Studio player
npm run build # Render Full HD MP4 video
```
Check [MARKETING_AND_REDDIT_GUIDE.md](MARKETING_AND_REDDIT_GUIDE.md) for ready-to-use launch templates and social media copy.

---

## 🤝 Contributing

We welcome contributions from developers, designers, and store owners! 

Check out [CONTRIBUTING.md](CONTRIBUTING.md) to get started. High-priority areas where you can help:
- [ ] **Thermal Printer Drivers:** ESC/POS Bluetooth & USB drivers for Android and Web.
- [ ] **Voice-to-Cart:** Offline voice-assisted item lookup (Web Speech API / Bhashini).
- [ ] **More Languages:** Bengali, Tamil, Gujarati, Malayalam, and Odia translations.
- [ ] **Device Testing:** Real-world testing across different Android phones, tablets, and POS devices.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
