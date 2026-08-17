import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin, supabaseAuth } from '@/lib/supabase/server';

function normalizePhone(mobile) {
  if (!mobile) return '';
  const digits = String(mobile).replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length >= 12) return `+${digits}`;
  return `+91${digits}`;
}

function generateDeterministicPassword(phone, serviceKey) {
  return crypto
    .createHash('sha256')
    .update(`${phone}:${serviceKey}`)
    .digest('hex');
}

function matchesPhone(user, cleanTargetPhone, syntheticEmail) {
  const digits = (value) => (value ? String(value).replace(/\D/g, '') : '');
  return (
    digits(user.phone) === cleanTargetPhone ||
    (user.email && user.email === syntheticEmail) ||
    digits(user.user_metadata?.phone_no) === cleanTargetPhone ||
    digits(user.user_metadata?.phone) === cleanTargetPhone
  );
}

/**
 * Resolves the existing auth.users row for a phone number, or null.
 *
 * Tries public.users first (one indexed query), then falls back to scanning
 * auth.users. That scan MUST paginate: supabaseAdmin.auth.admin.listUsers()
 * sends an empty per_page, so GoTrue applies its default of 50 and silently
 * returns only the first page. Calling it unpaginated made every returning user
 * past the 50th invisible here — the lookup missed them, createUser then
 * correctly reported "already exists", and the request died as a 500.
 */
