import { NextResponse } from 'next/server';

// This route handles the OAuth callback from DocuSign
// GET /api/auth/docusign/callback?code=xxx&state=xxx

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Handle OAuth errors
    if (error) {
      const errorDescription = searchParams.get('error_description') || 'Unknown error';
      console.error('DocuSign OAuth error:', error, errorDescription);
      
      // Redirect to dashboard with error
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      return NextResponse.redirect(
        `${appUrl}/dashboard/esignature?error=${encodeURIComponent(error)}&message=${encodeURIComponent(errorDescription)}`
      );
    }

    if (!code || !state) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      return NextResponse.redirect(
        `${appUrl}/dashboard/esignature?error=missing_params&message=Missing authorization code or state`
      );
    }

    // Forward to POST handler for token exchange
    const tokenExchangeResponse = await fetch(
      new URL('/api/auth/docusign', request.url).toString(),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, state }),
      }
    );

    const result = await tokenExchangeResponse.json();

    if (result.success) {
      // Redirect to dashboard with success
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      return NextResponse.redirect(
        `${appUrl}${result.returnUrl || '/dashboard/esignature'}?success=true&message=${encodeURIComponent(result.message)}`
      );
    } else {
      // Redirect with error
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      return NextResponse.redirect(
        `${appUrl}/dashboard/esignature?error=auth_failed&message=${encodeURIComponent(result.error || 'Authentication failed')}`
      );
    }
  } catch (error) {
    console.error('Error in DocuSign callback handler:', error);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return NextResponse.redirect(
      `${appUrl}/dashboard/esignature?error=callback_error&message=An error occurred during authentication`
    );
  }
}
