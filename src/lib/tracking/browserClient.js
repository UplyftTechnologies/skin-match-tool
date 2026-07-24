// lib/supabase/browserClient.js
// Client-side Supabase client. Uses the public anon key — safe to ship to
// the browser as long as your RLS policies on event_log only allow inserts,
// not reads/updates/deletes, for the anon role.
'use client';

import { createClient } from '@supabase/supabase-js';

let browserClient = null;

export function getSupabaseBrowserClient() {
  if (browserClient) return browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    console.warn(
      '[supabase] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY missing — client inserts will be skipped.'
    );
    return null;
  }

  browserClient = createClient(url, anonKey);
  return browserClient;
}