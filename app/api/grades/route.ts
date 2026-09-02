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
    lms_grade_data,
    course_id,
    lms_assignment_id,
    courses (
      course_name,
      calendar_id,
      school_calendars (
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

    // Note: school_year filtering happens client-side after fetch due to left joins

    const { data: gradesData, error: gradesError } = await query;

    if (gradesError) {
      console.error('Error fetching grades from Supabase:', gradesError);
      return NextResponse.json({ error: gradesError.message }, { status: 500 });
    }

    if (!gradesData || gradesData.length === 0) {
      return NextResponse.json([]);
    }

    // Filter by school year client-side if specified
    let filteredGradesData = gradesData;
    if (schoolYear) {
      filteredGradesData = gradesData.filter((grade) => {
        const courseRef = Array.isArray(grade.courses) ? grade.courses[0] : grade.courses;
        const calendar = Array.isArray(courseRef?.school_calendars)
          ? courseRef.school_calendars[0]
          : courseRef?.school_calendars;
        const schoolYearName = calendar?.school_year_name;
        return schoolYearName === schoolYear;
      });
    }

    if (filteredGradesData.length === 0) {
      return NextResponse.json([]);
    }

    // Fetch activity details for each grade by lms_assignment_id
    const lmsAssignmentIds = filteredGradesData
      .map((g) => g.lms_assignment_id)
      .filter(Boolean);

    let activitiesMap: Record<string, any> = {};

    if (lmsAssignmentIds.length > 0) {
      const { data: activitiesData } = await supabase
        .from('activities')
        .select('lms_assignment_id, title, due_date, points_possible')
        .in('lms_assignment_id', lmsAssignmentIds);

      if (activitiesData) {
        activitiesData.forEach((activity) => {
          if (activity.lms_assignment_id) {
            activitiesMap[activity.lms_assignment_id] = activity;
          }
        });
      }
    }

    const grades = filteredGradesData
      .filter((grade) => {
        // Only show graded assignments (exclude ungraded/unsubmitted)
        return grade.score !== null || grade.grade !== null;
      })
      .map((grade) => {
        const activity = grade.lms_assignment_id
          ? activitiesMap[grade.lms_assignment_id]
          : null;

        // Try to get points_possible from: activity table, lms_grade_data, or activity_assignments
        let pointsPossible = activity?.points_possible || null;
        if (!pointsPossible && grade.lms_grade_data?.points_possible) {
          pointsPossible = grade.lms_grade_data.points_possible;
        }

        const courseRef = Array.isArray(grade.courses) ? grade.courses[0] : grade.courses;
        const calendar = Array.isArray(courseRef?.school_calendars)
          ? courseRef.school_calendars[0]
          : courseRef?.school_calendars;
        const schoolYearName = calendar?.school_year_name;

        return {
          id: grade.id,
          activity_title: activity?.title || grade.lms_grade_data?.assignment_name || 'Untitled Assignment',
          course_name: courseRef?.course_name || 'Unknown Course',
          school_year: schoolYearName,
          score: grade.score,
          grade: grade.grade,
          points_possible: pointsPossible,
          submitted_at: grade.submitted_at,
          graded_at: grade.graded_at,
          late: grade.late || false,
          missing: grade.missing || false,
          needs_grading: grade.needs_grading || false,
          workflow_state: grade.workflow_state,
          submission_comments: grade.submission_comments || null,
          due_date: activity?.due_date || grade.lms_grade_data?.due_at || null,
        };
      })
      .sort((a, b) => {
        // Sort by latest graded_at or submitted_at
        const aDate = new Date(a.graded_at || a.submitted_at || 0);
        const bDate = new Date(b.graded_at || b.submitted_at || 0);
        return bDate.getTime() - aDate.getTime();
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