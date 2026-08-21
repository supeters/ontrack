// app/api/calendars/google/events/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const kidId = searchParams.get('kidId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!kidId || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing required parameters: kidId, startDate, endDate' },
        { status: 400 }
      );
    }

    const supabase = getServiceRoleClient();

    // 1. Fetch OAuth token record from google_sync_tokens
    const { data: tokenRecord, error: tokenError } = await supabase
      .from('google_sync_tokens')
      .select('*')
      .eq('kid_id', parseInt(kidId))
      .maybeSingle();

    if (tokenError || !tokenRecord) {
      return NextResponse.json({ events: [] });
    }

    let accessToken = tokenRecord.access_token;
    const calendarId = tokenRecord.calendar_id || 'primary';

    // 2. Auto-refresh access token if expired (or within 5 minutes of expiring)
    const expiresAt = new Date(tokenRecord.token_expires_at).getTime();
    if (Date.now() >= expiresAt - 5 * 60 * 1000) {
      accessToken = await refreshAccessToken(tokenRecord, supabase);
    }

    // 3. Set ISO 8601 bounds for Google API search range
    const timeMin = new Date(`${startDate}T00:00:00Z`).toISOString();
    const timeMax = new Date(`${endDate}T23:59:59Z`).toISOString();

    // 4. Fetch events from Google Calendar API
    const encodedCalId = encodeURIComponent(calendarId);
    const googleRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodedCalId}/events?` +
        new URLSearchParams({
          timeMin,
          timeMax,
          singleEvents: 'true',
          orderBy: 'startTime',
        }),
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    const googleData = await googleRes.json();

    if (!googleRes.ok) {
      console.error('Error fetching Google Calendar events:', googleData);
      return NextResponse.json({ events: [] });
    }

    // 5. Normalize Google events to match your local activity schema
    const formattedEvents = (googleData.items || []).map((event: any) => {
      const startIso = event.start?.dateTime || event.start?.date;
      const endIso = event.end?.dateTime || event.end?.date;

      return {
        id: `google-${event.id}`,
        title: event.summary || '(No Title)',
        description: event.description || '',
        plan_date: startIso ? startIso.split('T')[0] : startDate,
        start_time: startIso && startIso.includes('T') ? startIso : null,
        end_time: endIso && endIso.includes('T') ? endIso : null,
        is_google: true,
      };
    });

    return NextResponse.json({ events: formattedEvents });
  } catch (error: any) {
    console.error('API /api/calendars/google/events GET error:', error);
    return NextResponse.json({ events: [] });
  }
}

async function refreshAccessToken(tokenRecord: any, supabase: any): Promise<string> {
  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: tokenRecord.refresh_token,
      grant_type: 'refresh_token',
    }),
  });

  const tokens = await res.json();
  if (!res.ok) throw new Error('Failed to refresh Google token');

  const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  await supabase
    .from('google_sync_tokens')
    .update({
      access_token: tokens.access_token,
      token_expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('kid_id', tokenRecord.kid_id);

  return tokens.access_token;
}