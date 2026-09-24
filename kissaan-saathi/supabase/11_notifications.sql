-- =====================================================================
-- 11_notifications.sql  —  Global New Activity / Notification system
-- Run ONCE in Supabase Dashboard > SQL Editor. Safe to re-run (idempotent).
--
-- How it works
--   * One table: public.notifications (one row per user per event).
--   * Rows are created ONLY by database triggers (SECURITY DEFINER), so every
--     existing screen / RPC / API route / service-role write is covered with
--     zero changes to your existing frontend code.
--   * A trigger can NEVER block the real action: every trigger body is wrapped
--     in an exception handler that only logs a WARNING if something fails.
--   * The logged-in user can only READ their own rows and only flip is_read.
--   * Texts stored here are English fallbacks; the app renders EN / मराठी
--     from lib/notifications/text.ts using `type` + `params`.
--
-- Assumed existing columns (taken from your app code):
--   profiles(id, role, full_name, is_suspended)   role = farmer|buyer|admin|delivery
--   buyer_profiles(user_id, business_name)
--   product_listings(id, farmer_id, name, status, rejection_reason)
--   conversations(id, listing_id, farmer_id, buyer_id)
--   messages(id, conversation_id, sender_id, body)
--   offers(id, conversation_id, made_by, quantity, price_per_kg, status, rejection_reason)
--   orders(id, listing_id, farmer_id, buyer_id, delivery_partner_id, quantity,
--          delivery_mode, delivery_cost, status, payment_status)
--   disputes(id, order_id, buyer_id, reason, status, resolution)
--   farmer_settlements(farmer_id, amount_paid, utr_reference)
--   delivery_settlements(delivery_partner_id, amount_paid, utr_reference)
-- =====================================================================


-- ---------------------------------------------------------------------
-- 0. CLEAN START: if a DIFFERENT "notifications" table already exists in your
--    database (an older/experimental one without a recipient_id column),
--    "create table if not exists" below would silently keep it and the script
--    would fail with: column "recipient_id" does not exist.
--    - old table is empty      -> it is dropped and recreated correctly
--    - old table has rows      -> it is renamed to notifications_old_backup
--      (your data is kept; nothing is deleted)
-- ---------------------------------------------------------------------
do $$
declare v_rows bigint;
begin
  if to_regclass('public.notifications') is not null
     and not exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'notifications' and column_name = 'recipient_id'
     )
  then
    execute 'select count(*) from public.notifications' into v_rows;
    if v_rows = 0 then
      drop table public.notifications cascade;
    else
      alter table public.notifications rename to notifications_old_backup;
    end if;
  end if;
end $$;


-- ---------------------------------------------------------------------
-- 1. TABLE
-- ---------------------------------------------------------------------
create table if not exists public.notifications (
  id                       uuid primary key default gen_random_uuid(),
  recipient_id             uuid not null references public.profiles(id) on delete cascade,
  type                     text not null,            -- e.g. chat_message, order_new, delivery_available
  title                    text not null,            -- English fallback
  message                  text not null default '', -- English fallback
  params                   jsonb not null default '{}'::jsonb, -- raw facts used to render EN/MR text
  link                     text,                     -- in-app path to open when tapped
  event_count              integer not null default 1, -- >1 = several chat messages collapsed into one
  is_read                  boolean not null default false,
  read_at                  timestamptz,
  created_at               timestamptz not null default now(),
  related_order_id         uuid,
  related_conversation_id  uuid,
  related_listing_id       uuid,
  related_offer_id         uuid,
  related_dispute_id       uuid
);

create index if not exists notifications_recipient_created_idx
  on public.notifications (recipient_id, created_at desc);
create index if not exists notifications_recipient_unread_idx
  on public.notifications (recipient_id) where is_read = false;
create index if not exists notifications_chat_collapse_idx
  on public.notifications (recipient_id, related_conversation_id)
  where is_read = false and type = 'chat_message';


-- ---------------------------------------------------------------------
-- 2. ROW LEVEL SECURITY  (users read own rows, may only change is_read)
-- ---------------------------------------------------------------------
alter table public.notifications enable row level security;

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
  for select to authenticated
  using (recipient_id = auth.uid());

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

