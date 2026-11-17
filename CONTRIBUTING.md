# Contributing to SMS

Thanks for your interest! This is a student open-source project and all contributions are welcome.

## Quick start

1. Fork the repo on GitHub
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/SMS.git`
3. Create a branch: `git checkout -b feat/your-feature`
4. Make your changes
5. Run `npm run lint` to check for issues
6. Open a Pull Request against `main`

## Branch naming

| Type | Example |
|---|---|
| Feature | `feat/add-barcode-scanner` |
| Bug fix | `fix/stock-update-crash` |
| DB change | `db/add-suppliers-table` |
| Docs | `docs/update-readme` |

## Code guidelines

- TypeScript everywhere — avoid `any` types
- All DB operations must go through `src/services/database/supabaseDataService.ts`
- Use atomic RPC functions for balance/stock updates — never read-then-write
- One screen per file in `src/screens/<feature>/`
- Never commit `.env`, `node_modules/`, or API keys

## Database changes

Add a new numbered SQL file in `supabase/migrations/` (e.g. `004_add_discount_table.sql`) and describe what it does at the top of the file.

## Reporting bugs

Open a GitHub Issue with:
- What you expected to happen
- What actually happened
- Steps to reproduce
- Device / OS / version

## Good first issues

Look for issues labelled `good first issue` — these are small, well-defined tasks ideal for first-time contributors.
