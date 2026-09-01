import { getServiceRoleClient } from '../lib/supabase/service';

async function checkAssignments() {
  const supabase = getServiceRoleClient();

  // Get course 56 details
  const { data: course } = await supabase
    .from('courses')
    .select('id, course_name, lms_course_id, lms_account_id')
    .eq('id', 56)
    .single();

  if (!course) {
    console.log('Course 56 not found');
    return;
  }

  console.log(`Course: ${course.course_name} (Canvas ID: ${course.lms_course_id})`);

  // Get LMS account
  const { data: lmsAccount } = await supabase
    .from('lms_accounts')
    .select('id, name, lms_url, api_token')
    .eq('id', course.lms_account_id)
    .single();

  if (!lmsAccount) {
    console.log('LMS account not found');
    return;
  }

  const token = lmsAccount.api_token;
  const baseUrl = lmsAccount.lms_url;

  // Check assignment 486952
  console.log('\n=== Assignment 486952 (ID 25297) ===');
  try {
    const res1 = await fetch(`${baseUrl}/api/v1/courses/${course.lms_course_id}/assignments/486952`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res1.ok) {
      const data1 = await res1.json();
      console.log(`Name: ${data1.name}`);
      console.log(`Created: ${data1.created_at}`);
      console.log(`Updated: ${data1.updated_at}`);
      console.log(`Published: ${data1.published}`);
    } else {
      console.log(`Error: ${res1.status} - ${await res1.text()}`);
    }
  } catch (error) {
    console.log(`Error fetching: ${error}`);
  }

  // Check assignment 524090
  console.log('\n=== Assignment 524090 (ID 25410) ===');
  try {
    const res2 = await fetch(`${baseUrl}/api/v1/courses/${course.lms_course_id}/assignments/524090`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res2.ok) {
      const data2 = await res2.json();
      console.log(`Name: ${data2.name}`);
      console.log(`Created: ${data2.created_at}`);
      console.log(`Updated: ${data2.updated_at}`);
      console.log(`Published: ${data2.published}`);
    } else {
      console.log(`Error: ${res2.status} - ${await res2.text()}`);
    }
  } catch (error) {
    console.log(`Error fetching: ${error}`);
  }
}

checkAssignments().catch(console.error);
