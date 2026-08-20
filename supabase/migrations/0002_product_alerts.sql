-- Price drop alerts + new product update alerts (push notifications).
-- Run this once in the Supabase SQL editor (Project > SQL Editor > New query).
-- Only the server (service role key) reads/writes these tables, so RLS is
-- enabled with no policies — the anon/authenticated roles get no access.

-- One row per (visitor, product) a shopper asked to be notified about. The
-- plain (not partial) unique constraint lets a resubscribe upsert straight
-- onto the same row regardless of its current status, instead of needing a
-- partial-index-aware ON CONFLICT clause that supabase-js can't express.
create table if not exists price_drop_alerts (
  id uuid primary key default gen_random_uuid(),
  visitor_id text not null,
  user_id uuid references auth.users(id) on delete set null,
  product_uid text not null,
  product_name text,
  watch_price numeric not null,
  last_notified_price numeric,
  status text not null default 'active'
    check (status in ('active', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (visitor_id, product_uid)
);

create index if not exists price_drop_alerts_active_idx
  on price_drop_alerts (status)
  where status = 'active';

alter table price_drop_alerts enable row level security;

-- Opt-in flag per push subscription for "new product added" broadcasts.
alter table push_subscriptions
  add column if not exists notify_new_products boolean not null default false;

-- Ledger of catalog product_uids the new-product cron has already seen, so it
-- can diff against roopsee_products and only notify about genuinely new
-- arrivals — not the whole catalog on its first-ever run.
create table if not exists known_products (
  product_uid text primary key,
  first_seen_at timestamptz not null default now()
);

alter table known_products enable row level security;
