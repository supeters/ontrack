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

// POST /api/moodle/sync-courses - Fetch courses from Moodle and match/create in database
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accountId } = body;

    if (!accountId) {
      return NextResponse.json({ error: 'Missing accountId' }, { status: 400 });
    }

    const supabase = await getServerClient();

    // Get Moodle account
    const { data: account, error: accountError } = await supabase
      .from('lms_accounts')
      .select('*')
      .eq('id', accountId)
      .single();

    if (accountError) throw accountError;

    if (!account.api_token) {
      return NextResponse.json({
        success: false,
        error: 'Account not connected. Please test connection first.'
      });
    }

    // Get enrolled courses from Moodle
    const moodleCourses = await callMoodleApi(account, 'core_enrol_get_users_courses', {
      userid: await getUserId(account)
    });

    if (!Array.isArray(moodleCourses)) {
      throw new Error('Failed to fetch courses from Moodle');
    }

    console.log(`📚 Found ${moodleCourses.length} courses from Moodle for kid ${account.kid_id}`);

    let created = 0;
    let matched = 0;

    for (const moodleCourse of moodleCourses) {
      const lmsCourseId = moodleCourse.id.toString();
      const courseName = moodleCourse.fullname || moodleCourse.shortname;

      // Check if we already have this course with lms_id
      const { data: existingByLmsId } = await supabase
        .from('courses')
        .select('id')
        .eq('lms_id', lmsCourseId)
        .eq('kid_id', account.kid_id)
        .single();

      if (existingByLmsId) {
        console.log(`✓ Course already matched: ${courseName}`);
        matched++;
        continue;
      }

      // Try to find matching course by name
      const { data: existingByName } = await supabase
        .from('courses')
        .select('id, course_name')
        .eq('kid_id', account.kid_id)
        .ilike('course_name', `%${courseName.split(' ')[0]}%`)
        .limit(1)
        .single();

      if (existingByName) {
        // Update existing course with lms_id and source info
        const { error: updateError } = await supabase
          .from('courses')
          .update({
            lms_id: lmsCourseId,
            lms_course_id: lmsCourseId,
            lms_account_id: accountId,
            source_type: 'moodle',
            lms_synced_at: new Date().toISOString()
          })
          .eq('id', existingByName.id);

        if (updateError) {
          console.error(`Error updating course ${existingByName.id}:`, updateError);
        } else {
          console.log(`🔗 Matched and updated: "${existingByName.course_name}" → "${courseName}"`);
          matched++;
        }
      } else {
        // Create new course
        const { error: insertError } = await supabase
          .from('courses')
          .insert({
            course_name: courseName,
            course_code: moodleCourse.shortname,
            kid_id: account.kid_id,
            lms_id: lmsCourseId,
            lms_course_id: lmsCourseId,
            lms_account_id: accountId,
            source_type: 'moodle',
            lms_synced_at: new Date().toISOString(),
            is_active: true
          });

        if (insertError) {
          console.error(`Error creating course ${courseName}:`, insertError);
        } else {
          console.log(`➕ Created new course: ${courseName}`);
          created++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      coursesCount: moodleCourses.length,
      created,
      matched,
      message: `Processed ${moodleCourses.length} Moodle courses: ${created} created, ${matched} matched`
    });
  } catch (error: any) {
    console.error('Error syncing Moodle courses:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || String(error)
      },
      { status: 500 }
    );
  }
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
