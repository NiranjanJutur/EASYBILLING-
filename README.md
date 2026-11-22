🏪 EasyBilling (ShopLedger)

An open-source, 100% offline-first retail operating system & smart POS built for India's 12M+ Kirana and small retail stores.

License: MIT React Native Vite TypeScript Live Demo

🌐 Live Web Demo

Try the live Web POS right in your browser (no installation required):
👉 https://easybilling-green.vercel.app/

📸 Screenshots
Welcome & Language	PIN Login
<img src="docs/screenshots/01_welcome_registration.png" alt="Welcome and language selection" width="400">	<img src="docs/screenshots/02_login_4digit_pin.png" alt="4-digit PIN login" width="400">
POS Billing	Udhaar Customer Ledger
<img src="docs/screenshots/03_pos_billing_screen.png" alt="POS billing screen" width="400">	<img src="docs/screenshots/04_udhaar_customers_ledger.png" alt="Udhaar customers ledger" width="400">
🎥 Promo Video

Watch the 1080p walkthrough: docs/easybilling-promo.mp4

💡 To play it inline on GitHub, drag-and-drop the MP4 into the README editor on github.com. It uploads and inserts a playable link automatically.

🌟 Highlights
Fast billing: Create GST-ready invoices for in-store, takeaway, delivery, and wholesale orders.
Flexible payments: Record cash, UPI, card, credit (udhaar), or split payments. Dynamic UPI QR codes generated for exact bill totals.
Invoices you can use: Share clean text receipts, send via WhatsApp or device share sheets, and generate printable PDF invoices.
GST support: Store customer GSTIN details, item tax rates, invoice tax summaries, and compliance-ready bill information. Supports both Regular (Tax Invoice) and Composition Scheme (Bill of Supply).
Inventory control: Manage products, stock, suppliers, purchases, restocking, and low-stock alerts.
Customer ledger (Udhaar): Keep customer profiles, credit balances, repayments, transaction history, and GSTIN details with WhatsApp payment reminders.
100% Offline-First: Local storage is the default (AsyncStorage / kvStore), so everyday billing continues seamlessly without an internet connection.
Strict 4-Digit PIN Security: No passwords required. Role-based views for Owner, Cashier, Stock Manager, and Accountant.
Multi-Language by Default: Full native UI support for 5 Indian languages: English, Kannada (ಕನ್ನಡ), Hindi (हिन्दी), Telugu (తెలుగు), and Marathi (मराठी).
Continuous Barcode Scanning: Powered by ZXing and Android Vision Camera with rear camera lens-locking to prevent camera-flipping glitches.
First-Launch Wizard: 6-step onboarding wizard gets any shop ready in 2 minutes.
📋 Comprehensive Feature List
Area	Included Capabilities
Billing	Cart management, item quantities, discounts, multi-slab taxes, bill numbers, order types, and completed-bill history
Payments	Cash, UPI, card, credit (udhaar), split settlement, and bill-total UPI QR codes
Invoices	GST tax invoice, Bill of Supply (Composition), text receipt, WhatsApp/device sharing, PDF export, and thermal printing workflow (58mm/80mm)
Products & Stock	Product catalogue, barcode lookup, stock adjustments, suppliers, purchases, and restocking
Customers & Credit	Customer profiles, phone numbers, GSTIN input, credit limits, outstanding balances, repayments, and transaction history
GST & Compliance	36 Indian state codes, item GST rates, HSN-ready product data, tax totals, customer GSTINs, and compliance records
Reports	Owner dashboard, daily sales summaries, bill history, low-stock visibility, and accountant reports
Input Tools	Continuous rear-camera barcode scanning, camera capture, handwritten-slip processing, voice input, and manual catalogue search
AI Assistance	Optional product/slip recognition and stock insights when configured
Privacy & Local Mode	Local-first storage, generic demo data, and optional cloud synchronization via Supabase
📱 Screens & Views
First-Launch Onboarding: 6-step shop setup (Language, Shop Details, State GST, 4-digit PIN, UPI VPA)
Store Authentication: 4-digit PIN numeric keypad with store selector and language switcher
Home & Quick Actions: Today's sales metrics, quick scan, slip processing, new bill
Billing POS: Product catalogue grid, live stock indicators, active cart, and multi-mode payment checkout
Inventory Management: Products, stock alerts, suppliers, purchase entries, and godown stock
Customer Ledger (Udhaar): Customer profiles, credit limits, outstanding balances, and 1-click WhatsApp reminders
Owner Dashboard: Business compliance overview, daily sales summary, and revenue tracking
Accountant Dashboard: Tax slab breakdowns, CGST/SGST/IGST reports, and financial summaries
Store Settings: Shop information, staff PINs, and feature toggles
💼 Business Workflows
1. Daily POS Billing

