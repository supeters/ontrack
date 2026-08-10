import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';

// GET /api/holidays - Get all holidays
export async function GET(request: NextRequest) {
  try {
    const supabase = await getServerClient();

    const { data, error } = await supabase
      .from('holidays')
      .select('*')
      .order('start_date');

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error: any) {
    console.error('API /api/holidays GET error:', error);
    return NextResponse.json(
      { error: error.message || String(error) },
      { status: 500 }
    );
  }
}

// POST /api/holidays - Create or update holiday
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { holidayId, calendarId, startDate, endDate, name, description } = body;

    if (!calendarId || !startDate || !name) {
      return NextResponse.json(
        { error: 'Missing required fields: calendarId, startDate, name' },
        { status: 400 }
      );
    }

    const supabase = await getServerClient();

    if (holidayId) {
      // Update existing holiday
      const { data, error } = await supabase
        .from('holidays')
        .update({
          calendar_id: calendarId,
          name,
          start_date: startDate,
          end_date: endDate || startDate, // Default to single day if no end date
          description: description || null,
        })
        .eq('id', holidayId)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json(data);
    } else {
      // Create new holiday
      const { data, error } = await supabase
        .from('holidays')
        .insert({
          calendar_id: calendarId,
          name,
          start_date: startDate,
          end_date: endDate || startDate, // Default to single day if no end date
          description: description || null,
          holiday_type: 'break',
        })
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json(data);
    }
  } catch (error: any) {
    console.error('API /api/holidays POST error:', error);
    return NextResponse.json(
      { error: error.message || String(error) },
      { status: 500 }
    );
  }
}

// DELETE /api/holidays?id=xxx
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    const supabase = await getServerClient();

    const { error } = await supabase
      .from('holidays')
      .delete()
      .eq('id', parseInt(id));

    if (error) throw error;

    return NextResponse.json({ message: 'Holiday deleted' });
  } catch (error: any) {
    console.error('API /api/holidays DELETE error:', error);
    return NextResponse.json(
      { error: error.message || String(error) },
      { status: 500 }
    );
  }
}