-- No INSERT / DELETE policy: clients can never create or delete notifications.
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (is_read) on public.notifications to authenticated;

-- read_at is maintained automatically
create or replace function public.notifications_set_read_at()
returns trigger language plpgsql as $$
begin
  if new.is_read and not old.is_read then
    new.read_at := now();
  elsif not new.is_read then
    new.read_at := null;
  end if;
  return new;
end $$;

drop trigger if exists notifications_set_read_at on public.notifications;
create trigger notifications_set_read_at
  before update on public.notifications
  for each row execute function public.notifications_set_read_at();

-- Live updates (bell / badge / toast) use Supabase Realtime, same as your chat.
do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception
  when duplicate_object then null;   -- already added
  when undefined_object then null;   -- publication missing (realtime off) – app falls back to polling
end $$;


-- ---------------------------------------------------------------------
-- 3. HELPERS  (internal – execute revoked from clients at the bottom)
-- ---------------------------------------------------------------------

-- Core "create notification". Skips the acting user by default so nobody is
-- notified about something they just did themselves.
create or replace function public.create_notification(
  p_recipient    uuid,
  p_type         text,
  p_title        text,
  p_message      text    default '',
  p_link         text    default null,
  p_params       jsonb   default '{}'::jsonb,
  p_order        uuid    default null,
  p_conversation uuid    default null,
  p_listing      uuid    default null,
  p_offer        uuid    default null,
  p_dispute      uuid    default null,
  p_skip_actor   boolean default true
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if p_recipient is null then return null; end if;
  if p_skip_actor and p_recipient = auth.uid() then return null; end if;

  insert into public.notifications (
    recipient_id, type, title, message, link, params,
    related_order_id, related_conversation_id, related_listing_id,
    related_offer_id, related_dispute_id
  ) values (
    p_recipient, p_type, coalesce(p_title, 'Notification'), coalesce(p_message, ''),
    p_link, coalesce(p_params, '{}'::jsonb),
    p_order, p_conversation, p_listing, p_offer, p_dispute
  ) returning id into v_id;

  return v_id;
end $$;

create or replace function public.notif_name(p_user uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    (select nullif(business_name, '') from public.buyer_profiles where user_id = p_user limit 1),
    (select nullif(full_name, '')      from public.profiles      where id      = p_user limit 1),
    'Someone');
$$;

create or replace function public.notif_listing_name(p_listing uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select nullif(name, '') from public.product_listings where id = p_listing), 'produce');
$$;

create or replace function public.notif_num(p numeric)
returns text language sql immutable as $$
  select trim_scale(round(p, 2))::text;
$$;

create or replace function public.notif_admin_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select id from public.profiles
  where role::text = 'admin' and coalesce(is_suspended, false) = false;
$$;

create or replace function public.notif_delivery_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select id from public.profiles
  where role::text = 'delivery' and coalesce(is_suspended, false) = false;
$$;


-- ---------------------------------------------------------------------
-- 4. CHAT  (new chat + new message)
-- ---------------------------------------------------------------------
create or replace function public.trg_notify_conversation()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_buyer text; v_listing text;
begin
  begin
    v_buyer   := notif_name(new.buyer_id);
    v_listing := notif_listing_name(new.listing_id);
    perform create_notification(
      new.farmer_id, 'chat_new', 'New chat',
      v_buyer || ' started a chat about ' || v_listing || '.',
      '/farmer/chat/' || new.id,
      jsonb_build_object('sender', v_buyer, 'listing', v_listing),
      p_conversation => new.id, p_listing => new.listing_id);
  exception when others then
    raise warning 'notification (conversation) failed: %', sqlerrm;
  end;
  return new;
end $$;

drop trigger if exists notify_conversation on public.conversations;
create trigger notify_conversation after insert on public.conversations
  for each row execute function public.trg_notify_conversation();


