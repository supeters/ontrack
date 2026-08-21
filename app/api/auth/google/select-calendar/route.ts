// app/api/auth/google/select-calendar/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { kidId, calendarId, calendarName, accessToken, refreshToken, expiresAt } = body;

    if (!kidId || !calendarId || !calendarName || !accessToken || !refreshToken || !expiresAt) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const supabase = getServiceRoleClient();

    // Save tokens with selected calendar
    const { error: dbError } = await supabase.from('google_sync_tokens').upsert(
      {
        kid_id: parseInt(kidId),
        access_token: accessToken,
        refresh_token: refreshToken,
        calendar_id: calendarId,
        calendar_name: calendarName,
        token_expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'kid_id' }
    );

    if (dbError) {
      console.error('Error saving google_sync_tokens:', dbError);
      throw dbError;
    }

    // Register Watch Channel for the selected calendar
    await registerWatchChannel(kidId, accessToken, calendarId, supabase);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('API /api/auth/google/select-calendar POST error:', error);
    return NextResponse.json(
      { error: error.message || String(error) },
      { status: 500 }
    );
  }
}

async function registerWatchChannel(
  kidId: string,
  accessToken: string,
  calendarId: string,
  supabase: ReturnType<typeof getServiceRoleClient>
) {
  const channelId = crypto.randomUUID();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const webhookUrl = `${supabaseUrl}/functions/v1/google-calendar-webhook`;

  const encodedCalId = encodeURIComponent(calendarId);

  const watchResponse = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodedCalId}/events/watch`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: channelId,
        type: 'web_hook',
        address: webhookUrl,
      }),
    }
  );

  const watchData = await watchResponse.json();

  if (watchResponse.ok) {
    await supabase.from('google_watch_channels').upsert(
      {
        kid_id: kidId,
        channel_id: watchData.id,
        resource_id: watchData.resourceId,
        expiration: new Date(Number(watchData.expiration)).toISOString(),
      },
      { onConflict: 'kid_id' }
    );
  } else {
    console.error('Failed to register Google Watch Channel:', watchData);
  }
}
