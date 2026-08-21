-- Onboarding notification drip.
-- Run once in the Supabase SQL editor (Project > SQL Editor > New query).
-- Only the server (service role key) touches this, so RLS is on with no
-- policies — anon/authenticated get no access, same as the wishlist tables.

-- One row per (visitor, message) that has actually been delivered.
--
-- The unique constraint is the whole point: the cron runs every few minutes and
-- two overlapping runs would otherwise each see the same message as "not sent
-- yet" and deliver it twice. Writing the log row BEFORE sending, and letting a
-- duplicate key fail the claim, makes double-sending impossible rather than
-- unlikely.
create table if not exists push_message_log (
  id uuid primary key default gen_random_uuid(),
  visitor_id text not null,
  message_id text not null,
  sent_at timestamptz not null default now(),
  status text not null default 'sent'
    check (status in ('sent', 'failed')),
  failure_reason text,
  constraint push_message_log_visitor_message_key unique (visitor_id, message_id)
);

create index if not exists push_message_log_visitor_id_idx
  on push_message_log (visitor_id);

alter table push_message_log enable row level security;