create or replace function public.trg_notify_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  c record; v_recipient uuid; v_link text; v_sender text; v_preview text; v_rows int;
begin
  begin
    select farmer_id, buyer_id into c from public.conversations where id = new.conversation_id;
    if not found then return new; end if;

    if new.sender_id = c.farmer_id then
      v_recipient := c.buyer_id;  v_link := '/buyer/chat/'  || new.conversation_id;
    elsif new.sender_id = c.buyer_id then
      v_recipient := c.farmer_id; v_link := '/farmer/chat/' || new.conversation_id;
    else
      return new;
    end if;

    v_sender  := notif_name(new.sender_id);
    v_preview := left(coalesce(new.body, ''), 80);

    -- Several unread messages in the same chat collapse into ONE notification
    -- ("3 new messages from X") instead of spamming the list.
    update public.notifications
       set event_count = event_count + 1,
           title       = (event_count + 1)::text || ' new messages from ' || v_sender,
           message     = v_preview,
           params      = jsonb_build_object('sender', v_sender, 'preview', v_preview),
           created_at  = now()
     where recipient_id = v_recipient
       and type = 'chat_message'
       and related_conversation_id = new.conversation_id
       and is_read = false;
    get diagnostics v_rows = row_count;

    if v_rows = 0 then
      perform create_notification(
        v_recipient, 'chat_message', 'New message from ' || v_sender, v_preview, v_link,
        jsonb_build_object('sender', v_sender, 'preview', v_preview),
        p_conversation => new.conversation_id);
    end if;
  exception when others then
    raise warning 'notification (message) failed: %', sqlerrm;
  end;
  return new;
end $$;

drop trigger if exists notify_message on public.messages;
create trigger notify_message after insert on public.messages
  for each row execute function public.trg_notify_message();


-- ---------------------------------------------------------------------
-- 5. OFFERS  (new order request / new offer / accepted / rejected)
-- ---------------------------------------------------------------------
create or replace function public.trg_notify_offer_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare c record; v_listing text; v_sender text; v_params jsonb; v_price text; v_qty text;
begin
  begin
    select farmer_id, buyer_id, listing_id into c from public.conversations where id = new.conversation_id;
    if not found then return new; end if;

    v_listing := notif_listing_name(c.listing_id);
    v_qty     := notif_num(new.quantity::numeric);
    v_price   := notif_num(new.price_per_kg::numeric);

    if new.made_by::text = 'buyer' then
      v_sender := notif_name(c.buyer_id);
      v_params := jsonb_build_object('sender', v_sender, 'listing', v_listing,
                                     'qty', new.quantity::numeric, 'price', new.price_per_kg::numeric);

      -- "Buy" button creates the chat and the offer together; the order request
      -- supersedes the "New chat" alert, so silently mark that one as read.
      update public.notifications set is_read = true
       where recipient_id = c.farmer_id and type = 'chat_new'
         and related_conversation_id = new.conversation_id
         and is_read = false and created_at > now() - interval '60 seconds';

      perform create_notification(
        c.farmer_id, 'offer_from_buyer', 'New order request',
        v_sender || ' wants ' || v_qty || ' kg of ' || v_listing || ' @ ₹' || v_price || '/kg.',
        '/farmer/orders/pending/' || new.id, v_params,
        p_conversation => new.conversation_id, p_listing => c.listing_id, p_offer => new.id);
    else
      v_sender := notif_name(c.farmer_id);
      v_params := jsonb_build_object('sender', v_sender, 'listing', v_listing,
                                     'qty', new.quantity::numeric, 'price', new.price_per_kg::numeric);
      perform create_notification(
        c.buyer_id, 'offer_from_farmer', 'New offer from farmer',
        v_sender || ' offered ' || v_qty || ' kg of ' || v_listing || ' @ ₹' || v_price || '/kg.',
        '/buyer/chat/' || new.conversation_id, v_params,
        p_conversation => new.conversation_id, p_listing => c.listing_id, p_offer => new.id);
    end if;
  exception when others then
    raise warning 'notification (offer insert) failed: %', sqlerrm;
  end;
  return new;
end $$;

drop trigger if exists notify_offer_insert on public.offers;
create trigger notify_offer_insert after insert on public.offers
  for each row execute function public.trg_notify_offer_insert();


create or replace function public.trg_notify_offer_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  c record; v_status text; v_listing text; v_sender text; v_params jsonb;
  v_recipient uuid; v_link text; v_reason text;
