import { NextResponse, after } from 'next/server';
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

// AuthRetryableFetchError is supabase-js's own name for "transient failure
// talking to the Admin API, safe to retry" — without this, a one-off blip
// turns into a hard failure on an otherwise-valid login.
async function withRetry(operation, { retries = 2, delayMs = 250, label = 'op' } = {}) {
  let last;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const t0 = Date.now();
    last = await operation();
    console.log(
      `[withRetry:${label}] attempt=${attempt + 1} time=${Date.now() - t0}ms error=${last?.error ? `${last.error.name}: ${last.error.message} (status=${last.error.status})` : 'none'}`
    );
    if (!last?.error || last.error.name !== 'AuthRetryableFetchError') return last;
    if (attempt < retries) await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)));
  }
  return last;
}

// Full paginated scan of auth.users — only a fallback now for users who
// somehow don't have a public.users row yet (e.g. mid-signup, or created
// via a different flow). The hot path uses the indexed phone_no lookup below.
async function findAuthUser(cleanPhone, syntheticEmail) {
  const perPage = 1000;
  let emailMatch = null;
  let metadataMatch = null;

  for (let page = 1; ; page += 1) {
    const { data, error } = await withRetry(() => supabaseAdmin.auth.admin.listUsers({ page, perPage }), { label: 'listUsers' });
    if (error) throw error;

    const users = data?.users || [];
    for (const user of users) {
      // The canonical phone owner must win over historical OAuth metadata or
      // synthetic-email records, even when it appears on a later page.
      if (user.phone?.replace(/\D/g, '') === cleanPhone) return user;

      if (!emailMatch && user.email?.toLowerCase() === syntheticEmail.toLowerCase()) {
        emailMatch = user;
      }

      const metadataPhone = user.user_metadata?.phone_no || user.user_metadata?.phone;
      if (!metadataMatch && metadataPhone && String(metadataPhone).replace(/\D/g, '') === cleanPhone) {
        metadataMatch = user;
      }
    }

    if (users.length < perPage) return emailMatch || metadataMatch;
  }
}

// Fires all three credential variants Supabase might accept in parallel
// instead of guessing an order and trying them one at a time — whichever
// one this project actually has enabled wins in a single round trip instead
// of up to three sequential ones.
async function mintSession(formattedPhone, syntheticEmail, password) {
  const attempt = (credentials) =>
    supabaseAuth.auth.signInWithPassword(credentials).catch((err) => ({ data: null, error: err }));

  const credentials = [
    { email: syntheticEmail, password },
    { phone: formattedPhone, password },
    { phone: formattedPhone.replace('+', ''), password },
  ];

  // Resolve as soon as one credential shape succeeds. Promise.all made every
  // OTP login wait for the two losing requests even when a session was ready.
  return new Promise((resolve) => {
    let remaining = credentials.length;
    let firstError = null;
    let settled = false;

    credentials.forEach((candidate) => {
      attempt(candidate).then((result) => {
        if (settled) return;
        if (result?.data?.session) {
          settled = true;
          resolve({ data: result.data, error: null });
          return;
        }

        firstError ||= result?.error || null;
        remaining -= 1;
        if (remaining === 0) {
          settled = true;
          resolve({ data: null, error: firstError });
        }
      });
    });
  });
}

export async function POST(request) {
  const requestStartedAt = Date.now();
  const response = await handleVerifyOtp(request);
  console.log(`[verify-otp] total request time: ${Date.now() - requestStartedAt}ms`);
  return response;
}

