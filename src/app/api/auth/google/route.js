import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin, supabaseAuth } from '@/lib/supabase/server';

// Must match the Web Client ID configured in the app (src/config/google.ts),
// so a token minted for a different OAuth client can't be replayed here.
const GOOGLE_WEB_CLIENT_ID = process.env.GOOGLE_WEB_CLIENT_ID;

function generateDeterministicPassword(email, serviceKey) {
  return crypto
    .createHash('sha256')
    .update(`${email}:${serviceKey}`)
    .digest('hex');
}

// listUsers() without pagination only returns its first page, so a match
// past that page was being missed entirely -- mirrors the full paginated
// scan verify-otp/route.js already uses for the same reason. Case-insensitive
// since Google/Supabase don't guarantee matching casing round-trips.
async function findAuthUserByEmail(email) {
  const perPage = 1000;
  const target = email.toLowerCase();

  for (let page = 1; ; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const users = data?.users || [];
    const match = users.find((u) => u.email?.toLowerCase() === target);
    if (match) return match;

    if (users.length < perPage) return null;
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { idToken } = body;

    if (!idToken) {
      return NextResponse.json(
        { success: false, error: 'idToken is required' },
        { status: 400 }
      );
    }

    // Step 1: Verify the ID token against Google directly (no extra SDK —
    // same lightweight-fetch style as the MSG91 verify-otp route).
    const verifyRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
    );
    const claims = await verifyRes.json();

    if (!verifyRes.ok || claims.error) {
      return NextResponse.json(
        { success: false, error: claims.error_description || 'Invalid Google token' },
        { status: 400 }
      );
    }

    if (GOOGLE_WEB_CLIENT_ID && claims.aud !== GOOGLE_WEB_CLIENT_ID) {
      return NextResponse.json(
        { success: false, error: 'Token audience mismatch' },
        { status: 400 }
      );
    }

    if (claims.email_verified !== 'true' && claims.email_verified !== true) {
      return NextResponse.json(
        { success: false, error: 'Google email is not verified' },
        { status: 400 }
      );
    }

    const email = claims.email;
    const name = claims.name;
    const picture = claims.picture;
    const googleSub = claims.sub;

    // Step 2: Supabase sync — look up by email in auth.users.
    const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'default_salt';
    const password = generateDeterministicPassword(email, serviceKey);

    let authUserId = null;
    let existingAuthUser = null;

    try {
      existingAuthUser = await findAuthUserByEmail(email);
    } catch (err) {
      console.warn('Error listing auth.users:', err.message);
    }

    if (existingAuthUser) {
      authUserId = existingAuthUser.id;
      await supabaseAdmin.auth.admin.updateUserById(authUserId, {
        password,
        email_confirm: true,
        user_metadata: {
          ...existingAuthUser.user_metadata,
          full_name: name,
          avatar_url: picture,
          google_sub: googleSub,
        },
      });
    } else {
      const createRes = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: name,
          avatar_url: picture,
          google_sub: googleSub,
        },
      });

      if (createRes.error) {
        if (createRes.error.message?.toLowerCase()?.includes('already exists') || createRes.error.status === 422) {
          const matched = await findAuthUserByEmail(email);
          if (matched) {
            authUserId = matched.id;
            await supabaseAdmin.auth.admin.updateUserById(authUserId, { password });
          } else {
            return NextResponse.json(
              { success: false, error: 'User conflicts in auth database' },
              { status: 500 }
            );
          }
        } else {
          return NextResponse.json(
            { success: false, error: `Failed to create auth user: ${createRes.error.message}` },
            { status: 500 }
          );
        }
      } else {
        authUserId = createRes.data.user.id;
      }
    }

    // Check public.users
    let existingPublicUser = null;
    try {
      const { data } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('id', authUserId)
        .maybeSingle();
      existingPublicUser = data;
    } catch (err) {
      console.warn('Could not query public.users table:', err.message);
    }

    const isNewUser = !existingPublicUser;

    // Upsert into public.users
    try {
      const now = new Date().toISOString();
      await supabaseAdmin.from('users').upsert(
        {
          id: authUserId,
          email,
          updated_at: now,
        },
        { onConflict: 'id' }
      );
    } catch (dbErr) {
      console.warn('Warning: Failed upserting to public.users table:', dbErr.message);
    }

    // Step 3: Mint a Supabase session.
    const { data: sessionData, error: sessionError } = await supabaseAuth.auth.signInWithPassword({
      email,
      password,
    });

    if (sessionError || !sessionData?.session) {
      console.error('Session minting error:', sessionError);
      return NextResponse.json(
        { success: false, error: sessionError?.message || 'Failed to mint Supabase session' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      token: sessionData.session.access_token,
      refresh_token: sessionData.session.refresh_token,
      user: sessionData.user,
      is_new_user: isNewUser,
    });
  } catch (error) {
    console.error('Google Sign-In API Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
