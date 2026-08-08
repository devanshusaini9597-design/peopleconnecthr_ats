import { NextResponse } from 'next/server';

// GET /api/auth/google/callback - Handle Google OAuth callback
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      const errorDescription = searchParams.get('error_description') || 'Unknown error';
      console.error('Google OAuth error:', error, errorDescription);
      
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      return NextResponse.redirect(
        `${appUrl}/dashboard/calendar?error=${encodeURIComponent(error)}&message=${encodeURIComponent(errorDescription)}`
      );
    }

    if (!code || !state) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      return NextResponse.redirect(
        `${appUrl}/dashboard/calendar?error=missing_params&message=Missing authorization code or state`
      );
    }

    // Exchange tokens
    const tokenExchangeResponse = await fetch(
      new URL('/api/auth/google', request.url).toString(),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, state }),
      }
    );

    const result = await tokenExchangeResponse.json();

    if (result.success) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      return NextResponse.redirect(
        `${appUrl}/dashboard/calendar?success=true&message=${encodeURIComponent('Google Calendar connected successfully')}`
      );
    } else {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      return NextResponse.redirect(
        `${appUrl}/dashboard/calendar?error=auth_failed&message=${encodeURIComponent(result.error || 'Authentication failed')}`
      );
    }
  } catch (error) {
    console.error('Error in Google callback handler:', error);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return NextResponse.redirect(
      `${appUrl}/dashboard/calendar?error=callback_error&message=An error occurred during authentication`
    );
  }
}
