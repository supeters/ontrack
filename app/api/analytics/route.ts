import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';

// GET /api/analytics - Fetch analytics data with work chunks and activities
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const kidId = searchParams.get('kidId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!kidId) {
      return NextResponse.json(
        { error: 'kidId is required' },
        { status: 400 }
      );
    }

    const supabase = await getServerClient();

    // Fetch work chunks with activity details
    let query = supabase
      .from('activity_work_chunks')
      .select(`
        id,
        activity_id,
        kid_id,
        start_time,
        end_time,
        minutes_worked,
        is_active,
        is_manual,
        mood,
        notes,
        created_at,
        activities!inner (
          id,
          title,
          course_id,
          courses (
            id,
            course_name
          )
        )
      `)
      .eq('kid_id', parseInt(kidId))
      .order('created_at', { ascending: false });

    if (startDate) {
      query = query.gte('start_time', `${startDate}T00:00:00`);
    }

    if (endDate) {
      query = query.lte('start_time', `${endDate}T23:59:59`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching analytics:', error);
      throw error;
    }

    // Transform data to flatten nested structure
    const chunks = (data || []).map((chunk: any) => ({
      id: chunk.id,
      activity_id: chunk.activity_id,
      start_time: chunk.start_time,
      end_time: chunk.end_time,
      minutes_worked: chunk.minutes_worked,
      is_active: chunk.is_active,
      is_manual: chunk.is_manual,
      mood: chunk.mood,
      notes: chunk.notes,
      created_at: chunk.created_at,
      activity_title: chunk.activities?.title,
      course_name: chunk.activities?.courses?.course_name,
    }));

    // Fetch scheduled classes from Google Calendar
    let scheduledClasses: any[] = [];

    try {
      // Build the URL for the Google Calendar events API
      const calendarUrl = new URL(`${request.url.split('/api/analytics')[0]}/api/calendars/google/events`);
      calendarUrl.searchParams.set('kidId', kidId);
      calendarUrl.searchParams.set('startDate', startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
      calendarUrl.searchParams.set('endDate', endDate || new Date().toISOString().split('T')[0]);

      const calendarResponse = await fetch(calendarUrl.toString());

      if (calendarResponse.ok) {
        const calendarData = await calendarResponse.json();
        scheduledClasses = (calendarData.events || []).map((event: any) => ({
          id: event.id,
          plan_date: event.plan_date,
          start_time: event.start_time,
          end_time: event.end_time,
          title: event.title,
        }));
      }
    } catch (error) {
      console.error('Error fetching Google Calendar events:', error);
      // Don't fail the whole request, just return empty classes
    }

    return NextResponse.json({ chunks, scheduledClasses });
  } catch (error: any) {
    console.error('API /api/analytics GET error:', error);
    return NextResponse.json(
      { error: error.message || String(error) },
      { status: 500 }
    );
  }
}
