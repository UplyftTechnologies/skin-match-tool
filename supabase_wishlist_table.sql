-- Run this once in the Supabase SQL editor (Project → SQL Editor) for the
-- matchmyskin.roopsee.com project's database. Creates the table the new
-- /api/wishlist route reads/writes.

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
