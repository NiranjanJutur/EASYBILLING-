-- ════════════════════════════════════════════════════════════════════════════
-- 001_core_schema.sql — Tables used by the SMS app
-- ────────────────────────────────────────────────────────────────────────────
-- Safe to run on a fresh project AND on the existing live project:
--   • CREATE TABLE IF NOT EXISTS for every table
--   • ADD COLUMN IF NOT EXISTS for every column the app reads or writes
--     (now including purchases, supplier_payments, staff and the small tables)
-- Nothing is dropped and no existing data is changed.
--
-- Stores are separated by the text column `store_id`:
--   'sms'    → default demo store
--   'svs'    → Sri Vinayaka Stores
--   'godown' → shared warehouse stock
-- ════════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ── updated_at helper ───────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ── Suppliers ───────────────────────────────────────────────────────────────
create table if not exists public.suppliers (
  id            uuid primary key default gen_random_uuid(),
  store_id      text not null default 'sms',
  name          text not null,
  phone         text not null default '',
  gst_number    text,
  address       text not null default '',
  city          text not null default '',
  payment_terms text not null default 'cash',
  credit_days   integer not null default 0,
  total_due     numeric(12,2) not null default 0,
  notes         text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
alter table public.suppliers add column if not exists store_id      text not null default 'sms';
alter table public.suppliers add column if not exists phone         text not null default '';
alter table public.suppliers add column if not exists gst_number    text;
alter table public.suppliers add column if not exists address       text not null default '';
alter table public.suppliers add column if not exists city          text not null default '';
alter table public.suppliers add column if not exists payment_terms text not null default 'cash';
alter table public.suppliers add column if not exists credit_days   integer not null default 0;
alter table public.suppliers add column if not exists total_due     numeric(12,2) not null default 0;
alter table public.suppliers add column if not exists notes         text;
alter table public.suppliers add column if not exists is_active     boolean not null default true;
alter table public.suppliers add column if not exists created_at    timestamptz not null default now();
alter table public.suppliers add column if not exists updated_at    timestamptz not null default now();

-- ── Products ────────────────────────────────────────────────────────────────
create table if not exists public.products (
  id                    uuid primary key default gen_random_uuid(),
  store_id              text not null default 'sms',
  name                  text not null,
  category              text not null default '',
  image_url             text not null default '',
  price                 numeric(12,2) not null default 0,
  gst_percent           integer not null default 0,
  current_stock         numeric(12,3) not null default 0,
  min_threshold         numeric(12,3) not null default 0,
  unit                  text not null default 'pcs',
  pack_size             numeric(12,3),
  supplier_id           uuid,
  supplier_phone        text not null default '',
  purchase_price        numeric(12,2) not null default 0,
  competitor_price_note text,
  is_weight_based       boolean not null default false,
  barcode               text,
  sku                   text,
  hsn_code              text,
  expiry_date           date,
  is_active             boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
alter table public.products add column if not exists store_id              text not null default 'sms';
alter table public.products add column if not exists category              text not null default '';
alter table public.products add column if not exists image_url             text not null default '';
alter table public.products add column if not exists price                 numeric(12,2) not null default 0;
alter table public.products add column if not exists gst_percent           integer not null default 0;
alter table public.products add column if not exists current_stock         numeric(12,3) not null default 0;
alter table public.products add column if not exists min_threshold         numeric(12,3) not null default 0;
alter table public.products add column if not exists unit                  text not null default 'pcs';
alter table public.products add column if not exists pack_size             numeric(12,3);
alter table public.products add column if not exists supplier_id           uuid;
alter table public.products add column if not exists supplier_phone        text not null default '';
alter table public.products add column if not exists purchase_price        numeric(12,2) not null default 0;
alter table public.products add column if not exists competitor_price_note text;
alter table public.products add column if not exists is_weight_based       boolean not null default false;
alter table public.products add column if not exists barcode               text;
alter table public.products add column if not exists sku                   text;
alter table public.products add column if not exists hsn_code              text;
alter table public.products add column if not exists expiry_date           date;
alter table public.products add column if not exists is_active             boolean not null default true;
alter table public.products add column if not exists created_at            timestamptz not null default now();
alter table public.products add column if not exists updated_at            timestamptz not null default now();

-- ── Customers ───────────────────────────────────────────────────────────────
create table if not exists public.customers (
  id                  uuid primary key default gen_random_uuid(),
  store_id            text not null default 'sms',
  udhaar_id           text,
  gst_number          text,
  name                text not null,
  phone               text not null default '',
  house_no            text,
  type                text not null default 'house',
  credit_limit        numeric(12,2) not null default 0,
  total_outstanding   numeric(12,2) not null default 0,
  whatsapp_number     text not null default '',
  first_purchase_date date,
  slip_images         text[] not null default '{}',
  notes               text,
  photo_url           text,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
alter table public.customers add column if not exists store_id            text not null default 'sms';
alter table public.customers add column if not exists udhaar_id           text;
alter table public.customers add column if not exists gst_number          text;
alter table public.customers add column if not exists phone               text not null default '';
alter table public.customers add column if not exists house_no            text;
alter table public.customers add column if not exists type                text not null default 'house';
alter table public.customers add column if not exists credit_limit        numeric(12,2) not null default 0;
alter table public.customers add column if not exists total_outstanding   numeric(12,2) not null default 0;
alter table public.customers add column if not exists whatsapp_number     text not null default '';
alter table public.customers add column if not exists first_purchase_date date;
alter table public.customers add column if not exists slip_images         text[] not null default '{}';
alter table public.customers add column if not exists notes               text;
alter table public.customers add column if not exists photo_url           text;
alter table public.customers add column if not exists is_active           boolean not null default true;
alter table public.customers add column if not exists created_at          timestamptz not null default now();
alter table public.customers add column if not exists updated_at          timestamptz not null default now();

-- ── Sales bills (transactions) ──────────────────────────────────────────────
create table if not exists public.transactions (
  id               uuid primary key default gen_random_uuid(),
  store_id         text not null default 'sms',
  bill_no          text not null,
  items            jsonb not null default '[]'::jsonb,
  subtotal         numeric(12,2) not null default 0,
  total_gst        numeric(12,2) not null default 0,
  discount_amount  numeric(12,2) not null default 0,
  grand_total      numeric(12,2) not null default 0,
  payment_type     text not null default 'CASH',
  payment_split    jsonb,
  customer_id      uuid,
  customer_name    text,
  cashier_id       text not null default '',
  cashier_name     text,
  order_type       text not null default 'in_store',
  delivery_address text,
  bill_pdf_url     text,
  "timestamp"      timestamptz not null default now(),
  is_return        boolean not null default false,
  irn              text,
  eway_bill_no     text,
  created_at       timestamptz not null default now()
);
alter table public.transactions add column if not exists store_id         text not null default 'sms';
alter table public.transactions add column if not exists items            jsonb not null default '[]'::jsonb;
alter table public.transactions add column if not exists subtotal         numeric(12,2) not null default 0;
alter table public.transactions add column if not exists total_gst        numeric(12,2) not null default 0;
alter table public.transactions add column if not exists discount_amount  numeric(12,2) not null default 0;
alter table public.transactions add column if not exists grand_total      numeric(12,2) not null default 0;
alter table public.transactions add column if not exists payment_type     text not null default 'CASH';
alter table public.transactions add column if not exists payment_split    jsonb;
alter table public.transactions add column if not exists customer_id      uuid;
alter table public.transactions add column if not exists customer_name    text;
alter table public.transactions add column if not exists cashier_id       text not null default '';
alter table public.transactions add column if not exists cashier_name     text;
alter table public.transactions add column if not exists order_type       text not null default 'in_store';
alter table public.transactions add column if not exists delivery_address text;
alter table public.transactions add column if not exists bill_pdf_url     text;
alter table public.transactions add column if not exists "timestamp"      timestamptz not null default now();
alter table public.transactions add column if not exists is_return        boolean not null default false;
alter table public.transactions add column if not exists irn              text;
alter table public.transactions add column if not exists eway_bill_no     text;
alter table public.transactions add column if not exists created_at       timestamptz not null default now();

-- ── Purchases (stock bought from suppliers) ─────────────────────────────────
-- items: [{ productId, name, qty, unit, costPrice, gstPercent, gstAmount, total, sellingPrice }]
create table if not exists public.purchases (
  id             uuid primary key default gen_random_uuid(),
  store_id       text not null default 'sms',
  purchase_no    text not null,
  supplier_id    uuid not null references public.suppliers(id),
  supplier_name  text not null,
  invoice_no     text,
  invoice_date   date not null default current_date,
  items          jsonb not null default '[]'::jsonb,
  subtotal       numeric(12,2) not null default 0,
  total_gst      numeric(12,2) not null default 0,
  other_charges  numeric(12,2) not null default 0,
  discount       numeric(12,2) not null default 0,
  grand_total    numeric(12,2) not null default 0,
  amount_paid    numeric(12,2) not null default 0,
  payment_status text not null default 'unpaid' check (payment_status in ('paid', 'partial', 'unpaid')),
  notes          text,
  created_by     text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
-- If an older `purchases` table already exists, the CREATE above is skipped,
-- so bring it up to date column by column. (purchase_no, supplier_id and
-- supplier_name stay nullable here: adding NOT NULL to a table with rows fails.)
alter table public.purchases add column if not exists store_id       text not null default 'sms';
alter table public.purchases add column if not exists purchase_no    text;
alter table public.purchases add column if not exists supplier_id    uuid references public.suppliers(id);
alter table public.purchases add column if not exists supplier_name  text;
alter table public.purchases add column if not exists invoice_no     text;
alter table public.purchases add column if not exists invoice_date   date not null default current_date;
alter table public.purchases add column if not exists items          jsonb not null default '[]'::jsonb;
alter table public.purchases add column if not exists subtotal       numeric(12,2) not null default 0;
alter table public.purchases add column if not exists total_gst      numeric(12,2) not null default 0;
alter table public.purchases add column if not exists other_charges  numeric(12,2) not null default 0;
alter table public.purchases add column if not exists discount       numeric(12,2) not null default 0;
alter table public.purchases add column if not exists grand_total    numeric(12,2) not null default 0;
alter table public.purchases add column if not exists amount_paid    numeric(12,2) not null default 0;
alter table public.purchases add column if not exists payment_status text not null default 'unpaid';
alter table public.purchases add column if not exists notes          text;
alter table public.purchases add column if not exists created_by     text;
alter table public.purchases add column if not exists created_at     timestamptz not null default now();
alter table public.purchases add column if not exists updated_at     timestamptz not null default now();

-- ── Payments made to suppliers ──────────────────────────────────────────────
create table if not exists public.supplier_payments (
  id          uuid primary key default gen_random_uuid(),
  store_id    text not null default 'sms',
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  purchase_id uuid references public.purchases(id) on delete set null,
  amount      numeric(12,2) not null check (amount > 0),
  mode        text not null default 'CASH',
  reference   text,
  note        text,
  paid_by     text,
  paid_at     timestamptz not null default now()
);
alter table public.supplier_payments add column if not exists store_id    text not null default 'sms';
alter table public.supplier_payments add column if not exists supplier_id uuid references public.suppliers(id) on delete cascade;
alter table public.supplier_payments add column if not exists purchase_id uuid references public.purchases(id) on delete set null;
alter table public.supplier_payments add column if not exists amount      numeric(12,2) not null default 0;
alter table public.supplier_payments add column if not exists mode        text not null default 'CASH';
alter table public.supplier_payments add column if not exists reference   text;
alter table public.supplier_payments add column if not exists note        text;
alter table public.supplier_payments add column if not exists paid_by     text;
alter table public.supplier_payments add column if not exists paid_at     timestamptz not null default now();

-- ── Sequential document numbers (GST needs consecutive invoice numbers) ─────
create table if not exists public.doc_counters (
  store_id text   not null,
  doc_type text   not null,          -- 'BILL' | 'PUR'
  fy       text   not null,          -- financial year, e.g. '26-27'
  last_no  bigint not null default 0,
  primary key (store_id, doc_type, fy)
);
alter table public.doc_counters add column if not exists last_no bigint not null default 0;

-- ── Offline sync de-duplication ─────────────────────────────────────────────
-- The app queues bills/purchases/payments made offline and sends each with a
-- unique client reference. If a send is retried (e.g. the reply was lost),
-- the stored result is returned instead of saving the same change twice.
create table if not exists public.client_refs (
  ref        text primary key,
  store_id   text not null,
  kind       text not null,
  result     jsonb,
  created_at timestamptz not null default now()
);
alter table public.client_refs add column if not exists store_id   text not null default 'sms';
alter table public.client_refs add column if not exists kind       text not null default '';
alter table public.client_refs add column if not exists result     jsonb;
alter table public.client_refs add column if not exists created_at timestamptz not null default now();

-- ── Staff (PIN login) ───────────────────────────────────────────────────────
-- PINs are stored as bcrypt hashes and are only ever checked inside staff_login().
create table if not exists public.staff (
  id         uuid primary key default gen_random_uuid(),
  store_id   text not null,
  name       text not null,
  role       text not null check (role in ('OWNER', 'CASHIER', 'STOCK_MANAGER', 'ACCOUNTANT')),
  pin_hash   text not null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  unique (store_id, name)
);
alter table public.staff add column if not exists store_id   text not null default 'sms';
alter table public.staff add column if not exists name       text not null default '';
alter table public.staff add column if not exists role       text not null default 'CASHIER';
alter table public.staff add column if not exists pin_hash   text not null default '';
alter table public.staff add column if not exists is_active  boolean not null default true;
alter table public.staff add column if not exists created_at timestamptz not null default now();
-- 004_seed_staff.sql relies on (store_id, name) being unique (ON CONFLICT).
create unique index if not exists uq_staff_store_name on public.staff (store_id, name);

create table if not exists public.staff_login_attempts (
  id           bigserial primary key,
  store_id     text not null,
  success      boolean not null,
  attempted_at timestamptz not null default now()
);
alter table public.staff_login_attempts add column if not exists store_id     text not null default 'sms';
alter table public.staff_login_attempts add column if not exists success      boolean not null default false;
alter table public.staff_login_attempts add column if not exists attempted_at timestamptz not null default now();

-- ── Indexes ─────────────────────────────────────────────────────────────────
create index if not exists idx_products_store        on public.products (store_id, is_active, name);
create index if not exists idx_customers_store       on public.customers (store_id, is_active, name);
create index if not exists idx_transactions_store_ts on public.transactions (store_id, "timestamp" desc);
create index if not exists idx_transactions_customer on public.transactions (customer_id);
create index if not exists idx_suppliers_store       on public.suppliers (store_id, is_active, name);
create index if not exists idx_purchases_store       on public.purchases (store_id, invoice_date desc, created_at desc);
create index if not exists idx_purchases_supplier    on public.purchases (supplier_id);
create index if not exists idx_supplier_payments_sup on public.supplier_payments (supplier_id, paid_at desc);
create index if not exists idx_login_attempts        on public.staff_login_attempts (store_id, attempted_at desc);

-- ── updated_at triggers ─────────────────────────────────────────────────────
drop trigger if exists trg_products_updated  on public.products;
create trigger trg_products_updated  before update on public.products  for each row execute function public.set_updated_at();
drop trigger if exists trg_customers_updated on public.customers;
create trigger trg_customers_updated before update on public.customers for each row execute function public.set_updated_at();
drop trigger if exists trg_suppliers_updated on public.suppliers;
create trigger trg_suppliers_updated before update on public.suppliers for each row execute function public.set_updated_at();
drop trigger if exists trg_purchases_updated on public.purchases;
create trigger trg_purchases_updated before update on public.purchases for each row execute function public.set_updated_at();

-- Make the API pick up any new tables/columns right away.
notify pgrst, 'reload schema';
