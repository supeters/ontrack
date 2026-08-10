import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';

// GET /api/calendars - Get all school calendars
export async function GET(request: NextRequest) {
  try {
    const supabase = await getServerClient();

    // Call PostgreSQL function
    const { data, error } = await supabase.rpc('get_school_calendars');

    if (error) {
      console.error('Error from get_school_calendars:', error);
      throw error;
    }

    // RPC returns array with single row containing calendars JSONB
    const result = data && data.length > 0 ? data[0] : null;
    const calendars = result?.calendars || [];

    return NextResponse.json(calendars);
  } catch (error: any) {
    console.error('API /api/calendars GET error:', error);
    return NextResponse.json(
      { error: error.message || String(error) },
      { status: 500 }
    );
  }
}

// POST /api/calendars - Create a new school calendar
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      schoolName,
      schoolYearName,
      termName,
      startDate,
      endDate,
    } = body;

    if (!schoolName || !schoolYearName || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing required fields: schoolName, schoolYearName, startDate, endDate' },
        { status: 400 }
      );
    }

    const supabase = await getServerClient();

    // Call PostgreSQL function (required params first, then optional)
    const { data, error } = await supabase.rpc('create_school_calendar', {
      p_school_name: schoolName,
      p_school_year_name: schoolYearName,
      p_start_date: startDate,
      p_end_date: endDate,
      p_term_name: termName || 'Full Year',
    });

    if (error) {
      console.error('Error from create_school_calendar:', error);
      throw error;
    }

    // RPC returns array with single row
    const result = data && data.length > 0 ? data[0] : null;

    if (!result) {
      return NextResponse.json(
        { error: 'No result returned from database' },
        { status: 500 }
      );
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('API /api/calendars POST error:', error);
    return NextResponse.json(
      { error: error.message || String(error) },
      { status: 500 }
    );
  }
}

// DELETE /api/calendars?id=xxx
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    const supabase = await getServerClient();

    const { error } = await supabase
      .from('school_calendars')
      .delete()
      .eq('id', parseInt(id));

    if (error) throw error;

    return NextResponse.json({ message: 'Calendar deleted' });
  } catch (error: any) {
    console.error('API /api/calendars DELETE error:', error);
    return NextResponse.json(
      { error: error.message || String(error) },
      { status: 500 }
    );
  }
}
