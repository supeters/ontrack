import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';

// GET /api/agenda?kidId=xxx&date=2026-05-04&academicYear=2024-2025
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const kidId = searchParams.get('kidId');
  const date = searchParams.get('date');
  const academicYear = searchParams.get('academicYear');

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
      p_academic_year: academicYear || null,
    });

    if (error) {
      console.error('Error from get_agenda_data:', error);
      throw error;
    }

    // RPC returns array with single row containing all data
    const result = data && data.length > 0 ? data[0] : null;

    if (!result) {
      return NextResponse.json({
       
        today_activities: [],
        overdue_activities: [],
        scheduled_classes: [],
        
        next_module_activities: [],
        completed_activities: [],
      });
    }

    // If your Postgres RPC function returns unnamed columns (e.g. col1, col2),
    // map them explicitly here:
    if (result.out_courses !== undefined || Array.isArray(Object.values(result))) {
      const keys = Object.keys(result);
      
      // Handle Postgres named OR position-based RPC responses
      return NextResponse.json({
        
        today_activities: result.today_activities ?? result[keys[0]] ?? [],
        overdue_activities: result.overdue_activities ?? result[keys[1]] ?? [],
        scheduled_classes: result.scheduled_classes ?? result[keys[2]] ?? [],
        
        next_module_activities: result.next_module_activities ?? result[keys[3]] ?? [],
        completed_activities: result.completed_activities ?? result[keys[4]] ?? [],
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