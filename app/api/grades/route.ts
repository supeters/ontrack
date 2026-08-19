import { NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const kidId = searchParams.get('kid_id');
    const courseId = searchParams.get('course_id');
    const schoolYear = searchParams.get('school_year');
    if (!kidId) {
      return NextResponse.json({ error: 'kid_id is required' }, { status: 400 });
    }

    // Ensure we await getServerClient if it's async, or call it directly
    const supabase = await getServerClient();

    if (!supabase || typeof supabase.from !== 'function') {
      throw new Error('Supabase client failed to initialize properly.');
    }

    let query = supabase
  .from('activity_grades')
  .select(`
    id,
    kid_id,
    score,
    grade,
    submitted_at,
    graded_at,
    late,
    missing,
    needs_grading,
    workflow_state,
    submission_comments,
    course_id,
    lms_assignment_id,
    courses!inner (
      course_name,
      calendar_id,
      school_calendars!inner (
        school_year_name
      )
    )
  `)
  .eq('kid_id', kidId)
  .order('graded_at', { ascending: false, nullsFirst: false })
  .order('submitted_at', { ascending: false, nullsFirst: false });

    if (courseId) {
      query = query.eq('course_id', courseId);
    }

    if (schoolYear) {
      query = query.eq('courses.school_calendars.school_year_name', schoolYear);
    }

    if (courseId) {
      query = query.eq('course_id', courseId);
    }

    const { data: gradesData, error: gradesError } = await query;

    if (gradesError) {
      console.error('Error fetching grades from Supabase:', gradesError);
      return NextResponse.json({ error: gradesError.message }, { status: 500 });
    }

    if (!gradesData || gradesData.length === 0) {
      return NextResponse.json([]);
    }

    // Fetch assignment details for each grade
    const lmsAssignmentIds = gradesData
      .map((g) => g.lms_assignment_id)
      .filter(Boolean);

    let assignmentsMap: Record<string, any> = {};
    let activitiesMap: Record<string, string> = {};

    if (lmsAssignmentIds.length > 0) {
      const [assignmentsRes, activitiesRes] = await Promise.all([
        supabase
          .from('activity_assignments')
          .select('lms_assignment_id, points_possible, due_date, description')
          .in('lms_assignment_id', lmsAssignmentIds),
        supabase
          .from('activities')
          .select('lms_assignment_id, title')
          .in('lms_assignment_id', lmsAssignmentIds)
      ]);

      if (assignmentsRes.data) {
        assignmentsMap = assignmentsRes.data.reduce((acc, assignment) => {
          acc[assignment.lms_assignment_id] = assignment;
          return acc;
        }, {} as Record<string, any>);
      }

      if (activitiesRes.data) {
        activitiesRes.data.forEach((activity) => {
          if (activity.lms_assignment_id) {
            activitiesMap[activity.lms_assignment_id] = activity.title;
          }
        });
      }
    }

    const grades = gradesData.map((grade) => {
      const assignment = grade.lms_assignment_id
        ? assignmentsMap[grade.lms_assignment_id]
        : null;
      const activityTitle = grade.lms_assignment_id
        ? activitiesMap[grade.lms_assignment_id]
        : null;

      const courseRef = Array.isArray(grade.courses) ? grade.courses[0] : grade.courses;

      return {
        id: grade.id,
        activity_title: activityTitle || 'Untitled Assignment',
        course_name: courseRef?.course_name || 'Unknown Course',
        score: grade.score,
        grade: grade.grade,
        points_possible: assignment?.points_possible || null,
        submitted_at: grade.submitted_at,
        graded_at: grade.graded_at,
        late: grade.late || false,
        missing: grade.missing || false,
        needs_grading: grade.needs_grading || false,
        workflow_state: grade.workflow_state,
        submission_comments: grade.submission_comments || null,
        due_date: assignment?.due_date || null,
      };
    });

    return NextResponse.json(grades);
  } catch (error: any) {
    console.error('Unexpected error in grades API:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}