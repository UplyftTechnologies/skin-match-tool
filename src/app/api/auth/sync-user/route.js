import { NextResponse } from 'next/server';
import { supabaseAdmin, supabaseAuth } from '@/lib/supabase/server';

export const runtime = 'nodejs';

// Mirrors the public.users upsert that the phone/OTP flow does in
// verify-otp/route.js, but for any Supabase-native sign-in (Google, etc.)
// that never passes through that custom backend.
export async function POST(request) {
  const authorization = request.headers.get('authorization') || '';
  if (!authorization.startsWith('Bearer ')) {
    return NextResponse.json({ success: false, error: 'Authentication is required' }, { status: 401 });
  }

  const token = authorization.slice(7).trim();
  const { data, error } = await supabaseAuth.auth.getUser(token);
  if (error || !data.user) {
    return NextResponse.json({ success: false, error: 'Invalid session' }, { status: 401 });
  }

  const user = data.user;
  const now = new Date().toISOString();

  // Optional body lets the post-Google "complete profile" step supply a
  // name/phone Google never gives us; omitted fields are left untouched.
  let body = {};
  try {
    body = await request.json();
  } catch {
    // No JSON body sent — fall back to whatever Supabase already knows.
  }

  const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : null;
  const phone = typeof body.phone === 'string' && body.phone.trim() ? body.phone.trim() : null;

  try {
    await supabaseAdmin.from('users').upsert(
      {
        id: user.id,
        phone_no: phone || user.phone || user.user_metadata?.phone_no || null,
        ...(name ? { name } : {}),
        updated_at: now,
      },
      { onConflict: 'id' },
    );
  } catch (err) {
    console.warn('[api/auth/sync-user] public.users upsert failed:', err.message);
  }

  // Also mirror into auth.users' metadata — the callback page's "does this
  // user already have a phone" check reads session.user, not public.users,
  // so without this the complete-profile step would resurface on every login.
  if (name || phone) {
    try {
      await supabaseAdmin.auth.admin.updateUserById(user.id, {
        user_metadata: {
          ...user.user_metadata,
          ...(name ? { full_name: name } : {}),
          ...(phone ? { phone_no: phone } : {}),
        },
      });
    } catch (err) {
      console.warn('[api/auth/sync-user] auth.users metadata update failed:', err.message);
    }
  }

  return NextResponse.json({ success: true });
}