Search, scan barcode, or speak an item; select the customer and order type; collect payment (Cash, UPI, Card, Udhaar, or Split); then share via WhatsApp or print the GST invoice. Completing a bill automatically updates local sales history and stock records.

2. Customer Credit (Udhaar Khata)

Set credit limits per customer, issue credit sales safely, and record repayments later. View outstanding balances and transaction history at the counter, with 1-click WhatsApp payment reminders with dynamic UPI QR codes.

3. Handwritten Customer Slips

Capture handwritten customer slips with device camera, review extracted items, correct quantities or prices, and send confirmed items straight to the billing cart.

4. Stock and Supplier Purchases

Maintain a product catalogue with purchase prices, selling prices, supplier details, GST rates, and reorder thresholds. Log supplier invoices and track supplier payables.

🚀 Running Locally
Prerequisites
Node.js 18+ (tested up to Node 24)
npm 9+
1. Clone & Install
bash
git clone https://github.com/NiranjanJutur/EASYBILLING-.git
cd EASYBILLING-
npm install --legacy-peer-deps
2. Configure Environment
bash
# Windows
copy .env.example .env

# macOS / Linux
cp .env.example .env

Note: The template default is DATA_MODE=LOCAL. No cloud account, API key, or database setup is required for local billing.

3. Start the Application

Web POS (Vite):

bash
npm run web:dev

Open http://localhost:5173 in your browser.

Android App (React Native):

bash
npm run android
☁️ Optional Cloud Sync

EasyBilling is local-first. Optional Supabase synchronization is available for multi-counter or multi-device setups:

Set DATA_MODE=SUPABASE in .env.
Add your public Supabase URL and anonymous key.
Database migrations and Edge Functions are located under supabase/.
🎬 Marketing & Promo Video (Remotion)

This repository includes an automated video generator built with Remotion:

bash
cd promo-video
npm install
npm start       # Interactive browser player (Remotion Studio)
npm run build   # Render 1080p Full HD MP4 video with upbeat music

See MARKETING_AND_REDDIT_GUIDE.md for ready-to-use launch templates and social media copy.

📁 Project Structure
text
src/
├── components/          # Reusable UI components (Barcode scanner modal, POS reticle)
├── config/              # Constants, themes, Indian state GST codes, environment
├── context/             # StoreContext, SessionContext
├── models/              # TypeScript interfaces (Product, Customer, Transaction, Registration)
├── navigation/          # React Navigation stacks (Owner, Cashier, Stock Manager, Accountant)
├── screens/             # Screen components (Auth, Billing, Inventory, Customers, Dashboard)
├── services/            # Billing taxCalc, invoiceTemplate, local kvStore, offline sync
└── utils/               # i18n translations (5 languages), currency formatters, ID generators
android/                 # Android native project files
promo-video/             # Remotion programmatic marketing video studio
__tests__/               # Jest test suites (tax calculation, registration security)
🤝 Contributing

Contributions are welcome! Please read CONTRIBUTING.md to get started. High-priority areas:

[ ] Thermal Receipt Printers: ESC/POS Bluetooth & USB drivers (58mm/80mm).
[ ] Voice-to-Cart: Offline voice-assisted item search (Web Speech API / Bhashini).
[ ] More Languages: Additional Indian regional languages (Tamil, Gujarati, Bengali, Malayalam).
[ ] Hardware Testing: Testing on various Android POS terminals and tablets.
📄 License

This project is licensed under the MIT License.
