import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';

// Helper to call Moodle API
async function callMoodleApi(lmsAccount: any, wsFunction: string, params: Record<string, any> = {}) {
  const body = new URLSearchParams();
  body.append('wstoken', lmsAccount.api_token);
  body.append('wsfunction', wsFunction);
  body.append('moodlewsrestformat', 'json');

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      body.append(key, String(value));
    }
  });

  const response = await fetch(`${lmsAccount.lms_url}/webservice/rest/server.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });

  return await response.json();
}

// Helper to get Moodle user ID
async function getUserId(account: any) {
  const body = new URLSearchParams();
  body.append('wstoken', account.api_token);
  body.append('wsfunction', 'core_webservice_get_site_info');
  body.append('moodlewsrestformat', 'json');

  const response = await fetch(`${account.lms_url}/webservice/rest/server.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });

  const data = await response.json();
  return data.userid;
}

// GET /api/moodle/list-courses?accountId=xxx - List courses from Moodle with match status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');

    if (!accountId) {
      return NextResponse.json({ error: 'Missing accountId' }, { status: 400 });
    }

    const supabase = await getServerClient();

    // Get Moodle account
    const { data: account, error: accountError } = await supabase
      .from('lms_accounts')
      .select('*')
      .eq('id', parseInt(accountId))
      .single();

    if (accountError) throw accountError;

    if (!account.api_token) {
      return NextResponse.json({
        error: 'Account not connected. Please test connection first.'
      }, { status: 400 });
    }

    // Get enrolled courses from Moodle
    const moodleCourses = await callMoodleApi(account, 'core_enrol_get_users_courses', {
      userid: await getUserId(account)
    });

    console.log('Moodle API response:', JSON.stringify(moodleCourses, null, 2));

    if (!Array.isArray(moodleCourses)) {
      console.error('Moodle API returned non-array:', moodleCourses);
      throw new Error('Failed to fetch courses from Moodle: ' + JSON.stringify(moodleCourses));
    }

    // Get all local courses for this kid
    const { data: localCourses } = await supabase
      .from('courses')
      .select('id, course_name, lms_course_id')
      .eq('kid_id', account.kid_id);

    // Build course list with match status
    const coursesWithStatus = moodleCourses.map((mc: any) => {
      const lmsCourseId = mc.id.toString();
      const matchedCourse = localCourses?.find((lc: any) => {
        // Compare as strings since lms_course_id might be stored as string or number
        return lc.lms_course_id && lc.lms_course_id.toString() === lmsCourseId;
      });

      console.log(`Moodle course ${mc.fullname} (ID: ${lmsCourseId}): ${matchedCourse ? 'MATCHED to ' + matchedCourse.course_name : 'NOT MATCHED'}`);

      return {
        lms_id: lmsCourseId,
        fullname: mc.fullname,
        shortname: mc.shortname,
        matched: !!matchedCourse,
        matchedCourseId: matchedCourse?.id || null,
        matchedCourseName: matchedCourse?.course_name || null
      };
    });

    return NextResponse.json(coursesWithStatus);
  } catch (error: any) {
    console.error('Error listing Moodle courses:', error);
    return NextResponse.json(
      { error: error.message || String(error) },
      { status: 500 }
    );
  }
}
