import { NextResponse } from 'next/server';
import { supabaseAdmin, supabaseAuth } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const BUCKET = 'avatars';
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

async function authenticatedUserId(request) {
  const authorization = request.headers.get('authorization') || '';
  if (!authorization.startsWith('Bearer ')) return null;

  const token = authorization.slice(7).trim();
  if (!token) return null;

  const { data, error } = await supabaseAuth.auth.getUser(token);
  return error ? null : data.user?.id || null;
}

async function ensureBucketExists() {
  const { data: buckets, error } = await supabaseAdmin.storage.listBuckets();
  if (error) throw error;

  if (!buckets?.some((bucket) => bucket.name === BUCKET)) {
    const { error: createError } = await supabaseAdmin.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: MAX_FILE_BYTES,
    });
    if (createError && !createError.message?.toLowerCase().includes('already exists')) {
      throw createError;
    }
  }
}

export async function POST(request) {
  const userId = await authenticatedUserId(request);
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Authentication is required' }, { status: 401 });
  }

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!file || typeof file === 'string') {
    return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ success: false, error: 'Unsupported image type' }, { status: 400 });
  }

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ success: false, error: 'Image is larger than 5MB' }, { status: 400 });
  }

  try {
    await ensureBucketExists();

    const extension = file.type.split('/')[1] || 'jpg';
    const path = `${userId}/${Date.now()}.${extension}`;
    const arrayBuffer = await file.arrayBuffer();

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, Buffer.from(arrayBuffer), {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
    const avatarUrl = publicUrlData?.publicUrl;
    if (!avatarUrl) throw new Error('Could not resolve public URL for uploaded avatar');

    const { data: userData, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (getUserError) throw getUserError;

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: {
        ...(userData?.user?.user_metadata || {}),
        avatar_url: avatarUrl,
      },
    });
    if (updateError) throw updateError;

    return NextResponse.json({ success: true, avatarUrl });
  } catch (error) {
    console.error('[api/auth/upload-avatar] Upload failed:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Avatar upload failed' },
      { status: 500 },
    );
  }
}
