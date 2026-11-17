-- ════════════════════════════════════════════════════════════════════════════
-- 003_security.sql — Row Level Security for the new tables
-- ────────────────────────────────────────────────────────────────────────────
-- The app talks to Supabase with the public anon key. Staff log in with a PIN
-- that is checked by staff_login(); Supabase itself does not know who is
-- logged in. So these policies keep secrets and money-moving writes inside
-- the database functions, and leave plain reads open to the app.
--
-- products / customers / transactions are NOT changed here, so the existing
-- live project keeps working exactly as before.
-- ════════════════════════════════════════════════════════════════════════════

-- Staff PIN hashes, login attempts and counters: no direct API access at all.
alter table public.staff                enable row level security;
alter table public.staff_login_attempts enable row level security;
alter table public.doc_counters         enable row level security;
alter table public.client_refs          enable row level security;

-- Suppliers: the app lists, adds and edits suppliers directly.
-- total_due can only change through create_purchase / record_supplier_payment.
alter table public.suppliers enable row level security;
drop policy if exists "app read suppliers"   on public.suppliers;
drop policy if exists "app insert suppliers" on public.suppliers;
drop policy if exists "app update suppliers" on public.suppliers;
create policy "app read suppliers"   on public.suppliers for select to anon, authenticated using (true);
create policy "app insert suppliers" on public.suppliers for insert to anon, authenticated with check (true);
create policy "app update suppliers" on public.suppliers for update to anon, authenticated using (true) with check (true);

-- A column can't be revoked while the whole table is granted, so revoke
-- UPDATE on the table and grant back only the editable columns.
revoke update on public.suppliers from anon, authenticated;
grant update (name, phone, gst_number, address, city, payment_terms, credit_days, notes, is_active)
  on public.suppliers to anon, authenticated;

-- Purchases and supplier payments: read-only from the app.
-- All writes go through create_purchase / delete_purchase / record_supplier_payment.
alter table public.purchases         enable row level security;
alter table public.supplier_payments enable row level security;
drop policy if exists "app read purchases"         on public.purchases;
drop policy if exists "app read supplier payments" on public.supplier_payments;
create policy "app read purchases"         on public.purchases         for select to anon, authenticated using (true);
create policy "app read supplier payments" on public.supplier_payments for select to anon, authenticated using (true);
