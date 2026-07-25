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
      const { data: listUsers } = await supabaseAdmin.auth.admin.listUsers();
      if (listUsers?.users) {
        existingAuthUser = listUsers.users.find(
          (u) => (u.phone && u.phone.replace(/\D/g, '') === cleanTargetPhone) ||
                 (u.email && u.email === syntheticEmail) ||
                 (u.user_metadata?.phone_no && u.user_metadata.phone_no.replace(/\D/g, '') === cleanTargetPhone) ||
                 (u.user_metadata?.phone && u.user_metadata.phone.replace(/\D/g, '') === cleanTargetPhone)
        );
      }
    } catch (err) {
      console.warn('Error listing auth.users:', err.message);
    }

    if (existingAuthUser) {
      authUserId = existingAuthUser.id;
      await supabaseAdmin.auth.admin.updateUserById(authUserId, {
        password,
        phone: formattedPhone,
        phone_confirm: true,
        email_confirm: true,
        user_metadata: {
          ...existingAuthUser.user_metadata,
          phone_verified: true,
        },
      });
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
          const { data: listUsers } = await supabaseAdmin.auth.admin.listUsers();
          const matched = listUsers?.users?.find(
            (u) => (u.phone && u.phone.replace(/\D/g, '') === cleanTargetPhone) || (u.email && u.email === syntheticEmail)
          );
          if (matched) {
            authUserId = matched.id;
            await supabaseAdmin.auth.admin.updateUserById(authUserId, {
              password,
            });
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

