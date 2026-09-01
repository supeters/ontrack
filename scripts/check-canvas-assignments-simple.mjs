import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  // Get course 56
  const { data: course } = await supabase
    .from('courses')
    .select('lms_course_id, lms_account_id')
    .eq('id', 56)
    .single();

  // Get LMS account
  const { data: account } = await supabase
    .from('lms_accounts')
    .select('lms_url, api_token')
    .eq('id', course.lms_account_id)
    .single();

  const baseUrl = account.lms_url;
  const token = account.api_token;

  // Check assignment 486952
  console.log('\n=== Assignment 486952 ===');
  const res1 = await fetch(`${baseUrl}/api/v1/courses/${course.lms_course_id}/assignments/486952`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data1 = await res1.json();
  console.log('Status:', res1.status);
  console.log('Name:', data1.name);
  console.log('Created:', data1.created_at);

  // Check assignment 524090
  console.log('\n=== Assignment 524090 ===');
  const res2 = await fetch(`${baseUrl}/api/v1/courses/${course.lms_course_id}/assignments/524090`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data2 = await res2.json();
  console.log('Status:', res2.status);
  console.log('Name:', data2.name);
  console.log('Created:', data2.created_at);
}

main().catch(console.error);