begin
  begin
    v_status := new.status::text;
    if v_status is not distinct from old.status::text then return new; end if;
    if v_status not in ('accepted', 'rejected') then return new; end if;

    select farmer_id, buyer_id, listing_id into c from public.conversations where id = new.conversation_id;
    if not found then return new; end if;

    v_listing := notif_listing_name(c.listing_id);
    v_reason  := nullif(btrim(coalesce(new.rejection_reason, '')), '');

    -- The person who MADE the offer is told what the other side decided.
    if new.made_by::text = 'buyer' then
      v_recipient := c.buyer_id;  v_sender := notif_name(c.farmer_id);
      v_link := case when v_status = 'accepted'
                     then '/buyer/order-summary/' || new.conversation_id
                     else '/buyer/chat/' || new.conversation_id end;
    else
      v_recipient := c.farmer_id; v_sender := notif_name(c.buyer_id);
      v_link := '/farmer/chat/' || new.conversation_id;
    end if;

    v_params := jsonb_build_object('sender', v_sender, 'listing', v_listing,
                                   'qty', new.quantity::numeric, 'price', new.price_per_kg::numeric,
                                   'reason', case when v_status = 'rejected' then v_reason end);

    perform create_notification(
      v_recipient, 'offer_' || v_status,
      case when v_status = 'accepted' then 'Offer accepted' else 'Offer declined' end,
      v_sender || (case when v_status = 'accepted' then ' accepted' else ' declined' end)
        || ' your offer for ' || v_listing || '.'
        || coalesce(' Reason: ' || case when v_status = 'rejected' then v_reason end, ''),
      v_link, v_params,
      p_conversation => new.conversation_id, p_listing => c.listing_id, p_offer => new.id);
  exception when others then
    raise warning 'notification (offer update) failed: %', sqlerrm;
  end;
  return new;
end $$;

drop trigger if exists notify_offer_update on public.offers;
create trigger notify_offer_update after update of status on public.offers
  for each row execute function public.trg_notify_offer_update();


