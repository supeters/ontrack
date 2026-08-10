import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';

// GET /api/agenda?kidId=xxx&date=2026-05-04
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const kidId = searchParams.get('kidId');
  const date = searchParams.get('date');

  if (!kidId || !date) {
    return NextResponse.json(
      { error: 'Missing kidId or date' },
      { status: 400 }
    );
  }

  try {
    const supabase = await getServerClient();

    // Call PostgreSQL function (deployed in public schema, not track)
    const { data, error } = await supabase.rpc('get_agenda_data', {
      p_kid_id: parseInt(kidId),
      p_date: date,
    });

    if (error) {
      console.error('Error from get_agenda_data:', error);
      throw error;
    }

    // RPC returns array with single row containing all data
    const result = data && data.length > 0 ? data[0] : null;

    if (!result) {
      return NextResponse.json({
        courses: [],
        today_activities: [],
        overdue_activities: [],
        scheduled_classes: [],
      });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('API /api/agenda GET error:', error);
    return NextResponse.json(
      { error: error.message || String(error) },
      { status: 500 }
    );
  }
}