async function findExistingAuthUser({ formattedPhone, cleanTargetPhone, syntheticEmail }) {
  // 1. public.users carries phone_no for everyone this route has ever created.
  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id')
      .in('phone_no', [formattedPhone, cleanTargetPhone])
      .limit(1);

    if (error) {
      console.warn('[verify-otp] public.users phone lookup failed:', error.message);
    } else if (data?.[0]?.id) {
      const { data: byId, error: byIdErr } = await supabaseAdmin.auth.admin.getUserById(data[0].id);
      if (!byIdErr && byId?.user) return byId.user;
      // Orphaned public.users row (auth user deleted) — fall through to the scan.
    }
  } catch (err) {
    console.warn('[verify-otp] public.users phone lookup threw:', err.message);
  }

  // 2. Paginated scan of auth.users, for users predating the public.users
  //    mirror or created by another flow.
  const perPage = 1000;
  const maxPages = 100; // hard stop so a bad cursor can't spin forever

  for (let page = 1; page <= maxPages; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });

    if (error) {
      console.warn(`[verify-otp] listUsers page ${page} failed:`, error.message);
      return null;
    }

    const users = data?.users || [];
    const match = users.find((u) => matchesPhone(u, cleanTargetPhone, syntheticEmail));
    if (match) return match;
    if (users.length < perPage) return null; // last page reached
  }

  console.warn('[verify-otp] listUsers scan hit the page cap without a match');
  return null;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { accessToken } = body;

    if (!accessToken) {
      return NextResponse.json(
        { success: false, error: 'Access token is required' },
        { status: 400 }
      );
    }

    const authKeysToTry = [
      process.env.MSG91_TOKEN_AUTH,
      process.env.NEXT_PUBLIC_MSG91_TOKEN_AUTH,
      process.env.MSG91_AUTHKEY,
    ].filter(Boolean);

    let msg91Response = null;
    let lastFetchErr = null;

    // Step 1: Try validating access token against MSG91 verification endpoint
    for (const authkey of authKeysToTry) {
      try {
        const verifyRes = await fetch('https://control.msg91.com/api/v5/widget/verifyAccessToken', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            authkey,
            'access-token': accessToken,
          }),
        });

        const resData = await verifyRes.json();
        msg91Response = resData;

        const gotSuccess =
          resData?.type === 'success' ||
          Boolean(resData?.data?.mobile) ||
          Boolean(resData?.mobile) ||
          Boolean(resData?.data?.identifier) ||
          Boolean(resData?.identifier);

        if (gotSuccess) break;
      } catch (err) {
        lastFetchErr = err;
      }
    }

    if (!msg91Response) {
      return NextResponse.json(
        { success: false, error: 'MSG91 verification request failed' },
        { status: 502 }
      );
    }

    const isSuccess =
      msg91Response?.type === 'success' ||
      msg91Response?.message?.toLowerCase()?.includes('verified') ||
      msg91Response?.msg?.toLowerCase()?.includes('verified');

    const mobile =
      msg91Response?.data?.mobile ||
      msg91Response?.mobile ||
      msg91Response?.data?.identifier ||
      msg91Response?.identifier ||
      (msg91Response?.message && /^\d+$/.test(String(msg91Response.message).trim())
        ? String(msg91Response.message).trim()
        : null);

    if (!isSuccess || !mobile) {
      return NextResponse.json(
        {
          success: false,
          error: msg91Response?.message || msg91Response?.error || 'OTP verification failed. Please try again.',
          debug: msg91Response,
        },
        { status: 400 }
      );
    }

    // Step 2: Normalize Phone Number
    const formattedPhone = normalizePhone(mobile);
    const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'default_salt';
    const password = generateDeterministicPassword(formattedPhone, serviceKey);

    // Step 3: Supabase Sync - Lookup auth.users
    const cleanTargetPhone = formattedPhone.replace(/\D/g, '');
    const syntheticEmail = `${cleanTargetPhone}@phone.roopsee.internal`;
    const lookupArgs = { formattedPhone, cleanTargetPhone, syntheticEmail };
    let existingAuthUser = null;
    let authUserId = null;

    try {
      existingAuthUser = await findExistingAuthUser(lookupArgs);
    } catch (err) {
      console.warn('Error resolving existing auth user:', err.message);
    }

    if (existingAuthUser) {
      authUserId = existingAuthUser.id;
      const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(authUserId, {
        password,
        phone: formattedPhone,
        phone_confirm: true,
        email_confirm: true,
        user_metadata: {
          ...existingAuthUser.user_metadata,
          phone_verified: true,
        },
      });

      // The deterministic password must land, or the sign-in below fails with a
      // misleading "invalid credentials". Retry without the phone fields, which
      // are what fail when phone auth is disabled on the project.
      if (updateErr) {
        console.warn('[verify-otp] updateUserById failed, retrying without phone:', updateErr.message);
        const { error: retryErr } = await supabaseAdmin.auth.admin.updateUserById(authUserId, {
          password,
          email_confirm: true,
        });
        if (retryErr) {
          console.error('[verify-otp] could not reset password for existing user:', retryErr.message);
          return NextResponse.json(
            { success: false, error: `Could not update existing account: ${retryErr.message}` },
            { status: 500 }
          );
        }
      }
    } else {
      // Create new user in auth.users (with phone + synthetic email fallback)
      const createPayload = {
        email: syntheticEmail,
        phone: formattedPhone,
        password,
        phone_confirm: true,
        email_confirm: true,
        user_metadata: {
          phone_verified: true,
          phone_no: formattedPhone,
        },
      };

      let createRes = await supabaseAdmin.auth.admin.createUser(createPayload);

      // If phone creation fails due to provider settings, retry without explicit phone param
      if (createRes.error) {
        delete createPayload.phone;
        delete createPayload.phone_confirm;
        createRes = await supabaseAdmin.auth.admin.createUser(createPayload);
      }

      if (createRes.error) {
        if (createRes.error.message?.toLowerCase()?.includes('already exists') || createRes.error.status === 422) {
          // Same paginated resolver — the old inline listUsers() call here read
          // only the first 50 users, so this branch reported a bogus conflict.
          const matched = await findExistingAuthUser(lookupArgs);

          if (matched) {
            authUserId = matched.id;
            const { error: pwErr } = await supabaseAdmin.auth.admin.updateUserById(authUserId, {
              password,
            });
            if (pwErr) {
              console.error('[verify-otp] password reset failed for conflicting user:', pwErr.message);
              return NextResponse.json(
                { success: false, error: `Could not update existing account: ${pwErr.message}` },
                { status: 500 }
              );
            }
          } else {
            // Genuinely unresolvable. Surface the underlying cause -- the usual
            // remaining case is a soft-deleted user still holding the unique
            // email/phone index while being excluded from listUsers.
            console.error(
              '[verify-otp] auth user reported as existing but not findable.',
              { phone: formattedPhone, syntheticEmail, createError: createRes.error.message }
            );
            return NextResponse.json(
              {
                success: false,
                error: 'This number is already registered but its account could not be loaded. Please contact support.',
                detail: createRes.error.message,
              },
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

    // Check public.users. supabase-js resolves with { error } rather than
    // throwing, so the error has to be read explicitly -- a try/catch alone
    // silently treats a failed query as "no row", i.e. a brand new user.
    let existingPublicUser = null;
    try {
      const { data, error } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('id', authUserId)
        .maybeSingle();
      if (error) {
        console.warn('Could not query public.users table:', error.message);
      }
      existingPublicUser = data;
    } catch (err) {
      console.warn('public.users query threw:', err.message);
    }

    const isNewUser = !existingPublicUser;

    // Upsert into public.users
    try {
      const now = new Date().toISOString();
      const { error: upsertErr } = await supabaseAdmin.from('users').upsert(
        {
          id: authUserId,
          phone_no: formattedPhone,
          phone_verified: true,
          phone_verified_at: now,
          updated_at: now,
        },
        { onConflict: 'id' }
      );
      // Not fatal to the login, but it must be visible: this row is what the
      // phone lookup above depends on for the next sign-in.
      if (upsertErr) {
        console.error('Failed upserting to public.users table:', upsertErr.message);
      }
    } catch (dbErr) {
      console.error('public.users upsert threw:', dbErr.message);
    }

    // Step 4: Mint Supabase Session (Try phone first, then synthetic email fallback)
    let sessionData = null;
    let sessionError = null;

    try {
      const res = await supabaseAuth.auth.signInWithPassword({
        phone: formattedPhone,
        password,
      });
      sessionData = res.data;
      sessionError = res.error;
    } catch (err) {
      sessionError = err;
    }

    // Fallback 1: Try phone without '+'
    if (sessionError || !sessionData?.session) {
      try {
        const res2 = await supabaseAuth.auth.signInWithPassword({
          phone: formattedPhone.replace('+', ''),
          password,
        });
        sessionData = res2.data;
        sessionError = res2.error;
      } catch (err2) {
        sessionError = err2;
      }
    }

    // Fallback 2: If phone login disabled in Supabase dashboard, sign in via synthetic email
    if (sessionError || !sessionData?.session) {
      try {
        const res3 = await supabaseAuth.auth.signInWithPassword({
          email: syntheticEmail,
          password,
        });
        sessionData = res3.data;
        sessionError = res3.error;
      } catch (err3) {
        sessionError = err3;
      }
    }

    if (sessionError || !sessionData?.session) {
      console.error('Session minting error:', sessionError);
      return NextResponse.json(
        {
          success: false,
          error: sessionError?.message || 'Failed to mint Supabase session',
        },
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
    console.error('Verify OTP API Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

