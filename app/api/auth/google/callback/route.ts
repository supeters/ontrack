// app/api/auth/google/callback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
 
    if (!code) {
      return NextResponse.json(
        { error: 'Missing code parameter from Google callback' },
        { status: 400 }
      );
    }

    let kidId: string | null = null;
    if (state) {
      try {
        const parsed = JSON.parse(state);
        kidId = parsed.kidId;
      } catch {
        // State parse fallback
      }
    }

    if (!kidId) {
      return NextResponse.json(
        { error: 'Invalid or missing kid_id in OAuth state parameter' },
        { status: 400 }
      );
    }

    const clientId = process.env.GOOGLE_CLIENT_ID!;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    const redirectUri = `${appUrl}/api/auth/google/callback`;

    // 1. Exchange authorization code for OAuth tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('Google token exchange error:', tokens);
      return NextResponse.json(
        { error: 'Failed to exchange authorization code', details: tokens },
        { status: 500 }
      );
    }

    // 2. Fetch user's full list of Google Calendars
    const calListResponse = await fetch(
      'https://www.googleapis.com/calendar/v3/users/me/calendarList',
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      }
    );
    const calListData = await calListResponse.json();
    const calendarList = calListData.items || [];

     const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

        // 3. Store calendar selection data temporarily in database
        const supabase = getServiceRoleClient();
        
        // Create a temporary session token
        const sessionToken = crypto.randomUUID();
        
        // Store the data temporarily (we'll use google_sync_tokens with a special flag)
        await supabase.from('google_sync_tokens').upsert({
          kid_id: kidId,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expires_at: expiresAt,
          calendar_id: sessionToken, // Temporary marker
          calendar_name: JSON.stringify(calendarList), // Store calendar list temporarily
          updated_at: new Date().toISOString(),
        }, { onConflict: 'kid_id' });

        // Redirect to calendar picker with just the session token
        const pickerUrl = new URL('/google-calendar-picker', appUrl);
        pickerUrl.searchParams.append('kidId', kidId);
        pickerUrl.searchParams.append('session', sessionToken);

        return NextResponse.redirect(pickerUrl.toString());
    } catch (error: any) {
    console.error('API /api/auth/google/callback GET error:', error);
    return NextResponse.json(
      { error: error.message || String(error) },
      { status: 500 }
    );
  }
}
