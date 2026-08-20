-- Consolidates the app's "main" Supabase project onto the roopsee project.
-- Run this ONCE in the roopsee project's SQL editor (the same project
-- ROOPSEE_NEXT_PUBLIC_SUPABASE_URL points at, which already holds
-- roopsee_products). This is a FRESH START, not a data migration — these
-- tables are created empty. Existing accounts, wishlists, alert history and
-- event logs on the old main project are left in place, untouched, and
-- simply no longer read by the app once .env is repointed (see step 4 of
-- the migration plan).
--
-- Column definitions for users / event_log / quiz_results / retailer_products
-- were reconstructed from the live main project's PostgREST OpenAPI schema
-- (no SQL source existed for them in this repo). wishlist is copied from
-- supabase_wishlist_table.sql; wishlist_reminders/push_subscriptions and
-- price_drop_alerts/known_products are copied from 0001_wishlist_reminders.sql
-- and 0002_product_alerts.sql respectively.

-- ── users ───────────────────────────────────────────────────────────────
-- Profile row for a Supabase Auth user, keyed 1:1 to auth.users.
create table if not exists public.users (
  id uuid primary key default gen_random_uuid() references auth.users(id) on delete cascade,
  email text,
  name text,
  phone_no text,
  skin_type text,
  skin_concerns text[],
  skin_quiz jsonb,
  whatsapp text,
  skin_score integer,
  role text not null default 'user',
  products jsonb[],
  address text,
  gender text,
  phone_verified boolean not null default false,
  phone_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

alter table public.users enable row level security;

-- ── wishlist ────────────────────────────────────────────────────────────
create table if not exists public.wishlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_uid text not null,
  created_at timestamptz not null default now(),
  unique (user_id, product_uid)
);

alter table public.wishlist enable row level security;

-- The app's API routes always use the service-role key server-side, so this
-- policy isn't load-bearing for them — it's just a safety net in case the
-- table is ever queried with the anon/client key directly.
create policy "Users manage their own wishlist"
  on public.wishlist
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── push_subscriptions + wishlist_reminders ────────────────────────────
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  visitor_id text not null,
  user_id uuid references auth.users(id) on delete set null,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  user_agent text,
  disabled boolean not null default false,
  notify_new_products boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_visitor_id_idx
  on public.push_subscriptions (visitor_id)
  where not disabled;

alter table public.push_subscriptions enable row level security;

create table if not exists public.wishlist_reminders (
  id uuid primary key default gen_random_uuid(),
  visitor_id text not null,
  session_id text,
  user_id uuid references auth.users(id) on delete set null,
  product_uid text not null,
  product_name text,
  created_at timestamptz not null default now(),
  send_at timestamptz not null,
  sent_at timestamptz,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'cancelled', 'failed')),
  failure_reason text
);

create unique index if not exists wishlist_reminders_one_pending_per_visitor
  on public.wishlist_reminders (visitor_id)
  where status = 'pending';

create index if not exists wishlist_reminders_due_idx
  on public.wishlist_reminders (status, send_at);

alter table public.wishlist_reminders enable row level security;

-- ── price_drop_alerts + known_products ─────────────────────────────────
create table if not exists public.price_drop_alerts (
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
  on public.price_drop_alerts (status)
  where status = 'active';

alter table public.price_drop_alerts enable row level security;

create table if not exists public.known_products (
  product_uid text primary key,
  first_seen_at timestamptz not null default now()
);

alter table public.known_products enable row level security;

-- ── event_log ───────────────────────────────────────────────────────────
create table if not exists public.event_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  user_name text,
  phone_no text,
  visitor_id text,
  session_id text,
  country text,
  city text,
  region text,
  ip_address text,
  device text,
  platform text,
  browser text,
  language text,
  time_ist text,
  page_link text,
  event_name text not null,
  value text,
  referrer text,
  extra_data jsonb,
  created_at timestamptz not null default now()
);

alter table public.event_log enable row level security;

-- ── quiz_results ────────────────────────────────────────────────────────
create table if not exists public.quiz_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  guest_session_id text,
  gender text,
  age text,
  skin_type text,
  key_skin_concerns jsonb,
  answers jsonb,
  phone_no text,
  quiz_number integer not null default 1,
  completed_at timestamptz not null default now(),
  created_at timestamptz
);

alter table public.quiz_results enable row level security;

-- ── retailer_products ───────────────────────────────────────────────────
-- Populated by an external scraper pipeline that lives outside this repo,
-- not by this app (the app only ever SELECTs from it). It will stay empty
-- here until that pipeline is repointed at the roopsee project too.
create table if not exists public.retailer_products (
  id bigint generated always as identity primary key,
  site text not null,
  parent_product_id text not null default '',
  product_id text not null,
  sku text not null default '',
  categories text[] not null,
  source_categories text[] not null,
  brand text not null default '',
  product_name text not null default '',
  variant text not null default '',
  mrp numeric,
  selling_price numeric,
  discount_pct numeric,
  rating numeric,
  rating_count bigint,
  review_count bigint,
  in_stock boolean,
  product_url text not null default '',
  image_url text not null default '',
  image_urls text[] not null,
  description text not null default '',
  description_html text not null default '',
  ingredients text not null default '',
  how_to_use text not null default '',
  key_features text[] not null,
  special_features text[] not null,
  product_attributes jsonb not null,
  rating_breakdown jsonb not null,
  top_reviews jsonb not null,
  gtin text not null default '',
  key_ingredients text[] not null,
  source_fingerprint text not null default '',
  detail_fingerprint text not null default '',
  scraped_at timestamptz not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_checked_at timestamptz not null default now(),
  last_changed_at timestamptz not null default now(),
  last_detail_scraped_at timestamptz,
  last_seen_run_id uuid,
  detail_refresh_pending boolean not null default false,
  detail_unavailable boolean not null default false,
  missing_run_count integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.retailer_products enable row level security;
