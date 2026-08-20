-- Partnership inquiry submissions from the "Let's build something together"
-- form on /partner. Run this once in the roopsee project's SQL editor.

create table if not exists public.partnership_inquiries (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  brand_name text,
  work_email text not null,
  phone_number text,
  status text not null default 'new'
    check (status in ('new', 'contacted', 'closed')),
  created_at timestamptz not null default now()
);

create index if not exists partnership_inquiries_created_at_idx
  on public.partnership_inquiries (created_at desc);

-- Only the server (service role key) reads/writes this table, so RLS is
-- enabled with no policies.
alter table public.partnership_inquiries enable row level security;
