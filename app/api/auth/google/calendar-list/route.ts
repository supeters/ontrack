import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const kidId = searchParams.get('kidId');

    if (!kidId) {
      return NextResponse.json({ error: 'Missing kidId' }, { status: 400 });
    }

    const supabase = getServiceRoleClient();

    // Fetch the temporary data
    const { data, error } = await supabase
      .from('google_sync_tokens')
      .select('*')
      .eq('kid_id', kidId)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Parse calendar list from temporary storage
    const calendars = JSON.parse(data.calendar_name);

    return NextResponse.json({
      calendars,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.token_expires_at,
    });
  } catch (error: any) {
    console.error('API /api/auth/google/calendar-list GET error:', error);
    return NextResponse.json(
      { error: error.message || String(error) },
      { status: 500 }
    );
  }
}