# ShopLedger

**ShopLedger** is a local-first, open-source billing and shop-management app for small businesses. It runs on Android and the web, keeps business data on the device by default, and starts without a cloud account or API key.

## Highlights

- **Fast billing:** Create GST-ready invoices for in-store, takeaway, delivery, and wholesale orders.
- **Flexible payments:** Record cash, UPI, card, credit, or split payments. UPI payments can show a QR code for the final bill amount.
- **Invoices you can use:** Share a clean invoice message, send it through WhatsApp or the device share sheet, and create a printable PDF invoice.
- **GST support:** Store customer GSTIN details, item tax rates, invoice tax summaries, and compliance-ready bill information.
- **Inventory control:** Manage products, stock, suppliers, purchases, restocking, and low-stock-aware workflows.
- **Customer ledger:** Keep customer profiles, credit balances, payments, purchase history, and GSTIN information.
- **Udhaar control:** Set customer credit limits, record repayments, and see outstanding balances before accepting another credit sale.
- **Works offline:** Local storage is the default, so everyday billing continues without an internet connection.
- **Roles and PINs:** Owner, cashier, stock-manager, and accountant views keep everyday tasks focused.
- **Smart input:** Add products with barcode scanning, camera/slip capture, voice input, or manual catalogue search.

## Feature list

| Area | Included capabilities |
| --- | --- |
| Billing | Cart management, item quantities, discounts, taxes, bill numbers, order types, and completed-bill history |
| Payments | Cash, UPI, card, credit, split settlement, and a bill-total UPI QR/payment link |
| Invoices | GST tax invoice, text receipt, WhatsApp/device sharing, PDF export, and printing workflow |
| Products & stock | Product catalogue, barcode lookup, stock adjustments, suppliers, purchases, and restocking |
| Customers & credit | Customer profiles, phone details, GSTIN input, credit limits, outstanding balances, repayments, and transaction history |
| GST & compliance | Item GST rates, HSN-ready product data, tax totals, customer GSTINs, compliance records, and optional e-invoice/e-way-bill service integration |
| Reports | Owner dashboard, sales summaries, bill history, low-stock visibility, accountant reports, and compliance information |
| Input tools | Barcode scanning, camera capture, handwritten-slip processing, voice-assisted product selection, and manual catalogue search on compatible Android devices |
| AI assistance | Optional product/slip recognition and stock or expiry insights when the owner configures an AI integration |
| Privacy | Local-first storage, generic demo data, and optional—not required—cloud synchronization |

## Screens

- Home and quick scan
- Billing and bill history
- Inventory, products, suppliers, purchases, and godown stock
- Customers, credit ledger, and payment collection
- Owner dashboard with compliance information
- Accountant dashboard and reports
- Store settings and staff PIN management

## Business workflows

### Daily billing

Search, scan, or speak an item; select the customer and order type; collect payment; then share or print the finished GST invoice. Completing a bill updates the local sales history and stock records.

### Customer credit (udhaar)

Set a credit limit for a customer, sell on credit when appropriate, and record repayments later. The profile shows outstanding balance and purchase history so staff can make informed decisions at the counter.

### Handwritten customer slips

On supported devices, capture a customer slip, review the extracted items, correct anything that needs attention, and send the confirmed items to billing. AI-backed recognition is optional and requires the owner's own AI configuration.

### Stock and purchasing

Keep a product catalogue with stock, purchase and sale pricing, supplier details, GST information, and reorder workflows. Use the dashboard and reports to monitor stock, bills, and business activity.

## Run locally

```bash
git clone https://github.com/NiranjanJutur/EASYBILLING-.git
cd EASYBILLING-
npm install
```

Copy the local configuration template:

```bash
copy .env.example .env
```

The template already uses `DATA_MODE=LOCAL`. No Firebase, Supabase, AI key, or payment-service key is needed for local billing.

```bash
# Android device or emulator
npm run android

# Web
npm run web:dev
```

## Default demo PINs

| Role | PIN |
| --- | --- |
| Owner | `1990` |
| Cashier | `2001` |
| Stock manager | `1985` |
| Accountant | `1995` |

These are demo-only credentials. Change them before using the app for a real business.

## Optional cloud sync

ShopLedger is local-first. Optional Supabase synchronization is available for teams that want multi-device data sync. Add only your own public Supabase URL and anonymous key to `.env`; never commit `.env` or a service-role key.

## Roadmap

See [ROADMAP.md](ROADMAP.md) for planned open-source improvements, including more barcode-device testing, printable invoice customization, backups, accessibility, and translations.

## Project structure

```text
src/                 React Native and web application source
android/             Android native project
supabase/            Optional database schema and functions
__tests__/           Tests
```

## Privacy and security

This public repository contains generic demo business details only. It excludes local environment files, API keys, cloud configuration files, signing keys, build products, logs, and device data. Before publishing an APK, set your own store profile and replace all demo PINs.

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) for the development workflow and [ROADMAP.md](ROADMAP.md) for useful areas to improve.

## License

[MIT](LICENSE)
