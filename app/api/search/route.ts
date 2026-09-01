import { getServerClient } from '@/lib/supabase/client';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const supabase = await getServerClient();
  const searchParams = request.nextUrl.searchParams;

  const kidId = searchParams.get('kidId');
  const query = searchParams.get('query');
  const courseId = searchParams.get('courseId');
  const activityType = searchParams.get('activityType');
  const status = searchParams.get('status'); // 'incomplete', 'completed', 'overdue'
  const hasPlannedDate = searchParams.get('hasPlannedDate'); // 'true', 'false', 'all'
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const minTime = searchParams.get('minTime');
  const maxTime = searchParams.get('maxTime');
  const academicYear = searchParams.get('academicYear');

  if (!kidId) {
    return NextResponse.json({ error: 'kidId is required' }, { status: 400 });
  }

  try {
    // Build the query
    let dbQuery = supabase
      .from('activities')
      .select(`
        *,
        course:courses(
          id,
          course_name,
          subject,
          teacher,
          school_calendars:calendar_id(school_year_name)
        )
      `)
      .eq('kid_id', parseInt(kidId))
      .eq('is_deleted', false);

    // Text search on title and description
    if (query && query.trim()) {
      dbQuery = dbQuery.or(`title.ilike.%${query}%,description.ilike.%${query}%`);
    }

    // Filter by course
    if (courseId && courseId !== 'all') {
      dbQuery = dbQuery.eq('course_id', parseInt(courseId));
    }

    // Filter by activity type
    if (activityType && activityType !== 'all') {
      dbQuery = dbQuery.eq('activity_type', activityType);
    }

    // Filter by completion status
    if (status === 'completed') {
      dbQuery = dbQuery.eq('is_completed', true);
    } else if (status === 'incomplete') {
      dbQuery = dbQuery.eq('is_completed', false);
    } else if (status === 'overdue') {
      const today = new Date().toISOString().split('T')[0];
      dbQuery = dbQuery
        .eq('is_completed', false)
        .not('plan_date', 'is', null)
        .lt('plan_date', today);
    }

    // Filter by planned date presence
    if (hasPlannedDate === 'true') {
      dbQuery = dbQuery.not('plan_date', 'is', null);
    } else if (hasPlannedDate === 'false') {
      dbQuery = dbQuery.is('plan_date', null);
    }

    // Filter by date range (using plan_date or due_date)
    if (startDate) {
      dbQuery = dbQuery.or(`plan_date.gte.${startDate},due_date.gte.${startDate}`);
    }
    if (endDate) {
      dbQuery = dbQuery.or(`plan_date.lte.${endDate},due_date.lte.${endDate}`);
    }

    // Filter by estimated time range
    if (minTime) {
      dbQuery = dbQuery.gte('estimated_minutes', parseInt(minTime));
    }
    if (maxTime) {
      dbQuery = dbQuery.lte('estimated_minutes', parseInt(maxTime));
    }

    // Order by relevance (plan_date first, then due_date, then title)
    dbQuery = dbQuery.order('plan_date', { ascending: true, nullsFirst: false });

    const { data, error } = await dbQuery;

    if (error) {
      console.error('Error searching activities:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Filter by academic year (client-side since we can't filter on nested joins)
    let filteredData = data || [];
    if (academicYear && academicYear !== 'all') {
      filteredData = filteredData.filter((activity: any) =>
        activity.course?.school_calendars?.school_year_name === academicYear
      );
    }

    // Limit to 20 results
    const limitedData = filteredData.slice(0, 20);

    return NextResponse.json({ activities: limitedData });
  } catch (error: any) {
    console.error('Error in search route:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
