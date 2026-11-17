-- ════════════════════════════════════════════════════════════════════════════
-- 002_functions.sql — Database functions (RPCs) the app calls
-- ────────────────────────────────────────────────────────────────────────────
-- Every money/stock change happens inside ONE function call, so it either
-- fully succeeds or changes nothing (no "bill saved but stock not reduced").
-- Safe to re-run: old versions of these functions are dropped first.
-- ════════════════════════════════════════════════════════════════════════════

-- Drop every existing overload of the functions defined below, whatever its
-- old parameter list was (older versions used different signatures).
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'next_doc_number', 'staff_login', 'set_staff_pin',
        'create_sale', 'create_purchase', 'delete_purchase', 'record_supplier_payment',
        'decrement_product_stock', 'increment_customer_balance',
        'get_low_stock_products', 'get_daily_sales_summary'
      )
  loop
    execute 'drop function ' || r.sig || ' cascade';
  end loop;
end $$;

-- ── Document numbers ────────────────────────────────────────────────────────
-- BILL → 'SMS/26-27/00001'  (15 chars; GST invoice numbers must be ≤ 16)
-- PUR  → 'PUR/SMS/26-27/0001'
create function public.next_doc_number(p_store_id text, p_doc_type text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_start int;
  v_fy    text;
  v_no    bigint;
begin
  v_start := case when extract(month from v_today) >= 4
                  then extract(year from v_today)::int
                  else extract(year from v_today)::int - 1 end;
  v_fy := lpad((v_start % 100)::text, 2, '0') || '-' || lpad(((v_start + 1) % 100)::text, 2, '0');

  insert into doc_counters (store_id, doc_type, fy, last_no)
  values (p_store_id, p_doc_type, v_fy, 1)
  on conflict (store_id, doc_type, fy)
  do update set last_no = doc_counters.last_no + 1
  returning last_no into v_no;

  if p_doc_type = 'BILL' then
    return upper(p_store_id) || '/' || v_fy || '/' || lpad(v_no::text, 5, '0');
  end if;
  return p_doc_type || '/' || upper(p_store_id) || '/' || v_fy || '/' || lpad(v_no::text, 4, '0');
end $$;

-- ── Staff PIN login ─────────────────────────────────────────────────────────
-- Returns { ok, id, name, role, storeId } or { ok:false, error }.
-- Never raises for a wrong PIN, so the failed attempt is still recorded.
-- 5 wrong PINs in 5 minutes locks that store's login for 5 minutes.
create function public.staff_login(p_store_id text, p_pin text)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_fail  int;
  v_id    uuid;
  v_name  text;
  v_role  text;
begin
  if p_pin is null or p_pin !~ '^[0-9]{4,6}$' then
    return jsonb_build_object('ok', false, 'error', 'Enter your 4 to 6 digit PIN');
  end if;

  select count(*) into v_fail
  from staff_login_attempts
  where store_id = p_store_id and not success and attempted_at > now() - interval '5 minutes';

  if v_fail >= 5 then
    return jsonb_build_object('ok', false, 'error', 'Too many wrong PINs. Wait 5 minutes and try again.', 'locked', true);
  end if;

  select id, name, role into v_id, v_name, v_role
  from staff
  where store_id = p_store_id and is_active and pin_hash = crypt(p_pin, pin_hash)
  limit 1;

  insert into staff_login_attempts (store_id, success) values (p_store_id, v_id is not null);

  if v_id is null then
    return jsonb_build_object('ok', false, 'error', 'Wrong PIN', 'attemptsLeft', greatest(0, 4 - v_fail));
  end if;

  return jsonb_build_object('ok', true, 'id', v_id, 'name', v_name, 'role', v_role, 'storeId', p_store_id);
end $$;

-- Owner changes the PIN of any role in their store.
create function public.set_staff_pin(p_store_id text, p_owner_pin text, p_role text, p_new_pin text)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_owner uuid;
  v_count int;
begin
  if p_new_pin is null or p_new_pin !~ '^[0-9]{4,6}$' then
    return jsonb_build_object('ok', false, 'error', 'New PIN must be 4 to 6 digits');
  end if;

  select id into v_owner from staff
  where store_id = p_store_id and role = 'OWNER' and is_active and pin_hash = crypt(p_owner_pin, pin_hash)
  limit 1;
  if v_owner is null then
    return jsonb_build_object('ok', false, 'error', 'Owner PIN is wrong');
  end if;

  if exists (select 1 from staff where store_id = p_store_id and role <> p_role and is_active
             and pin_hash = crypt(p_new_pin, pin_hash)) then
    return jsonb_build_object('ok', false, 'error', 'Another role already uses this PIN');
  end if;

  update staff set pin_hash = crypt(p_new_pin, gen_salt('bf'))
  where store_id = p_store_id and role = p_role and is_active;
  get diagnostics v_count = row_count;

  if v_count = 0 then
    return jsonb_build_object('ok', false, 'error', 'No staff with that role');
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- ── Sale (billing checkout) ─────────────────────────────────────────────────
-- p_items: [{ productId, name, qty, unit, price, gst }]
-- price = final unit price before GST (after any customer-type discount).
-- Totals are recomputed here; the client's numbers are not trusted.
create function public.create_sale(
  p_store_id         text,
  p_items            jsonb,
  p_payment_type     text,
  p_payment_split    jsonb   default null,
  p_customer_id      uuid    default null,
  p_discount         numeric default 0,
  p_cashier_id       text    default '',
  p_cashier_name     text    default null,
  p_order_type       text    default 'in_store',
  p_delivery_address text    default null,
  p_client_ref       text    default null
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_done      jsonb;
  v_result    jsonb;
  v_item      jsonb;
  v_items     jsonb := '[]'::jsonb;
  v_short     jsonb := '[]'::jsonb;
  v_qty       numeric;
  v_price     numeric;
  v_gst       numeric;
  v_line      numeric;
  v_gst_amt   numeric;
  v_sub       numeric := 0;
  v_gst_total numeric := 0;
  v_discount  numeric := round(greatest(coalesce(p_discount, 0), 0), 2);
  v_grand     numeric;
  v_split_sum numeric;
  v_udhaar    numeric := 0;
  v_cust_name text;
  v_prod_id   uuid;
  v_prod_name text;
  v_prod_unit text;
  v_stock     numeric;
  v_bill      text;
  v_id        uuid;
  v_ts        timestamptz := now();
begin
  -- Already saved by an earlier attempt? Return that bill instead of a duplicate.
  if p_client_ref is not null then
    select result into v_done from client_refs where ref = p_client_ref;
    if found then return v_done; end if;
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'The bill has no items';
  end if;
  if p_payment_type not in ('CASH', 'UPI', 'CARD', 'UDHAAR', 'SPLIT') then
    raise exception 'Unknown payment type: %', p_payment_type;
  end if;

  if p_customer_id is not null then
    select name into v_cust_name from customers where id = p_customer_id and store_id = p_store_id;
    if not found then
      raise exception 'Customer not found in this store';
    end if;
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty   := (v_item->>'qty')::numeric;
    v_price := round((v_item->>'price')::numeric, 2);
    v_gst   := coalesce((v_item->>'gst')::numeric, 0);

    if v_qty is null or v_qty <= 0 then
      raise exception 'Quantity must be more than 0 for %', coalesce(v_item->>'name', 'an item');
    end if;
    if v_price is null or v_price < 0 then
      raise exception 'Price cannot be negative for %', coalesce(v_item->>'name', 'an item');
    end if;
    if v_gst not in (0, 5, 12, 18, 28) then
      raise exception 'Invalid GST rate % for %', v_gst, coalesce(v_item->>'name', 'an item');
    end if;

    select id, name, unit, current_stock
      into v_prod_id, v_prod_name, v_prod_unit, v_stock
    from products
    where id = (v_item->>'productId')::uuid and store_id = p_store_id
    for update;

    if not found then
      raise exception '% is not in this store''s items', coalesce(v_item->>'name', 'An item');
    end if;

    if v_stock < v_qty then
      v_short := v_short || jsonb_build_object('name', v_prod_name, 'had', v_stock, 'sold', v_qty);
    end if;
    update products set current_stock = greatest(0, current_stock - v_qty) where id = v_prod_id;

    v_line    := round(v_price * v_qty, 2);
    v_gst_amt := round(v_line * v_gst / 100, 2);
    v_sub       := v_sub + v_line;
    v_gst_total := v_gst_total + v_gst_amt;

    v_items := v_items || jsonb_build_object(
      'productId', v_prod_id,
      'name',      v_prod_name,
      'qty',       v_qty,
      'unit',      coalesce(nullif(v_item->>'unit', ''), v_prod_unit),
      'price',     v_price,
      'gst',       v_gst,
      'gstAmount', v_gst_amt,
      'total',     v_line + v_gst_amt
    );
  end loop;

  if v_discount > v_sub + v_gst_total then
    raise exception 'Discount is more than the bill total';
  end if;
  v_grand := round(v_sub + v_gst_total - v_discount, 2);

  if p_payment_type = 'UDHAAR' then
    v_udhaar := v_grand;
  elsif p_payment_type = 'SPLIT' then
    if p_payment_split is null then
      raise exception 'Split payment amounts are missing';
    end if;
    v_split_sum := coalesce((p_payment_split->>'cash')::numeric, 0)
                 + coalesce((p_payment_split->>'upi')::numeric, 0)
                 + coalesce((p_payment_split->>'card')::numeric, 0)
                 + coalesce((p_payment_split->>'udhaar')::numeric, 0);
    if abs(v_split_sum - v_grand) > 0.5 then
      raise exception 'Split amounts (Rs %) must add up to the bill total (Rs %)', v_split_sum, v_grand;
    end if;
    v_udhaar := coalesce((p_payment_split->>'udhaar')::numeric, 0);
  end if;

  if v_udhaar > 0 and p_customer_id is null then
    raise exception 'Choose a customer to give Udhaar';
  end if;

  if p_customer_id is not null then
    update customers
    set total_outstanding   = total_outstanding + v_udhaar,
        first_purchase_date = coalesce(first_purchase_date, (v_ts at time zone 'Asia/Kolkata')::date)
    where id = p_customer_id;
  end if;

  v_bill := next_doc_number(p_store_id, 'BILL');

  insert into transactions (
    store_id, bill_no, items, subtotal, total_gst, discount_amount, grand_total,
    payment_type, payment_split, customer_id, customer_name, cashier_id, cashier_name,
    order_type, delivery_address, "timestamp", is_return
  ) values (
    p_store_id, v_bill, v_items, v_sub, v_gst_total, v_discount, v_grand,
    p_payment_type, case when p_payment_type = 'SPLIT' then p_payment_split else null end,
    p_customer_id, v_cust_name, coalesce(p_cashier_id, ''), p_cashier_name,
    coalesce(p_order_type, 'in_store'), p_delivery_address, v_ts, false
  )
  returning id into v_id;

  v_result := jsonb_build_object(
    'id',            v_id,
    'billNo',        v_bill,
    'items',         v_items,
    'subtotal',      v_sub,
    'totalGST',      v_gst_total,
    'discount',      v_discount,
    'grandTotal',    v_grand,
    'udhaarAdded',   v_udhaar,
    'customerName',  v_cust_name,
    'stockWarnings', v_short,
    'timestamp',     v_ts
  );

  if p_client_ref is not null then
    insert into client_refs (ref, store_id, kind, result) values (p_client_ref, p_store_id, 'sale', v_result);
  end if;
  return v_result;
end $$;

-- ── Purchase (stock in from a supplier) ─────────────────────────────────────
-- p_items: [{ productId?, isNew?, name, qty, unit, costPrice, gstPercent, sellingPrice?, category? }]
-- • productId (existing item) → adds stock, updates its cost (and selling price if given)
-- • isNew / no productId      → reuses an item with the same name, or creates a new item
--                               (with the given productId when there is one)
create function public.create_purchase(
  p_store_id      text,
  p_supplier_id   uuid,
  p_items         jsonb,
  p_invoice_no    text    default null,
  p_invoice_date  date    default null,
  p_other_charges numeric default 0,
  p_discount      numeric default 0,
  p_amount_paid   numeric default 0,
  p_payment_mode  text    default 'CASH',
  p_notes         text    default null,
  p_created_by    text    default null,
  p_client_ref    text    default null
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_done      jsonb;
  v_result    jsonb;
  v_sup_name  text;
  v_sup_phone text;
  v_item      jsonb;
  v_items     jsonb := '[]'::jsonb;
  v_qty       numeric;
  v_cost      numeric;
  v_gst       numeric;
  v_sell      numeric;
  v_line      numeric;
  v_gst_amt   numeric;
  v_sub       numeric := 0;
  v_gst_total numeric := 0;
  v_other     numeric := round(greatest(coalesce(p_other_charges, 0), 0), 2);
  v_disc      numeric := round(greatest(coalesce(p_discount, 0), 0), 2);
  v_grand     numeric;
  v_paid      numeric;
  v_status    text;
  v_prod_id   uuid;
  v_match     uuid;
  v_is_new    boolean;
  v_name      text;
  v_unit      text;
  v_invoice   text := nullif(trim(coalesce(p_invoice_no, '')), '');
  v_no        text;
  v_pid       uuid;
begin
  if p_client_ref is not null then
    select result into v_done from client_refs where ref = p_client_ref;
    if found then return v_done; end if;
  end if;

  select name, phone into v_sup_name, v_sup_phone
  from suppliers where id = p_supplier_id and store_id = p_store_id and is_active
  for update;
  if not found then
    raise exception 'Supplier not found in this store';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Add at least one item to the purchase';
  end if;

  if v_invoice is not null and exists (
    select 1 from purchases
    where store_id = p_store_id and supplier_id = p_supplier_id and lower(invoice_no) = lower(v_invoice)
  ) then
    raise exception 'Invoice % from % is already entered', v_invoice, v_sup_name;
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty  := (v_item->>'qty')::numeric;
    v_cost := round((v_item->>'costPrice')::numeric, 2);
    v_gst  := coalesce((v_item->>'gstPercent')::numeric, 0);
    v_sell := round(nullif(v_item->>'sellingPrice', '')::numeric, 2);
    v_name := trim(coalesce(v_item->>'name', ''));
    v_unit := coalesce(nullif(trim(v_item->>'unit'), ''), 'pcs');

    if v_qty is null or v_qty <= 0 then
      raise exception 'Quantity must be more than 0 for %', coalesce(nullif(v_name, ''), 'an item');
    end if;
    if v_cost is null or v_cost < 0 then
      raise exception 'Cost price cannot be negative for %', coalesce(nullif(v_name, ''), 'an item');
    end if;
    if v_gst not in (0, 5, 12, 18, 28) then
      raise exception 'Invalid GST rate % for %', v_gst, coalesce(nullif(v_name, ''), 'an item');
    end if;
    if v_sell is not null and v_sell < 0 then
      raise exception 'Selling price cannot be negative for %', v_name;
    end if;

    v_prod_id := nullif(v_item->>'productId', '')::uuid;
    v_is_new  := coalesce((v_item->>'isNew')::boolean, false);

    -- New item: reuse an existing item with the same name, otherwise create it
    -- (keeping the id the app made, so bills made offline can refer to it).
    if v_prod_id is null or v_is_new then
      if v_name = '' then
        raise exception 'An item is missing its name';
      end if;
      select id into v_match from products
      where store_id = p_store_id and is_active and lower(name) = lower(v_name)
      limit 1;
      if v_match is not null then
        v_prod_id := v_match;
        v_is_new := false;
      end if;
    end if;

    if v_prod_id is not null and not v_is_new then
      update products
      set current_stock  = current_stock + v_qty,
          purchase_price = v_cost,
          price          = coalesce(v_sell, price),
          gst_percent    = v_gst,
          supplier_id    = p_supplier_id,
          supplier_phone = coalesce(nullif(v_sup_phone, ''), supplier_phone)
      where id = v_prod_id and store_id = p_store_id
      returning name, unit into v_name, v_unit;
      if not found then
        raise exception '% is not in this store''s items', coalesce(nullif(v_name, ''), 'An item');
      end if;
    else
      insert into products (
        id, store_id, name, category, price, gst_percent, current_stock, min_threshold,
        unit, supplier_id, supplier_phone, purchase_price, is_weight_based, is_active
      ) values (
        coalesce(v_prod_id, gen_random_uuid()),
        p_store_id, v_name, coalesce(v_item->>'category', ''), coalesce(v_sell, v_cost), v_gst, v_qty, 0,
        v_unit, p_supplier_id, coalesce(v_sup_phone, ''), v_cost, v_unit in ('kg', 'g', 'ltr', 'ml'), true
      )
      returning id into v_prod_id;
    end if;

    v_line    := round(v_cost * v_qty, 2);
    v_gst_amt := round(v_line * v_gst / 100, 2);
    v_sub       := v_sub + v_line;
    v_gst_total := v_gst_total + v_gst_amt;

    v_items := v_items || jsonb_build_object(
      'productId',    v_prod_id,
      'name',         v_name,
      'qty',          v_qty,
      'unit',         v_unit,
      'costPrice',    v_cost,
      'gstPercent',   v_gst,
      'gstAmount',    v_gst_amt,
      'total',        v_line + v_gst_amt,
      'sellingPrice', v_sell
    );
  end loop;

  v_grand := round(v_sub + v_gst_total + v_other - v_disc, 2);
  if v_grand < 0 then
    raise exception 'Discount is more than the purchase total';
  end if;

  v_paid := round(least(greatest(coalesce(p_amount_paid, 0), 0), v_grand), 2);
  v_status := case when v_paid >= v_grand then 'paid' when v_paid > 0 then 'partial' else 'unpaid' end;
  v_no := next_doc_number(p_store_id, 'PUR');

  insert into purchases (
    store_id, purchase_no, supplier_id, supplier_name, invoice_no, invoice_date, items,
    subtotal, total_gst, other_charges, discount, grand_total, amount_paid, payment_status, notes, created_by
  ) values (
    p_store_id, v_no, p_supplier_id, v_sup_name, v_invoice,
    coalesce(p_invoice_date, (now() at time zone 'Asia/Kolkata')::date), v_items,
    v_sub, v_gst_total, v_other, v_disc, v_grand, v_paid, v_status, nullif(trim(coalesce(p_notes, '')), ''), p_created_by
  )
  returning id into v_pid;

  if v_paid > 0 then
    insert into supplier_payments (store_id, supplier_id, purchase_id, amount, mode, note, paid_by)
    values (p_store_id, p_supplier_id, v_pid, v_paid, coalesce(p_payment_mode, 'CASH'), 'Paid at purchase', p_created_by);
  end if;

  update suppliers set total_due = total_due + (v_grand - v_paid) where id = p_supplier_id;

  v_result := jsonb_build_object(
    'id',            v_pid,
    'purchaseNo',    v_no,
    'grandTotal',    v_grand,
    'amountPaid',    v_paid,
    'paymentStatus', v_status,
    'items',         v_items
  );

  if p_client_ref is not null then
    insert into client_refs (ref, store_id, kind, result) values (p_client_ref, p_store_id, 'purchase', v_result);
  end if;
  return v_result;
end $$;

-- Undo a purchase entered by mistake. Only allowed while nothing is paid on it.
create function public.delete_purchase(p_store_id text, p_purchase_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_pur  purchases%rowtype;
  v_item jsonb;
begin
  select * into v_pur from purchases where id = p_purchase_id and store_id = p_store_id for update;
  if not found then
    raise exception 'Purchase not found';
  end if;
  if v_pur.amount_paid > 0 then
    raise exception 'This purchase already has payments, so it cannot be deleted';
  end if;

  for v_item in select * from jsonb_array_elements(v_pur.items) loop
    update products
    set current_stock = greatest(0, current_stock - (v_item->>'qty')::numeric)
    where id = (v_item->>'productId')::uuid and store_id = p_store_id;
  end loop;

  update suppliers set total_due = greatest(0, total_due - v_pur.grand_total) where id = v_pur.supplier_id;
  delete from purchases where id = p_purchase_id;

  return jsonb_build_object('ok', true);
end $$;

-- ── Pay a supplier ──────────────────────────────────────────────────────────
-- With p_purchase_id: pays that bill.
-- Without: pays the oldest unpaid bills first; anything left reduces opening due.
create function public.record_supplier_payment(
  p_store_id    text,
  p_supplier_id uuid,
  p_amount      numeric,
  p_mode        text default 'CASH',
  p_purchase_id uuid default null,
  p_reference   text default null,
  p_note        text default null,
  p_paid_by     text default null,
  p_client_ref  text default null
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_done    jsonb;
  v_result  jsonb;
  v_amount  numeric := round(coalesce(p_amount, 0), 2);
  v_due     numeric;
  v_name    text;
  v_pur     record;
  v_balance numeric;
  v_apply   numeric;
  v_left    numeric;
begin
  if p_client_ref is not null then
    select result into v_done from client_refs where ref = p_client_ref;
    if found then return v_done; end if;
  end if;

  if v_amount <= 0 then
    raise exception 'Enter an amount more than 0';
  end if;

  select total_due, name into v_due, v_name
  from suppliers where id = p_supplier_id and store_id = p_store_id
  for update;
  if not found then
    raise exception 'Supplier not found in this store';
  end if;

  if p_purchase_id is not null then
    select id, grand_total, amount_paid into v_pur
    from purchases
    where id = p_purchase_id and supplier_id = p_supplier_id and store_id = p_store_id
    for update;
    if not found then
      raise exception 'Purchase not found for this supplier';
    end if;

    v_balance := v_pur.grand_total - v_pur.amount_paid;
    if v_amount > v_balance + 0.009 then
      raise exception 'Only Rs % is left to pay on this purchase', v_balance;
    end if;

    update purchases
    set amount_paid    = amount_paid + v_amount,
        payment_status = case when amount_paid + v_amount >= grand_total - 0.009 then 'paid' else 'partial' end
    where id = p_purchase_id;

    insert into supplier_payments (store_id, supplier_id, purchase_id, amount, mode, reference, note, paid_by)
    values (p_store_id, p_supplier_id, p_purchase_id, v_amount, coalesce(p_mode, 'CASH'), p_reference, p_note, p_paid_by);
  else
    if v_amount > v_due + 0.009 then
      raise exception 'Only Rs % is due to %', v_due, v_name;
    end if;

    v_left := v_amount;
    for v_pur in
      select id, grand_total, amount_paid
      from purchases
      where supplier_id = p_supplier_id and store_id = p_store_id and payment_status <> 'paid'
      order by invoice_date, created_at
      for update
    loop
      exit when v_left <= 0.009;
      v_apply := least(v_left, v_pur.grand_total - v_pur.amount_paid);
      continue when v_apply <= 0;

      update purchases
      set amount_paid    = amount_paid + v_apply,
          payment_status = case when amount_paid + v_apply >= grand_total - 0.009 then 'paid' else 'partial' end
      where id = v_pur.id;

      insert into supplier_payments (store_id, supplier_id, purchase_id, amount, mode, reference, note, paid_by)
      values (p_store_id, p_supplier_id, v_pur.id, v_apply, coalesce(p_mode, 'CASH'), p_reference, p_note, p_paid_by);

      v_left := v_left - v_apply;
    end loop;

    if v_left > 0.009 then
      insert into supplier_payments (store_id, supplier_id, purchase_id, amount, mode, reference, note, paid_by)
      values (p_store_id, p_supplier_id, null, round(v_left, 2), coalesce(p_mode, 'CASH'), p_reference,
              coalesce(p_note, 'Opening balance'), p_paid_by);
    end if;
  end if;

  update suppliers set total_due = greatest(0, total_due - v_amount) where id = p_supplier_id
  returning total_due into v_due;

  v_result := jsonb_build_object('ok', true, 'supplierDue', v_due);
  if p_client_ref is not null then
    insert into client_refs (ref, store_id, kind, result) values (p_client_ref, p_store_id, 'supplier_payment', v_result);
  end if;
  return v_result;
end $$;

-- ── Older single-purpose functions (still used by some screens) ─────────────
create function public.decrement_product_stock(p_product_id uuid, p_qty numeric)
returns void
language sql security definer set search_path = public as $$
  update products set current_stock = greatest(0, current_stock - p_qty) where id = p_product_id;
$$;

create function public.increment_customer_balance(p_customer_id uuid, p_delta numeric, p_client_ref text default null)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_client_ref is not null then
    if exists (select 1 from client_refs where ref = p_client_ref) then return; end if;
  end if;
  update customers set total_outstanding = greatest(0, total_outstanding + p_delta) where id = p_customer_id;
  if p_client_ref is not null then
    insert into client_refs (ref, store_id, kind)
    select p_client_ref, coalesce(store_id, ''), 'customer_balance' from customers where id = p_customer_id;
  end if;
end $$;

create function public.get_low_stock_products(p_store_id text)
returns setof public.products
language sql stable set search_path = public as $$
  select * from products
  where store_id = p_store_id and is_active and current_stock <= min_threshold
  order by current_stock, name;
$$;

create function public.get_daily_sales_summary(p_date date, p_store_id text)
returns jsonb
language sql stable set search_path = public as $$
  select jsonb_build_object(
    'total_transactions', count(*),
    'total_revenue',      coalesce(sum(grand_total), 0),
    'total_gst',          coalesce(sum(total_gst), 0),
    'cash_sales',   coalesce(sum(case when payment_type = 'CASH'   then grand_total
                                      when payment_type = 'SPLIT'  then coalesce((payment_split->>'cash')::numeric, 0)   else 0 end), 0),
    'upi_sales',    coalesce(sum(case when payment_type = 'UPI'    then grand_total
                                      when payment_type = 'SPLIT'  then coalesce((payment_split->>'upi')::numeric, 0)    else 0 end), 0),
    'card_sales',   coalesce(sum(case when payment_type = 'CARD'   then grand_total
                                      when payment_type = 'SPLIT'  then coalesce((payment_split->>'card')::numeric, 0)   else 0 end), 0),
    'udhaar_sales', coalesce(sum(case when payment_type = 'UDHAAR' then grand_total
                                      when payment_type = 'SPLIT'  then coalesce((payment_split->>'udhaar')::numeric, 0) else 0 end), 0),
    'e_invoice_count', count(*) filter (where irn is not null),
    'permit_count',    count(*) filter (where eway_bill_no is not null)
  )
  from transactions
  where store_id = p_store_id
    and not coalesce(is_return, false)
    and ("timestamp"::timestamptz at time zone 'Asia/Kolkata')::date = p_date;
$$;

-- ── Who may call what ───────────────────────────────────────────────────────
revoke execute on function public.next_doc_number(text, text) from public, anon, authenticated;

grant execute on function public.staff_login(text, text)                         to anon, authenticated;
grant execute on function public.set_staff_pin(text, text, text, text)           to anon, authenticated;
grant execute on function public.create_sale(text, jsonb, text, jsonb, uuid, numeric, text, text, text, text, text) to anon, authenticated;
grant execute on function public.create_purchase(text, uuid, jsonb, text, date, numeric, numeric, numeric, text, text, text, text) to anon, authenticated;
grant execute on function public.delete_purchase(text, uuid)                     to anon, authenticated;
grant execute on function public.record_supplier_payment(text, uuid, numeric, text, uuid, text, text, text, text) to anon, authenticated;
grant execute on function public.decrement_product_stock(uuid, numeric)          to anon, authenticated;
grant execute on function public.increment_customer_balance(uuid, numeric, text) to anon, authenticated;
grant execute on function public.get_low_stock_products(text)                    to anon, authenticated;
grant execute on function public.get_daily_sales_summary(date, text)             to anon, authenticated;