-- ---------------------------------------------------------------------
-- 6. ORDERS  (status changes, delivery broadcast / assignment, payment)
--    Shared functions take the row as jsonb so they don't depend on the
--    exact column types of your orders table.
-- ---------------------------------------------------------------------
create or replace function public.notif_order_event(o jsonb, p_old_status text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_id      uuid := (o->>'id')::uuid;
  v_status  text := o->>'status';
  v_farmer  uuid := (o->>'farmer_id')::uuid;
  v_buyer   uuid := (o->>'buyer_id')::uuid;
  v_mode    text := o->>'delivery_mode';
  v_listing text := notif_listing_name((o->>'listing_id')::uuid);
  v_lid     uuid := (o->>'listing_id')::uuid;
  v_qty     numeric := (o->>'quantity')::numeric;
  v_params  jsonb;
  v_flink   text := '/farmer/orders/' || (o->>'id');
  v_blink   text := '/buyer/orders/'  || (o->>'id');
  v_placed  boolean := p_old_status is not null and p_old_status not in ('negotiating', 'agreed');
  r record;
begin
  if v_status is not distinct from p_old_status then return; end if;
  v_params := jsonb_build_object('listing', v_listing, 'qty', v_qty, 'status', v_status);

  if v_status = 'order_placed' then
    perform create_notification(v_farmer, 'order_new', 'New order received',
      notif_name(v_buyer) || ' placed an order: ' || notif_num(v_qty) || ' kg of ' || v_listing || '. Accept it to start packing.',
      v_flink, v_params || jsonb_build_object('sender', notif_name(v_buyer)),
      p_order => v_id, p_listing => v_lid);

  elsif v_status = 'accepted_by_seller' then
    perform create_notification(v_buyer, 'order_accepted', 'Order accepted',
      'The farmer accepted your order for ' || v_listing || '.', v_blink, v_params,
      p_order => v_id, p_listing => v_lid);

  elsif v_status = 'packing' then
    perform create_notification(v_buyer, 'order_packing', 'Packing started',
      'Your ' || v_listing || ' order is being packed.', v_blink, v_params,
      p_order => v_id, p_listing => v_lid);

  elsif v_status = 'packed' then
    perform create_notification(v_buyer, 'order_packed', 'Order packed',
      'Your ' || v_listing || ' order is packed and ready.', v_blink, v_params,
      p_order => v_id, p_listing => v_lid);

  elsif v_status = 'out_for_delivery' then
    if v_mode = 'pickup' then
      perform create_notification(v_buyer, 'order_ready_pickup', 'Ready for pickup',
        'Your ' || v_listing || ' order is ready. Collect it from the farmer and confirm pickup.', v_blink, v_params,
        p_order => v_id, p_listing => v_lid);
    elsif o->>'delivery_partner_id' is null then
      -- New job for every active delivery partner (first to accept gets it).
      for r in select notif_delivery_ids() as id loop
        perform create_notification(r.id, 'delivery_available', 'New delivery available',
          v_listing || ' · ' || notif_num(v_qty) || ' kg. Accept it before someone else does.',
          '/delivery/dashboard',
          v_params || jsonb_build_object('amount', (o->>'delivery_cost')::numeric),
          p_order => v_id, p_listing => v_lid);
      end loop;
    end if;

  elsif v_status = 'delivered' then
    perform create_notification(v_buyer, 'order_delivered', 'Order delivered',
      'The ' || v_listing || ' order has been delivered.', v_blink, v_params, p_order => v_id, p_listing => v_lid);
    perform create_notification(v_farmer, 'order_delivered', 'Order delivered',
      'The ' || v_listing || ' order has been delivered.', v_flink, v_params, p_order => v_id, p_listing => v_lid);

  elsif v_status = 'completed' then
    perform create_notification(v_buyer, 'order_completed', 'Order completed',
      'The ' || v_listing || ' order is complete.', v_blink, v_params, p_order => v_id, p_listing => v_lid);
    perform create_notification(v_farmer, 'order_completed', 'Order completed',
      'The ' || v_listing || ' order is complete.', v_flink, v_params, p_order => v_id, p_listing => v_lid);

  elsif v_status = 'cancelled' then
    perform create_notification(v_buyer, 'order_cancelled', 'Order cancelled',
      'The ' || v_listing || ' order was cancelled.', v_blink, v_params, p_order => v_id, p_listing => v_lid);
    if v_placed then  -- farmer never saw it if it was cancelled before being placed
      perform create_notification(v_farmer, 'order_cancelled', 'Order cancelled',
        'The ' || v_listing || ' order was cancelled.', v_flink, v_params, p_order => v_id, p_listing => v_lid);
    end if;

  elsif v_status = 'disputed' then
    perform create_notification(v_farmer, 'order_disputed', 'Problem reported',
      'The buyer reported a problem with the ' || v_listing || ' order.', v_flink, v_params,
      p_order => v_id, p_listing => v_lid);

  elsif v_status in ('refund_requested', 'refunded', 'replacement_requested', 'replaced') then
    perform create_notification(v_buyer, 'order_status', 'Order update',
      'The ' || v_listing || ' order is now: ' || replace(v_status, '_', ' ') || '.', v_blink, v_params,
      p_order => v_id, p_listing => v_lid);
    perform create_notification(v_farmer, 'order_status', 'Order update',
      'The ' || v_listing || ' order is now: ' || replace(v_status, '_', ' ') || '.', v_flink, v_params,
      p_order => v_id, p_listing => v_lid);
  end if;
end $$;


create or replace function public.notif_payment_event(o jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_pay     text := o->>'payment_status';
  v_listing text := notif_listing_name((o->>'listing_id')::uuid);
  v_params  jsonb := jsonb_build_object('listing', v_listing, 'qty', (o->>'quantity')::numeric);
  v_type text; v_title text; v_msg text;
begin
  -- Only the buyer is told about payment changes (the farmer already gets
  -- "New order received" the moment a payment confirms the order).
  if v_pay = 'paid' then
    v_type := 'payment_paid';   v_title := 'Payment received';
    v_msg  := 'Payment for the ' || v_listing || ' order was confirmed.';
  elsif v_pay = 'failed' then
    v_type := 'payment_failed'; v_title := 'Payment failed';
    v_msg  := 'Payment for the ' || v_listing || ' order didn''t go through. Please try again.';
  elsif v_pay = 'refunded' then
    v_type := 'payment_refunded'; v_title := 'Payment refunded';
    v_msg  := 'Your payment for the ' || v_listing || ' order was refunded.';
  elsif v_pay = 'cod_collected' then
    v_type := 'payment_cod_collected'; v_title := 'Cash collected';
    v_msg  := 'Cash on Delivery for the ' || v_listing || ' order was marked as collected.';
  else
    return;
  end if;

  perform create_notification((o->>'buyer_id')::uuid, v_type, v_title, v_msg,
    '/buyer/orders/' || (o->>'id'), v_params,
    p_order => (o->>'id')::uuid, p_listing => (o->>'listing_id')::uuid);
end $$;


create or replace function public.notif_delivery_assigned(o jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_id      uuid := (o->>'id')::uuid;
  v_lid     uuid := (o->>'listing_id')::uuid;
  v_partner uuid := (o->>'delivery_partner_id')::uuid;
  v_listing text := notif_listing_name((o->>'listing_id')::uuid);
  v_params  jsonb := jsonb_build_object('listing', v_listing, 'qty', (o->>'quantity')::numeric);
begin
  perform create_notification((o->>'buyer_id')::uuid, 'delivery_partner_assigned', 'Delivery partner assigned',
    'A delivery partner accepted the ' || v_listing || ' order and will pick it up from the farmer.',
    '/buyer/orders/' || v_id, v_params, p_order => v_id, p_listing => v_lid);
  perform create_notification((o->>'farmer_id')::uuid, 'delivery_partner_assigned', 'Delivery partner assigned',
    'A delivery partner accepted the ' || v_listing || ' order and will pick it up from the farmer.',
    '/farmer/orders/' || v_id, v_params, p_order => v_id, p_listing => v_lid);

  -- If somebody OTHER than the partner assigned the job (admin / server),
  -- tell the partner. (Self-claims via the Accept button skip this.)
  if auth.uid() is distinct from v_partner then
    perform create_notification(v_partner, 'delivery_assigned_you', 'New delivery assigned to you',
      v_listing || ', ' || notif_num((o->>'quantity')::numeric) || ' kg — open it to see pickup and drop details.',
      '/delivery/dashboard', v_params, p_order => v_id, p_listing => v_lid, p_skip_actor => false);
  end if;
end $$;


create or replace function public.trg_notify_order_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    perform notif_order_event(to_jsonb(new), null);
  exception when others then
    raise warning 'notification (order insert) failed: %', sqlerrm;
  end;
  return new;
end $$;

create or replace function public.trg_notify_order_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    perform notif_order_event(to_jsonb(new), old.status::text);
  exception when others then
    raise warning 'notification (order status) failed: %', sqlerrm;
  end;
  begin
    if new.payment_status::text is distinct from old.payment_status::text then
      perform notif_payment_event(to_jsonb(new));
    end if;
  exception when others then
    raise warning 'notification (payment) failed: %', sqlerrm;
  end;
  begin
    if new.delivery_partner_id is not null
       and new.delivery_partner_id is distinct from old.delivery_partner_id then
      perform notif_delivery_assigned(to_jsonb(new));
    end if;
  exception when others then
    raise warning 'notification (delivery assignment) failed: %', sqlerrm;
  end;
  return new;
end $$;

drop trigger if exists notify_order_insert on public.orders;
create trigger notify_order_insert after insert on public.orders
  for each row execute function public.trg_notify_order_insert();

drop trigger if exists notify_order_update on public.orders;
create trigger notify_order_update after update of status, payment_status, delivery_partner_id on public.orders
  for each row execute function public.trg_notify_order_update();


-- ---------------------------------------------------------------------
-- 7. DISPUTES  (admin: new dispute · buyer+farmer: resolved)
-- ---------------------------------------------------------------------
create or replace function public.trg_notify_dispute_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record; v_buyer text;
begin
  begin
    v_buyer := notif_name(new.buyer_id);
    for r in select notif_admin_ids() as id loop
      perform create_notification(r.id, 'dispute_new', 'New dispute',
        v_buyer || ' reported: ' || coalesce(new.reason, 'a problem') || '.',
        '/admin/disputes/' || new.id,
        jsonb_build_object('sender', v_buyer, 'reason', new.reason),
        p_order => new.order_id, p_dispute => new.id);
    end loop;
  exception when others then
    raise warning 'notification (dispute insert) failed: %', sqlerrm;
  end;
  return new;
end $$;

create or replace function public.trg_notify_dispute_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_farmer uuid; v_listing text; v_params jsonb; v_res text;
begin
  begin
    if new.status::text = 'resolved' and old.status::text is distinct from 'resolved' then
      select o.farmer_id, notif_listing_name(o.listing_id)
        into v_farmer, v_listing from public.orders o where o.id = new.order_id;
      v_res    := coalesce(new.resolution::text, 'other');
      v_params := jsonb_build_object('listing', v_listing, 'resolution', v_res);

      perform create_notification(new.buyer_id, 'dispute_resolved', 'Dispute resolved',
        'Resolution: ' || replace(v_res, '_', ' ') || '.', '/buyer/orders/' || new.order_id, v_params,
        p_order => new.order_id, p_dispute => new.id);
      perform create_notification(v_farmer, 'dispute_resolved', 'Dispute resolved',
        'Resolution: ' || replace(v_res, '_', ' ') || '.', '/farmer/orders/' || new.order_id, v_params,
        p_order => new.order_id, p_dispute => new.id);
    end if;
  exception when others then
    raise warning 'notification (dispute update) failed: %', sqlerrm;
  end;
  return new;
end $$;

drop trigger if exists notify_dispute_insert on public.disputes;
create trigger notify_dispute_insert after insert on public.disputes
  for each row execute function public.trg_notify_dispute_insert();

drop trigger if exists notify_dispute_update on public.disputes;
create trigger notify_dispute_update after update of status on public.disputes
  for each row execute function public.trg_notify_dispute_update();


-- ---------------------------------------------------------------------
-- 8. LISTINGS  (admin: new / resubmitted · farmer: approved, rejected …)
-- ---------------------------------------------------------------------
create or replace function public.trg_notify_listing_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record; v_farmer text;
begin
  begin
    if new.status::text = 'pending_review' then
      v_farmer := notif_name(new.farmer_id);
      for r in select notif_admin_ids() as id loop
        perform create_notification(r.id, 'listing_new', 'New listing to review',
          v_farmer || ' added ' || new.name || '.', '/admin/listings/' || new.id,
          jsonb_build_object('sender', v_farmer, 'listing', new.name), p_listing => new.id);
      end loop;
    end if;
  exception when others then
    raise warning 'notification (listing insert) failed: %', sqlerrm;
  end;
  return new;
end $$;

create or replace function public.trg_notify_listing_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r record; v_status text; v_reason text; v_farmer text; v_params jsonb;
  v_type text; v_title text; v_msg text;
begin
  begin
    v_status := new.status::text;
    if v_status is not distinct from old.status::text then return new; end if;
    v_reason := nullif(btrim(coalesce(new.rejection_reason, '')), '');

    if v_status = 'pending_review' then
      v_farmer := notif_name(new.farmer_id);
      for r in select notif_admin_ids() as id loop
        perform create_notification(r.id, 'listing_resubmitted', 'Listing resubmitted',
          v_farmer || ' updated ' || new.name || ' for review.', '/admin/listings/' || new.id,
          jsonb_build_object('sender', v_farmer, 'listing', new.name), p_listing => new.id);
      end loop;
      return new;
    end if;

    if    v_status = 'approved'          then v_type := 'listing_approved';          v_title := 'Listing approved';  v_msg := new.name || ' is now live for buyers.';
    elsif v_status = 'rejected'          then v_type := 'listing_rejected';          v_title := 'Listing rejected';  v_msg := new.name || ' was rejected.';
    elsif v_status = 'changes_requested' then v_type := 'listing_changes_requested'; v_title := 'Changes requested'; v_msg := 'Admin asked for changes to ' || new.name || '.';
    elsif v_status = 'suspended'         then v_type := 'listing_suspended';         v_title := 'Listing suspended'; v_msg := new.name || ' was suspended by admin.';
    else return new;
    end if;

    if v_reason is not null and v_status <> 'approved' then
      v_msg := v_msg || ' Reason: ' || v_reason;
    end if;
    v_params := jsonb_build_object('listing', new.name,
                                   'reason', case when v_status <> 'approved' then v_reason end);

    perform create_notification(new.farmer_id, v_type, v_title, v_msg, '/farmer/listings', v_params,
      p_listing => new.id);
  exception when others then
    raise warning 'notification (listing update) failed: %', sqlerrm;
  end;
  return new;
end $$;

drop trigger if exists notify_listing_insert on public.product_listings;
create trigger notify_listing_insert after insert on public.product_listings
  for each row execute function public.trg_notify_listing_insert();

drop trigger if exists notify_listing_update on public.product_listings;
create trigger notify_listing_update after update of status on public.product_listings
  for each row execute function public.trg_notify_listing_update();


-- ---------------------------------------------------------------------
-- 9. NEW USERS (admin)  and  SETTLEMENTS (farmer / delivery partner)
-- ---------------------------------------------------------------------
create or replace function public.trg_notify_profile_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record; v_role text; v_link text;
begin
  begin
    v_role := new.role::text;
    if v_role in ('farmer', 'buyer', 'delivery') then
      v_link := case v_role when 'farmer' then '/admin/farmers'
                            when 'buyer'  then '/admin/buyers'
                            else '/admin/dashboard' end;
      for r in select notif_admin_ids() as id loop
        perform create_notification(r.id, 'user_new', 'New ' || v_role || ' signed up',
          coalesce(new.full_name, 'Someone') || ' joined Kissaan Saathi.', v_link,
          jsonb_build_object('sender', coalesce(new.full_name, 'Someone'), 'role', v_role));
      end loop;
    end if;
  exception when others then
    raise warning 'notification (profile insert) failed: %', sqlerrm;
  end;
  return new;
end $$;

drop trigger if exists notify_profile_insert on public.profiles;
create trigger notify_profile_insert after insert on public.profiles
  for each row execute function public.trg_notify_profile_insert();


create or replace function public.trg_notify_farmer_settlement()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    perform create_notification(new.farmer_id, 'settlement_paid', 'Payout sent',
      '₹' || notif_num(new.amount_paid::numeric) || ' was paid to you (UTR ' || coalesce(new.utr_reference, '-') || ').',
      '/farmer/earnings',
      jsonb_build_object('amount', new.amount_paid::numeric, 'utr', new.utr_reference));
  exception when others then
    raise warning 'notification (farmer settlement) failed: %', sqlerrm;
  end;
  return new;
end $$;

create or replace function public.trg_notify_delivery_settlement()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    perform create_notification(new.delivery_partner_id, 'settlement_paid', 'Payout sent',
      '₹' || notif_num(new.amount_paid::numeric) || ' was paid to you (UTR ' || coalesce(new.utr_reference, '-') || ').',
      '/delivery/earnings',
      jsonb_build_object('amount', new.amount_paid::numeric, 'utr', new.utr_reference));
  exception when others then
    raise warning 'notification (delivery settlement) failed: %', sqlerrm;
  end;
  return new;
end $$;

drop trigger if exists notify_farmer_settlement on public.farmer_settlements;
create trigger notify_farmer_settlement after insert on public.farmer_settlements
  for each row execute function public.trg_notify_farmer_settlement();

drop trigger if exists notify_delivery_settlement on public.delivery_settlements;
create trigger notify_delivery_settlement after insert on public.delivery_settlements
  for each row execute function public.trg_notify_delivery_settlement();


-- ---------------------------------------------------------------------
-- 10. LOCK DOWN: none of the internal functions may be called from the
--     browser (otherwise a user could spam others / look up names by id).
-- ---------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and (p.proname like 'notif\_%' or p.proname like 'trg\_notify\_%' or p.proname = 'create_notification')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', r.sig);
  end loop;
end $$;

-- Server-only helper (lib/notifications/server.ts uses this with the service role)
grant execute on function public.create_notification(
  uuid, text, text, text, text, jsonb, uuid, uuid, uuid, uuid, uuid, boolean
) to service_role;


-- ---------------------------------------------------------------------
-- OPTIONAL housekeeping — run occasionally (or schedule with pg_cron):
--   delete from public.notifications
--    where is_read and created_at < now() - interval '90 days';
-- ---------------------------------------------------------------------
