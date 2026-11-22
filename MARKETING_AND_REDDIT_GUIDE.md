# 🚀 EasyBilling (ShopLedger) — Marketing & Contribution Playbook

This guide contains ready-to-copy marketing templates, Reddit posts, and GitHub README embeds for promoting **EasyBilling (ShopLedger)** to open-source developers, contributors, and retail owners.

---

## 📽️ Video Asset Details

- **File Path:** `promo-video/out/easybilling-promo.mp4`
- **Audio:** Upbeat background commercial track mixed with smooth fade-in/out
- **Specs:** 1920 × 1080 (Full HD), 30 FPS, ~34 seconds, H.264 MP4 (4.9 MB)
- **Format:** Accepted natively by Reddit, Twitter/X, LinkedIn, and GitHub Releases / README assets.

---

## 📸 Captured App Screenshots (Ready for Reddit & GitHub)

The following high-resolution screenshots were captured from the live application and saved in `screenshots/`:

| # | View | Description | File |
|---|------|-------------|------|
| 1 | **Welcome & Language** | 5-language selector (English, ಕನ್ನಡ, हिन्दी, తెలుగు, मराठी) & value props | `screenshots/01_welcome_registration.png` |
| 2 | **4-Digit PIN Login** | Forest-green store login with custom on-screen 4-digit PIN pad | `screenshots/02_login_4digit_pin.png` |
| 3 | **Cashier POS Billing** | Product catalog grid, stock warnings, active cart, and tax totals | `screenshots/03_pos_billing_screen.png` |
| 4 | **Udhaar / Credit Khata** | Customer ledger with debt badges, credit limits, and WhatsApp reminders | `screenshots/04_udhaar_customers_ledger.png` |

---

## 📝 1. Reddit Post: `r/developersIndia` & `r/SideProject`

**Title Options (pick one):**
1. *I built an open-source, 100% offline-first POS & GST billing app for Indian Kirana stores [React Native + Web]*
2. *Show r/developersIndia: EasyBilling — Modernizing Kirana store billing, udhaar khatas & barcode scanning (Open Source)*
3. *We built an open-source retail OS for India’s 12M+ small shops. Looking for contributors & feedback!*

**Body Copy (Markdown ready):**

```markdown
Hey folks! 👋

Most billing software available for small grocery and retail shops in India is either bloated, requires continuous internet, costs thousands in yearly renewals, or looks like it was built in 2004.

To solve this, I've been building **EasyBilling (ShopLedger)** — an open-source, modern, smart retail operating system built specifically for Indian retail shops and Kirana stores.

### 🎥 [Watch the 30s Demo Video attached]

### 💡 Core Features:
1. **100% Offline-First Local Mode:** Runs entirely on-device with zero internet required. Never stops billing even if Wi-Fi or mobile data drops. (Optional Supabase cloud sync when needed).
2. **First-Launch Onboarding Wizard:** Ready in 2 minutes. No passwords or complicated setup. 4-digit PIN security (with smart rejection of weak PINs like 1234/0000/birth years).
3. **Multi-Language by Default:** Full UI translations in **English, Kannada (ಕನ್ನಡ), Hindi (हिन्दी), Telugu (తెలుగు), and Marathi (मराठी)**.
4. **Continuous Rear-Camera Barcode Scanner:** Real-time decoding powered by ZXing and Android Vision Camera with zero camera switching glitches.
5. **Smart GST Engine:** Automatic CGST/SGST/IGST breakdown with 36 Indian state codes. Supports both **Regular (Tax Invoice)** and **Composition Scheme (Bill of Supply)**.
6. **Digital Udhaar Khata:** Customer credit tracking, balance clamping, and 1-click WhatsApp payment reminders with dynamic UPI QR codes.

### 🛠️ Tech Stack:
- **Mobile:** React Native 0.84, TypeScript, React 19
- **Web POS:** Vite Web, React-Native-Web, Service Workers
- **Database:** Local kvStore / AsyncStorage (offline) + Supabase Edge Functions (optional cloud)
- **Video Generator:** Remotion & Shotcraft

### 🤝 How you can contribute:
The project is completely open source under MIT. We would love contributions for:
- 🖨️ ESC/POS Bluetooth & USB thermal receipt printer drivers
- 🗣️ Voice-to-add item recognition (Bhashini / Web Speech)
- 🌐 More Indian regional languages (Tamil, Gujarati, Bengali, etc.)
- 🧪 Testing on various Android devices and giving UI feedback

🔗 **GitHub Repo:** https://github.com/NiranjanJutur/EASYBILLING-  
🌐 **Live Web POS:** https://easybilling-green.vercel.app/

Would love your thoughts, feedback, and contributions! ⭐
```

---

## 📝 2. Reddit Post: `r/reactnative` & `r/opensource`

**Title:** *Showcase: EasyBilling — Open Source Offline-First POS & GST Engine (React Native 0.84 + Vite Web)*

**Body Copy:**

```markdown
Hey everyone!

Sharing our open-source project **EasyBilling**: a cross-platform retail management system built with React Native for Android and Vite Web for desktop POS terminals from a unified codebase.

### Highlights:
- Dual-target architecture (`.web.tsx` platform files for Vite, native for APK)
- Continuous code scanning reticle without re-render camera flips
- State-aware GST tax calculation with round-off algorithms and amount-in-words converter
- Programmatic marketing videos rendered with Remotion

Looking for fellow React Native devs to review PRs, help with thermal printer adapters, and test Android builds.

⭐ **Repo:** https://github.com/NiranjanJutur/EASYBILLING-  
🚀 **Live Demo:** https://easybilling-green.vercel.app/
```

---

## 🌐 3. GitHub README Embed Snippet

Add this section near the top of your `README.md`:

```markdown
## 🎬 Watch the Demo

https://github.com/user-attachments/assets/your-video-link-here

> *A 30-second walkthrough of EasyBilling: 2-minute onboarding, continuous barcode scanning, GST tax invoicing, and digital Udhaar Khata.*
```
*(Tip: Drag and drop `promo-video/out/easybilling-promo.mp4` into any GitHub issue or PR description, and GitHub will host it with an `mp4` video player embed!)*
