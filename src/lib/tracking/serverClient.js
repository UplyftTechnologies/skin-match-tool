// lib/supabase/serverClient.js
// Server-only Supabase client. Uses the SERVICE ROLE key — never import this
// from a "use client" file or expose it via NEXT_PUBLIC_*.
import { createClient } from '@supabase/supabase-js';

let serverClient = null;

export function getSupabaseServerClient() {
  if (serverClient) return serverClient;

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error(
      '[supabase] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing on the server — event API route will fail.'
    );
    return null;
  }

  serverClient = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
  return serverClient;
}