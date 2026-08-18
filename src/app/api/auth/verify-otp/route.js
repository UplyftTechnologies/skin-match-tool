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

function authUserMatches(user, cleanPhone, syntheticEmail) {
  const metadataPhone = user.user_metadata?.phone_no || user.user_metadata?.phone;
  return (user.phone && user.phone.replace(/\D/g, '') === cleanPhone) ||
    user.email?.toLowerCase() === syntheticEmail.toLowerCase() ||
    (metadataPhone && String(metadataPhone).replace(/\D/g, '') === cleanPhone);
}

async function findAuthUser(cleanPhone, syntheticEmail) {
  const perPage = 1000;

  for (let page = 1; ; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const users = data?.users || [];
    const matched = users.find((user) => authUserMatches(user, cleanPhone, syntheticEmail));
    if (matched) return matched;
    if (users.length < perPage) return null;
  }
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
    let existingAuthUser = null;
    let authUserId = null;

    try {
      existingAuthUser = await findAuthUser(cleanTargetPhone, syntheticEmail);
    } catch (err) {
      console.error('Error listing auth.users:', err.message);
      return NextResponse.json(
        { success: false, error: 'Unable to check existing account. Please try again.' },
        { status: 502 }
      );
    }

    if (existingAuthUser) {
      authUserId = existingAuthUser.id;
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(authUserId, {
        password,
        phone: formattedPhone,
        phone_confirm: true,
        email_confirm: true,
        user_metadata: {
          ...existingAuthUser.user_metadata,
          phone_verified: true,
        },
      });
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

      let createRes = await supabaseAdmin.auth.admin.createUser(createPayload);

      // If phone creation fails due to provider settings, retry without explicit phone param
      if (createRes.error) {
        delete createPayload.phone;
        delete createPayload.phone_confirm;
        createRes = await supabaseAdmin.auth.admin.createUser(createPayload);
      }

      if (createRes.error) {
        if (createRes.error.message?.toLowerCase()?.includes('already exists') || createRes.error.status === 422) {
          const matched = await findAuthUser(cleanTargetPhone, syntheticEmail);
          if (matched) {
            authUserId = matched.id;
            const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(authUserId, {
              password,
            });
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
          phone_no: formattedPhone,
          phone_verified: true,
          phone_verified_at: now,
          updated_at: now,
        },
        { onConflict: 'id' }
      );
    } catch (dbErr) {
      console.warn('Warning: Failed upserting to public.users table:', dbErr.message);
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

