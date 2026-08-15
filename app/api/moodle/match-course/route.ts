import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';

// POST /api/moodle/match-course - Map a Moodle course to a local course
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { lmsId, localCourseId } = body;

    if (!lmsId) {
      return NextResponse.json({ error: 'Missing lmsId' }, { status: 400 });
    }

    const supabase = await getServerClient();

    if (localCourseId) {
      // Get the course to find the kid_id and school_id
      const { data: course, error: courseError } = await supabase
        .from('courses')
        .select('kid_id, school_id')
        .eq('id', localCourseId)
        .single();

      if (courseError) throw courseError;
      if (!course) {
        return NextResponse.json({ error: 'Course not found' }, { status: 404 });
      }

      // Look up the lms_account_id for this kid and school
      let query = supabase
        .from('lms_accounts')
        .select('id')
        .eq('kid_id', course.kid_id);

      // Only filter by school_id if it's a valid value
      if (course.school_id && course.school_id !== 'null') {
        query = query.eq('school_id', course.school_id);
      }

      const { data: lmsAccount, error: accountError } = await query.single();

      if (accountError) throw accountError;
      if (!lmsAccount) {
        return NextResponse.json({ error: 'No Moodle account found for this student and school' }, { status: 404 });
      }

      // Map Moodle course to local course - update all required fields
      const { error: updateError } = await supabase
        .from('courses')
        .update({
          lms_course_id: lmsId,
          source_type: 'moodle',
          lms_account_id: lmsAccount.id
        })
        .eq('id', localCourseId);

      if (updateError) throw updateError;
    } else {
      // Clear match - remove lms_course_id and related fields
      const { error: clearError } = await supabase
        .from('courses')
        .update({
          lms_course_id: null,
          lms_account_id: null,
          source_type: null
        })
        .eq('lms_course_id', lmsId);

      if (clearError) throw clearError;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error matching course:', error);
    return NextResponse.json(
      { error: error.message || String(error) },
      { status: 500 }
    );
  }
}
