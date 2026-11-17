# Contributing to ShopLedger

Thanks for improving ShopLedger. Bug reports, documentation improvements, accessibility work, and new business workflows are all welcome.

## Quick start

1. Fork the repository on GitHub.
2. Clone your fork and run `npm install`.
3. Copy `.env.example` to `.env`; local mode needs no key or cloud account.
4. Create a branch such as `feat/add-barcode-scanner` or `fix/stock-update`.
5. Make one focused change and run the relevant checks.
6. Open a pull request against `main` with screenshots for user-interface changes when possible.

## Code guidelines

- Use TypeScript and keep screen changes focused.
- Preserve local-first behaviour: the app must work without a network connection.
- Keep secrets in `.env`; never commit API keys, tokens, keystores, production data, or an APK.
- Use generic demo data in documentation, fixtures, and screenshots.
- Add a migration under `supabase/migrations/` only when changing the optional cloud schema.

## Reporting a bug

Include the expected result, actual result, steps to reproduce, app version, and Android/web environment. Do not attach invoices or screenshots containing customer or business data.

## Good contribution areas

See [ROADMAP.md](ROADMAP.md). Small fixes to billing calculations, receipt layouts, accessibility, translations, Android device compatibility, and documentation are especially useful.
