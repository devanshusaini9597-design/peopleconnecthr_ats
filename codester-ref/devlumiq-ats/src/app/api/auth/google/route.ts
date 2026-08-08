import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Google OAuth Configuration
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || '';

// GET /api/auth/google - Initiate OAuth flow for Calendar integration
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const returnUrl = searchParams.get('returnUrl') || '/dashboard/calendar';

    if (!GOOGLE_CLIENT_ID) {
      return NextResponse.json(
        { error: 'Google OAuth not configured. Missing GOOGLE_CLIENT_ID.' },
        { status: 500 }
      );
    }

    // Generate state parameter
    const state = Buffer.from(JSON.stringify({
      userId,
      returnUrl,
      nonce: Math.random().toString(36).substring(2),
      timestamp: Date.now()
    })).toString('base64');

    // Store state
    await prisma.integrationAuth.create({
      data: {
        userId: userId || 'system',
        provider: 'GOOGLE',
        state: state,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    // Build Google OAuth URL with Calendar scope
    const authUrl = new URL(GOOGLE_AUTH_URL);
    authUrl.searchParams.append('client_id', GOOGLE_CLIENT_ID);
    authUrl.searchParams.append('redirect_uri', GOOGLE_REDIRECT_URI);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('scope', 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile');
    authUrl.searchParams.append('state', state);
    authUrl.searchParams.append('access_type', 'offline');
    authUrl.searchParams.append('prompt', 'consent');

    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error('Error initiating Google OAuth:', error);
    return NextResponse.json(
      { error: 'Failed to initiate OAuth flow' },
      { status: 500 }
    );
  }
}

// POST /api/auth/google/exchange - Exchange code for tokens
export async function POST(request: Request) {
  try {
    const { code, state } = await request.json();

    if (!code || !state) {
      return NextResponse.json(
        { error: 'Missing authorization code or state' },
        { status: 400 }
      );
    }

    // Verify state
    const authState = await prisma.integrationAuth.findFirst({
      where: {
        provider: 'GOOGLE',
        state: state,
        expiresAt: { gt: new Date() },
      },
    });

    if (!authState) {
      return NextResponse.json(
        { error: 'Invalid or expired state parameter' },
        { status: 400 }
      );
    }

    // Exchange code for tokens
    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('Google token exchange failed:', errorData);
      return NextResponse.json(
        { error: 'Failed to exchange authorization code' },
        { status: 400 }
      );
    }

    const tokenData = await tokenResponse.json();

    // Get user info
    const userInfoResponse = await fetch(GOOGLE_USERINFO_URL, {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    });

    if (!userInfoResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch user info' },
        { status: 400 }
      );
    }

    const userInfo = await userInfoResponse.json();

    // Store integration
    await prisma.integration.upsert({
      where: {
        userId_provider: {
          userId: authState.userId,
          provider: 'GOOGLE',
        },
      },
      create: {
        userId: authState.userId,
        provider: 'GOOGLE',
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
        email: userInfo.email,
        name: userInfo.name,
        isActive: true,
      },
      update: {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || undefined,
        expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
        email: userInfo.email,
        name: userInfo.name,
        isActive: true,
      },
    });

    // Clean up state
    await prisma.integrationAuth.delete({
      where: { id: authState.id },
    });

    return NextResponse.json({
      success: true,
      message: 'Google Calendar connected successfully',
      email: userInfo.email,
      name: userInfo.name,
    });
  } catch (error) {
    console.error('Error handling Google OAuth callback:', error);
    return NextResponse.json(
      { error: 'Failed to complete OAuth flow' },
      { status: 500 }
    );
  }
}

// PATCH /api/auth/google/refresh - Refresh Google access token
export async function PATCH(request: Request) {
  try {
    const { userId } = await request.json();

    const integration = await prisma.integration.findFirst({
      where: {
        userId,
        provider: 'GOOGLE',
        isActive: true,
      },
    });

    if (!integration || !integration.refreshToken) {
      return NextResponse.json(
        { error: 'No active Google integration found' },
        { status: 404 }
      );
    }

    // Refresh token
    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: integration.refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!tokenResponse.ok) {
      await prisma.integration.update({
        where: { id: integration.id },
        data: { isActive: false },
      });
      return NextResponse.json(
        { error: 'Failed to refresh token. Please re-authenticate.' },
        { status: 401 }
      );
    }

    const tokenData = await tokenResponse.json();

    await prisma.integration.update({
      where: { id: integration.id },
      data: {
        accessToken: tokenData.access_token,
        expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Token refreshed successfully',
    });
  } catch (error) {
    console.error('Error refreshing Google token:', error);
    return NextResponse.json(
      { error: 'Failed to refresh token' },
      { status: 500 }
    );
  }
}
