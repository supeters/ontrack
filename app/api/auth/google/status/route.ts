// app/api/auth/google/status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const kidId = searchParams.get('kidId');

    console.log('Status route - kidId from query:', kidId, typeof kidId);

    if (!kidId) {
      return NextResponse.json({ error: 'Missing kidId' }, { status: 400 });
    }

    const supabase = getServiceRoleClient();

    const { data, error } = await supabase
      .from('google_sync_tokens')
      .select('id, calendar_name, calendar_id, kid_id')
      .eq('kid_id', parseInt(kidId))
      .maybeSingle();

    console.log('Query result - data:', data, 'error:', error);

    if (error) throw error;

    return NextResponse.json({ 
      connected: Boolean(data),
      calendarName: data?.calendar_name || '',
      calendarId: data?.calendar_id || ''
    });
  } catch (error: any) {
    console.error('API /api/auth/google/status GET error:', error);
    return NextResponse.json({ connected: false, calendarName: '', calendarId: '' });
  }
}