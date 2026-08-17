import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';

/**
 * POST /api/canvas/update-course-settings
 * Update work_days, class_days, exclusion_patterns for a course
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { courseId, work_days, class_days, exclusion_patterns } = body;

    if (!courseId) {
      return NextResponse.json({ error: 'Missing courseId' }, { status: 400 });
    }

    const supabase = await getServerClient();

    const { error: updateError } = await supabase
      .from('courses')
      .update({
        work_days,
        class_days,
        exclusion_patterns
      })
      .eq('id', courseId);

    if (updateError) throw updateError;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Update course settings error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update course settings' },
      { status: 500 }
    );
  }
}
