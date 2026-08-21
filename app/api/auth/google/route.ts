// app/api/auth/google/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const kidId = searchParams.get('kid_id');

    if (!kidId) {
      return NextResponse.json(
        { error: 'Missing required query parameter: kid_id' },
        { status: 400 }
      );
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    const redirectUri = `${appUrl}/api/auth/google/callback`;

    if (!clientId) {
      return NextResponse.json(
        { error: 'Server configuration error: GOOGLE_CLIENT_ID missing' },
        { status: 500 }
      );
    }

    const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    googleAuthUrl.searchParams.append('client_id', clientId);
    googleAuthUrl.searchParams.append('redirect_uri', redirectUri);
    googleAuthUrl.searchParams.append('response_type', 'code');
    googleAuthUrl.searchParams.append('scope', 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly');
    googleAuthUrl.searchParams.append('access_type', 'offline');
    googleAuthUrl.searchParams.append('prompt', 'consent');
    googleAuthUrl.searchParams.append('state', JSON.stringify({ kidId }));

    return NextResponse.redirect(googleAuthUrl.toString());
  } catch (error: any) {
    console.error('API /api/auth/google GET error:', error);
    return NextResponse.json(
      { error: error.message || String(error) },
      { status: 500 }
    );
  }
}