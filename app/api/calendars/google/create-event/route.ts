import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { kidId, title, description, startTime, endTime } = body;

    if (!kidId || !title || !startTime || !endTime) {
      return NextResponse.json(
        { error: 'Missing required fields: kidId, title, startTime, endTime' },
        { status: 400 }
      );
    }

    const supabase = getServiceRoleClient();

    // 1. Fetch Google credentials for the specified kid
    const { data: tokenRecord, error: tokenError } = await supabase
      .from('google_sync_tokens')
      .select('*')
      .eq('kid_id', kidId)
      .maybeSingle();

    if (tokenError || !tokenRecord) {
      return NextResponse.json(
        { error: 'Google Calendar is not synced for this student.' },
        { status: 404 }
      );
    }

    let accessToken = tokenRecord.access_token;
    const calendarId = tokenRecord.calendar_id || 'primary';

    // 2. Auto-refresh access token if expired (or within 5 minutes of expiring)
    const expiresAt = new Date(tokenRecord.token_expires_at).getTime();
    if (Date.now() >= expiresAt - 5 * 60 * 1000) {
      accessToken = await refreshAccessToken(tokenRecord, supabase);
    }

    // 3. Post event to Google Calendar REST API
    const encodedCalId = encodeURIComponent(calendarId);
    const googleRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodedCalId}/events`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          summary: title,
          description: description || '',
          start: { dateTime: new Date(startTime).toISOString() },
          end: { dateTime: new Date(endTime).toISOString() },
        }),
      }
    );

    const googleData = await googleRes.json();

    if (!googleRes.ok) {
      console.error('Google Calendar Create Event API Error:', googleData);
      return NextResponse.json(
        { error: 'Failed to create event on Google Calendar', details: googleData },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, event: googleData });
  } catch (error: any) {
    console.error('API /api/calendars/google/create-event POST error:', error);
    return NextResponse.json(
      { error: error.message || String(error) },
      { status: 500 }
    );
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