import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// DocuSign OAuth Configuration
const DOCUSIGN_AUTH_SERVER = process.env.DOCUSIGN_AUTH_SERVER || 'https://account-d.docusign.com';
const DOCUSIGN_CLIENT_ID = process.env.DOCUSIGN_CLIENT_ID || '';
const DOCUSIGN_CLIENT_SECRET = process.env.DOCUSIGN_CLIENT_SECRET || '';
const DOCUSIGN_REDIRECT_URI = process.env.DOCUSIGN_REDIRECT_URI || '';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || '';

// GET /api/auth/docusign - Initiate OAuth flow
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const returnUrl = searchParams.get('returnUrl') || '/dashboard/esignature';

    if (!DOCUSIGN_CLIENT_ID) {
      return NextResponse.json(
        { error: 'DocuSign OAuth not configured. Missing DOCUSIGN_CLIENT_ID.' },
        { status: 500 }
      );
    }

    // Generate and store state parameter for security
    const state = Buffer.from(JSON.stringify({
      userId,
      returnUrl,
      nonce: Math.random().toString(36).substring(2),
      timestamp: Date.now()
    })).toString('base64');

    // Store state in database temporarily
    await prisma.integrationAuth.create({
      data: {
        userId: userId || 'system',
        provider: 'DOCUSIGN',
        state: state,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      },
    });

    // Build authorization URL
    const authUrl = new URL(`${DOCUSIGN_AUTH_SERVER}/oauth/auth`);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('scope', 'signature extended');
    authUrl.searchParams.append('client_id', DOCUSIGN_CLIENT_ID);
    authUrl.searchParams.append('redirect_uri', DOCUSIGN_REDIRECT_URI);
    authUrl.searchParams.append('state', state);

    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error('Error initiating DocuSign OAuth:', error);
    return NextResponse.json(
      { error: 'Failed to initiate OAuth flow' },
      { status: 500 }
    );
  }
}

// POST /api/auth/docusign/callback - Handle OAuth callback
export async function POST(request: Request) {
  try {
    const { code, state } = await request.json();

    if (!code || !state) {
      return NextResponse.json(
        { error: 'Missing authorization code or state' },
        { status: 400 }
      );
    }

    // Verify state parameter
    const authState = await prisma.integrationAuth.findFirst({
      where: {
        provider: 'DOCUSIGN',
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

    // Exchange code for access token
    const tokenResponse = await fetch(`${DOCUSIGN_AUTH_SERVER}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${DOCUSIGN_CLIENT_ID}:${DOCUSIGN_CLIENT_SECRET}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: DOCUSIGN_REDIRECT_URI,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('DocuSign token exchange failed:', errorData);
      return NextResponse.json(
        { error: 'Failed to exchange authorization code' },
        { status: 400 }
      );
    }

    const tokenData = await tokenResponse.json();

    // Get account info
    const userInfoResponse = await fetch(`${DOCUSIGN_AUTH_SERVER}/oauth/userinfo`, {
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
    const defaultAccount = userInfo.accounts?.find((acc: any) => acc.is_default) || userInfo.accounts?.[0];

    // Store integration credentials
    await prisma.integration.upsert({
      where: {
        userId_provider: {
          userId: authState.userId,
          provider: 'DOCUSIGN',
        },
      },
      create: {
        userId: authState.userId,
        provider: 'DOCUSIGN',
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
        accountId: defaultAccount?.account_id,
        baseUrl: defaultAccount?.base_uri,
        email: userInfo.email,
        name: userInfo.name,
        isActive: true,
      },
      update: {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
        accountId: defaultAccount?.account_id,
        baseUrl: defaultAccount?.base_uri,
        email: userInfo.email,
        name: userInfo.name,
        isActive: true,
      },
    });

    // Clean up auth state
    await prisma.integrationAuth.delete({
      where: { id: authState.id },
    });

    // Parse return URL from state
    let returnUrl = '/dashboard/esignature';
    try {
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
      returnUrl = stateData.returnUrl || returnUrl;
    } catch (e) {
      // Ignore parse errors
    }

    return NextResponse.json({
      success: true,
      message: 'DocuSign connected successfully',
      returnUrl,
      account: {
        email: userInfo.email,
        name: userInfo.name,
        accountId: defaultAccount?.account_id,
      },
    });
  } catch (error) {
    console.error('Error handling DocuSign callback:', error);
    return NextResponse.json(
      { error: 'Failed to complete OAuth flow' },
      { status: 500 }
    );
  }
}

// PATCH /api/auth/docusign/refresh - Refresh access token
export async function PATCH(request: Request) {
  try {
    const { userId } = await request.json();

    const integration = await prisma.integration.findFirst({
      where: {
        userId,
        provider: 'DOCUSIGN',
        isActive: true,
      },
    });

    if (!integration || !integration.refreshToken) {
      return NextResponse.json(
        { error: 'No active DocuSign integration found' },
        { status: 404 }
      );
    }

    // Refresh token
    const tokenResponse = await fetch(`${DOCUSIGN_AUTH_SERVER}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${DOCUSIGN_CLIENT_ID}:${DOCUSIGN_CLIENT_SECRET}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: integration.refreshToken,
      }),
    });

    if (!tokenResponse.ok) {
      // Mark integration as inactive if refresh fails
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

    // Update integration with new tokens
    await prisma.integration.update({
      where: { id: integration.id },
      data: {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || integration.refreshToken,
        expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Token refreshed successfully',
    });
  } catch (error) {
    console.error('Error refreshing DocuSign token:', error);
    return NextResponse.json(
      { error: 'Failed to refresh token' },
      { status: 500 }
    );
  }
}
