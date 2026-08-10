import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';

// GET /api/planner?kidId=xxx&startDate=2026-05-01&endDate=2026-05-31
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const kidId = searchParams.get('kidId');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  if (!kidId || !startDate || !endDate) {
    return NextResponse.json(
      { error: 'Missing kidId, startDate, or endDate' },
      { status: 400 }
    );
  }

  try {
    const supabase = await getServerClient();

    // Call PostgreSQL function
    const { data, error } = await supabase.rpc('get_planner_data', {
      p_kid_id: parseInt(kidId),
      p_start_date: startDate,
      p_end_date: endDate,
    });

    if (error) {
      console.error('Error from get_planner_data:', error);
      throw error;
    }

    // RPC returns array with single row containing all data
    const result = data && data.length > 0 ? data[0] : null;

    if (!result) {
      return NextResponse.json({
        activities: [],
        courses: [],
        calendar_events: [],
      });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('API /api/planner GET error:', error);
    return NextResponse.json(
      { error: error.message || String(error) },
      { status: 500 }
    );
  }
}
