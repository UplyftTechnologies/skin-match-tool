-- Wishlist reminder push notifications.
-- Run this once in the Supabase SQL editor (Project > SQL Editor > New query).
-- Only the server (service role key) reads/writes these tables, so RLS is
-- enabled with no policies — the anon/authenticated roles get no access.

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  visitor_id text not null,
  user_id uuid references auth.users(id) on delete set null,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  user_agent text,
  disabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_visitor_id_idx
  on push_subscriptions (visitor_id)
  where not disabled;

alter table push_subscriptions enable row level security;

-- One pending reminder per visitor at a time: adding a second wishlist item
-- while a reminder is already pending does not schedule a second push. The
-- partial unique index below is what enforces that debounce at the DB level.
create table if not exists wishlist_reminders (
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
  on wishlist_reminders (visitor_id)
  where status = 'pending';

create index if not exists wishlist_reminders_due_idx
  on wishlist_reminders (status, send_at);

alter table wishlist_reminders enable row level security;
