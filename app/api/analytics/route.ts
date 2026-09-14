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

    // Fetch scheduled classes for the same date range
    let classesQuery = supabase
      .from('activities')
      .select(`
        id,
        kid_id,
        plan_date,
        start_time,
        end_time,
        title,
        course_id,
        courses (
          id,
          course_name
        )
      `)
      .eq('kid_id', parseInt(kidId))
      .not('start_time', 'is', null)
      .not('end_time', 'is', null)
      .eq('is_deleted', false)
      .eq('is_hidden', false)
      .order('plan_date', { ascending: false });

    if (startDate) {
      classesQuery = classesQuery.gte('plan_date', startDate);
    }

    if (endDate) {
      classesQuery = classesQuery.lte('plan_date', endDate);
    }

    const { data: classesData, error: classesError } = await classesQuery;

    if (classesError) {
      console.error('Error fetching scheduled classes:', classesError);
      // Don't fail the whole request, just return empty classes
    }

    // Transform scheduled classes data
    const scheduledClasses = (classesData || []).map((cls: any) => ({
      id: cls.id,
      plan_date: cls.plan_date,
      start_time: cls.start_time,
      end_time: cls.end_time,
      title: cls.title,
      course_name: cls.courses?.course_name,
    }));

    return NextResponse.json({ chunks, scheduledClasses });
  } catch (error: any) {
    console.error('API /api/analytics GET error:', error);
    return NextResponse.json(
      { error: error.message || String(error) },
      { status: 500 }
    );
  }
}
