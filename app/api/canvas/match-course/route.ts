import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';

/**
 * POST /api/canvas/match-course
 * Map a Canvas course to a local course
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { lmsId, localCourseId } = body;

    if (!lmsId || !localCourseId) {
      return NextResponse.json(
        { error: 'Missing lmsId or localCourseId' },
        { status: 400 }
      );
    }

    const supabase = await getServerClient();

    // Get the course to find the kid_id and school_id
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('kid_id, school_id')
      .eq('id', localCourseId)
      .single();

    if (courseError) throw courseError;

    // Look up the lms_account_id for this kid and school (Canvas = school_id 1)
    const { data: lmsAccount, error: accountError } = await supabase
      .from('lms_accounts')
      .select('id')
      .eq('kid_id', course.kid_id)
      .eq('school_id', course.school_id)
      .eq('lms_type', 'canvas')
      .single();

    if (accountError) throw accountError;

    // Map Canvas course to local course - update all required fields
    const { error: updateError } = await supabase
      .from('courses')
      .update({
        lms_course_id: lmsId,
        source_type: 'canvas',
        lms_account_id: lmsAccount.id
      })
      .eq('id', localCourseId);

    if (updateError) throw updateError;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Canvas match-course error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to match Canvas course' },
      { status: 500 }
    );
  }
}
