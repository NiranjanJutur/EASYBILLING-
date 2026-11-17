-- ════════════════════════════════════════════════════════════════════════════
-- 004_seed_staff.sql — Starting staff PINs for each store
-- ────────────────────────────────────────────────────────────────────────────
-- Only runs for a store that has no staff yet, so re-running is harmless.
--
--   Role            Starting PIN
--   Owner           1990
--   Cashier         2001
--   Stock Manager   1985
--   Accountant      1995
--
-- CHANGE THESE after the first login: Owner → Dashboard → Staff PINs.
-- ════════════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

insert into public.staff (store_id, name, role, pin_hash)
select s.store_id, r.name, r.role, crypt(r.pin, gen_salt('bf'))
from (values ('sms'), ('svs')) as s(store_id)
cross join (values
  ('Owner',         'OWNER',         '1990'),
  ('Cashier',       'CASHIER',       '2001'),
  ('Stock Manager', 'STOCK_MANAGER', '1985'),
  ('Accountant',    'ACCOUNTANT',    '1995')
) as r(name, role, pin)
where not exists (select 1 from public.staff st where st.store_id = s.store_id)
on conflict (store_id, name) do nothing;
