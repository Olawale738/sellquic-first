// src/app/api/instagram/connect/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { authAdmin } from '@/lib/firebase-admin';

const APP_ID = process.env.FACEBOOK_APP_ID || '1898671297438792';
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://sellquic.com';
const REDIRECT_URI = `${BASE_URL}/api/instagram/callback`;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const storeId = searchParams.get('storeId');
  const token = searchParams.get('token');

  if (!storeId || !token) {
    return NextResponse.json({ error: 'Missing storeId or token' }, { status: 400 });
  }

  try {
    await authAdmin.verifyIdToken(token);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const params = new URLSearchParams({
    client_id: APP_ID,
    redirect_uri: REDIRECT_URI,
    scope: [
      'pages_show_list',
      'pages_read_engagement',
      'pages_manage_metadata',
      'pages_messaging', // <-- ADDED: Required to actually reply to DMs
      'instagram_basic',
      'instagram_manage_messages',
      'instagram_manage_comments',
      'business_management' // <-- ADDED: Master key to unlock Pages hidden in Business Manager
    ].join(','),
    response_type: 'code',
    state: JSON.stringify({ storeId }),
  });

  // Facebook Login flow — required for Page access tokens and Instagram DM webhooks
  const oauthUrl = `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`;
  return NextResponse.redirect(oauthUrl);
}