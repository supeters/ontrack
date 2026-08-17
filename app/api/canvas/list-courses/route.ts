import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';

/**
 * GET /api/canvas/list-courses
 * Fetch all courses from Canvas LMS for a given account
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get('accountId');

  if (!accountId) {
    return NextResponse.json({ error: 'Missing accountId' }, { status: 400 });
  }

  try {
    const supabase = await getServerClient();

    // Get LMS account details
    const { data: lmsAccount, error: accountError } = await supabase
      .from('lms_accounts')
      .select('id, name, lms_url, api_token, kid_id, school_id')
      .eq('id', parseInt(accountId))
      .single();

    if (accountError) throw accountError;
    if (!lmsAccount) {
      return NextResponse.json({ error: 'LMS account not found' }, { status: 404 });
    }

    // Fetch courses from Canvas API
    const baseUrl = lmsAccount.lms_url.replace(/\/$/, ''); // Remove trailing slash
    const canvasUrl = `${baseUrl}/api/v1/courses?enrollment_state=active&per_page=100`;

    console.log('🔍 Canvas API Request:', {
      url: canvasUrl,
      hasToken: !!lmsAccount.api_token,
      tokenPrefix: lmsAccount.api_token?.substring(0, 10) + '...'
    });

    const response = await fetch(canvasUrl, {
      headers: {
        'Authorization': `Bearer ${lmsAccount.api_token}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Canvas API Error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      throw new Error(`Canvas API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const canvasCourses = await response.json();

    // Get existing course mappings
    const { data: mappedCourses } = await supabase
      .from('courses')
      .select('id, course_name, lms_course_id')
      .eq('kid_id', lmsAccount.kid_id)
      .eq('school_id', lmsAccount.school_id)
      .eq('source_type', 'canvas');

    // Build mapping lookup
    const mappingLookup = new Map();
    mappedCourses?.forEach(course => {
      if (course.lms_course_id) {
        mappingLookup.set(course.lms_course_id, course);
      }
    });

    // Format response
    const formattedCourses = canvasCourses.map((canvasCourse: any) => {
      const mapped = mappingLookup.get(canvasCourse.id.toString());
      return {
        lms_id: canvasCourse.id.toString(),
        name: canvasCourse.name,
        course_code: canvasCourse.course_code,
        workflow_state: canvasCourse.workflow_state,
        mapped_course_id: mapped?.id || null,
        mapped_course_name: mapped?.course_name || null
      };
    });

    return NextResponse.json({
      account: {
        id: lmsAccount.id,
        name: lmsAccount.name,
        kid_id: lmsAccount.kid_id,
        school_id: lmsAccount.school_id
      },
      courses: formattedCourses
    });
  } catch (error: any) {
    console.error('Canvas list-courses error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch Canvas courses' },
      { status: 500 }
    );
  }
}
