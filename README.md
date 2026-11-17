# ShopLedger

ShopLedger is an open-source, local-first billing and shop-management app for small businesses. It runs on Android and the web, keeps data on the device by default, and does not require an API key or cloud account to get started.

## Features

- GST-ready billing with cash, UPI, card, credit, and split payments
- UPI QR payment links
- Shareable text invoices and printable PDF invoices
- Product, customer, stock, supplier, and purchase management
- Customer GSTIN support and GST invoice details
- Role-based PIN login for owner, cashier, stock manager, and accountant
- Barcode scanning, camera capture, and voice product selection on supported Android devices
- Dashboard, compliance reports, bill history, and offline local storage

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

The template already uses `DATA_MODE=LOCAL`. No Firebase, Supabase, or AI key is needed for local billing.

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

Change these before using the app for a real store.

## Optional cloud sync

The app is local-first. Supabase is optional for teams that want multi-device data sync. Add only your own Supabase public URL and anonymous key to `.env`; never commit `.env` or any service-role key.

## Project structure

```text
src/                 React Native and web application source
android/             Android native project
supabase/            Optional self-hosted/cloud database schema and functions
__tests__/           Tests
```

## Privacy

This repository contains generic demo business details only. It excludes local environment files, API keys, cloud configuration files, build products, logs, and device data.

## License

[MIT](LICENSE)
