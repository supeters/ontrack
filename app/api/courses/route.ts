import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';

// GET /api/courses?kidId=xxx&schoolYear=2025-26
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const kidId = searchParams.get('kidId');
  const schoolYear = searchParams.get('schoolYear');

  if (!kidId) {
    return NextResponse.json({ error: 'Missing kidId' }, { status: 400 });
  }

  try {
    const supabase = await getServerClient();

    // Fetch courses with school and calendar info
    const { data, error } = await supabase
      .from('courses')
      .select(`
        id,
        course_name,
        subject,
        teacher,
        calendar_id,
        schools:school_id (
          name
        ),
        school_calendars:calendar_id (
          school_year_name
        )
      `)
      .eq('kid_id', parseInt(kidId))
      .eq('is_active', true)
      .order('course_name');

    if (error) {
      console.error('Error fetching courses:', error);
      throw error;
    }

    // Filter by school year if provided
    let filteredData = data || [];
    if (schoolYear) {
      console.log('Filtering by school year:', schoolYear);
      filteredData = filteredData.filter((course: any) => {
        const courseYear = course.school_calendars?.school_year_name;
        console.log(`Course ${course.course_name}: calendar year = ${courseYear}, matches = ${courseYear === schoolYear}`);
        return courseYear === schoolYear;
      });
    }

    // Format response
    const formattedCourses = filteredData.map((course: any) => ({
      id: course.id,
      name: course.course_name,
      course_name: course.course_name,
      subject: course.subject,
      teacher: course.teacher,
      school: course.schools?.name || 'No school',
      calendar_id: course.calendar_id,
    }));

    return NextResponse.json(formattedCourses);
  } catch (error: any) {
    console.error('API /api/courses GET error:', error);
    return NextResponse.json(
      { error: error.message || String(error) },
      { status: 500 }
    );
  }
}

// POST /api/courses - Create or update a course
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      courseId,
      kidId,
      courseName,
      subject,
      teacher,
      courseWebpage,
      meetingLink,
      courseCode,
      calendarId,
      workDays,
      classDays,
      isActive = true,
    } = body;

    if (!kidId || !courseName) {
      return NextResponse.json(
        { error: 'Missing required fields: kidId and courseName' },
        { status: 400 }
      );
    }

    const supabase = await getServerClient();

    // Call PostgreSQL function (required params first, then optional)
    const { data, error } = await supabase.rpc('create_or_update_course', {
      p_kid_id: parseInt(kidId),
      p_course_name: courseName,
      p_course_id: courseId || null,
      p_subject: subject || null,
      p_teacher: teacher || null,
      p_course_webpage: courseWebpage || null,
      p_meeting_link: meetingLink || null,
      p_course_code: courseCode || null,
      p_calendar_id: calendarId || null,
      p_work_days: workDays || null,
      p_class_days: classDays || null,
      p_is_active: isActive,
    });

    if (error) {
      console.error('Error from create_or_update_course:', error);
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
    console.error('API /api/courses POST error:', error);
    return NextResponse.json(
      { error: error.message || String(error) },
      { status: 500 }
    );
  }
}