async function handleVerifyOtp(request) {
  try {
    const body = await request.json();
    const { accessToken } = body;

    if (!accessToken) {
      return NextResponse.json(
        { success: false, error: 'Access token is required' },
        { status: 400 }
      );
    }

    // MSG91_AUTHKEY is the account authkey this endpoint actually expects;
    // MSG91_TOKEN_AUTH/NEXT_PUBLIC_MSG91_TOKEN_AUTH are the widget's
    // client-side token (a different secret, used by initSendOTP) and were
    // being tried first — meaning every verify wasted 1-2 failing round
    // trips to MSG91 (the two token-auth vars are literally the same value)
    // before ever reaching the key that works. Dedupe and try the real one first.
    const authKeysToTry = Array.from(
      new Set(
        [
          process.env.MSG91_AUTHKEY,
          process.env.MSG91_TOKEN_AUTH,
          process.env.NEXT_PUBLIC_MSG91_TOKEN_AUTH,
        ].filter(Boolean)
      )
    );

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
    const cleanTargetPhone = formattedPhone.replace(/\D/g, '');
    const syntheticEmail = `${cleanTargetPhone}@phone.roopsee.internal`;

    // Step 3: Optimistic fast path. A returning user's auth account is
    // almost always already in sync from their previous login (same
    // deterministic password, phone/email already confirmed), so try
    // minting a session directly off an indexed public.users lookup before
    // touching the much slower Admin API at all (listUsers/getUserById/
    // updateUserById). Only falls through to the full sync-and-repair path
    // below when this misses — e.g. first login ever, or the account
    // drifted out of sync.
    let publicUserId = null;
    let knownExistingInPublicUsers = false;
    try {
      const { data: publicUserByPhone } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('phone_no', formattedPhone)
        .maybeSingle();
      if (publicUserByPhone?.id) {
        publicUserId = publicUserByPhone.id;
        knownExistingInPublicUsers = true;
      }
    } catch (err) {
      console.warn('Fast phone lookup failed, falling back to full scan:', err.message);
    }

    let authUserId = publicUserId;
    let sessionData = null;
    let sessionError = null;
    let createdAuthUser = false;

    if (knownExistingInPublicUsers) {
      const optimistic = await mintSession(formattedPhone, syntheticEmail, password);
      sessionData = optimistic.data;
      sessionError = optimistic.error;
    }

    // Step 4: Full sync-and-repair path — only runs when the optimistic
    // attempt above was skipped (no public.users row) or failed (account
    // out of sync), so most returning-user logins never reach this at all.
    if (!sessionData?.session) {
      let existingAuthUser = null;

      if (publicUserId) {
        const { data: authUserData, error: getUserError } = await withRetry(
          () => supabaseAdmin.auth.admin.getUserById(publicUserId),
          { label: 'getUserById' }
        );
        if (!getUserError && authUserData?.user) {
          existingAuthUser = authUserData.user;
        }
      }

      // Only fall back to the full paginated scan when we had a reason to
      // believe an auth user exists (a public.users row pointed at one, but
      // getUserById missed) — a genuinely first-time signup has no
      // publicUserId at all, so skip straight to createUser below instead
      // of scanning the entire auth.users table just to confirm "not found".
      // createUser's own conflict handling already falls back to this same
      // scan if it turns out the account exists under a different flow
      // (e.g. Google OAuth with the same phone).
      if (!existingAuthUser && publicUserId) {
        try {
          existingAuthUser = await findAuthUser(cleanTargetPhone, syntheticEmail);
        } catch (err) {
          console.error('Error listing auth.users:', err.message);
          return NextResponse.json(
            { success: false, error: 'Unable to check existing account. Please try again.' },
            { status: 502 }
          );
        }
      }

      if (existingAuthUser) {
        authUserId = existingAuthUser.id;
        const { error: updateError } = await withRetry(
          () =>
            supabaseAdmin.auth.admin.updateUserById(authUserId, {
              password,
              phone: formattedPhone,
              phone_confirm: true,
              email_confirm: true,
              user_metadata: {
                ...existingAuthUser.user_metadata,
                phone_verified: true,
              },
            }),
          { label: 'updateUserById-main' }
        );
        if (updateError) {
          console.error('Error updating existing auth user:', updateError.message);
          return NextResponse.json(
            { success: false, error: 'Unable to update the existing account. Please contact support.' },
            { status: 409 }
          );
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

        let createRes = await withRetry(() => supabaseAdmin.auth.admin.createUser(createPayload), { label: 'createUser' });

        // If phone creation fails due to provider settings, retry without explicit phone param
        if (createRes.error) {
          delete createPayload.phone;
          delete createPayload.phone_confirm;
          createRes = await withRetry(() => supabaseAdmin.auth.admin.createUser(createPayload), { label: 'createUser-noPhone' });
        }

        if (createRes.error) {
          if (createRes.error.message?.toLowerCase()?.includes('already exists') || createRes.error.status === 422) {
            const matched = await findAuthUser(cleanTargetPhone, syntheticEmail);
            if (matched) {
              authUserId = matched.id;
              const { error: updateError } = await withRetry(
                () => supabaseAdmin.auth.admin.updateUserById(authUserId, { password }),
                { label: 'updateUserById-conflict' }
              );
              if (updateError) {
                return NextResponse.json(
                  { success: false, error: 'Unable to update the existing account. Please contact support.' },
                  { status: 409 }
                );
              }
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
          createdAuthUser = true;
        }
      }

      const retryAttempt = await mintSession(formattedPhone, syntheticEmail, password);
      sessionData = retryAttempt.data;
      sessionError = retryAttempt.error;
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

    // Step 5: public.users bookkeeping (new-user detection + upsert). Runs
    // after the session is already minted so it never blocks the response —
    // its own failure is non-fatal and only logged.
    const now = new Date().toISOString();
    const isNewUser = createdAuthUser;

    // Deferred via after(): the client only needs the session token to log
    // in, not this bookkeeping write, so it no longer blocks the response.
    // Unlike a bare fire-and-forget, after() keeps the Vercel function alive
    // until this completes instead of letting it freeze/drop the write.
    after(async () => {
      const { error: upsertError } = await supabaseAdmin.from('users').upsert(
        {
          id: authUserId,
          phone_no: formattedPhone,
          phone_verified: true,
          phone_verified_at: now,
          updated_at: now,
        },
        { onConflict: 'id' }
      );
      if (upsertError) console.warn('Warning: Failed upserting to public.users table:', upsertError.message);
    });

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
