#!/usr/bin/env node

/**
 * Test Hadasa's Moodle Login and Fetch Courses
 * Uses existing credentials from lms_accounts table
 *
 * Usage:
 *   node scripts/test-hadasa-moodle.mjs
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jfdrzjueqfxvozwcsyhm.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmZHJ6anVlcWZ4dm96d2NzeWhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDc4OTA4MCwiZXhwIjoyMDcwMzY1MDgwfQ.zJEJed2-6VPNjk2IM4xFZVU99lGdEeWfPZ5f0QVHmyc';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * Get Hadasa's LMS account from database
 */
async function getHadasaLmsAccount() {
  console.log('🔍 Looking up Hadasa\'s LMS account...');

  const { data, error } = await supabase
    .from('lms_accounts')
    .select('*')
    .eq('kid_id', 2) // Hadasa's kid_id
    .eq('lms_type', 'moodle')
    .single();

  if (error) {
    console.error('❌ Error finding LMS account:', error);
    throw error;
  }

  console.log(`✅ Found LMS account (ID: ${data.id})`);
  console.log(`   URL: ${data.lms_url}`);
  console.log(`   Username: ${data.lms_user_name}`);
  console.log(`   Last Sync: ${data.last_sync}`);

  return data;
}

/**
 * Get user info to get userid
 */
async function getUserInfo(lmsAccount) {
  console.log('\n👤 Getting user info...');

  const response = await fetch(`${lmsAccount.lms_url}/webservice/rest/server.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      wstoken: lmsAccount.api_token,
      wsfunction: 'core_webservice_get_site_info',
      moodlewsrestformat: 'json'
    })
  });

  const result = await response.json();

  if (result.userid) {
    console.log(`✅ User ID: ${result.userid}`);
    console.log(`   Name: ${result.fullname || result.username}`);
    return result.userid;
  } else {
    console.error('❌ Error getting user info:', result);
    throw new Error('Failed to get user info');
  }
}

/**
 * Get user's enrolled courses from Moodle
 */
async function getMoodleCourses(lmsAccount, userId) {
  console.log('\n📚 Fetching enrolled courses...');

  const response = await fetch(`${lmsAccount.lms_url}/webservice/rest/server.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      wstoken: lmsAccount.api_token,
      wsfunction: 'core_enrol_get_users_courses',
      moodlewsrestformat: 'json',
      userid: userId
    })
  });

  const result = await response.json();

  if (Array.isArray(result)) {
    console.log(`✅ Found ${result.length} enrolled courses`);
    return result;
  } else {
    console.error('❌ Error fetching courses:', result);

    // Check if token is invalid
    if (result.exception && result.message?.includes('token')) {
      console.log('\n⚠️  API token appears to be invalid or expired');
      console.log('You may need to regenerate the token by logging in again');
    }

    throw new Error('Failed to fetch courses');
  }
}

/**
 * Get existing courses from database
 */
async function getExistingCourses() {
  const { data, error } = await supabase
    .from('courses')
    .select('id, course_name, lms_course_id, lms_source')
    .eq('kid_id', 2)
    .eq('lms_source', 'moodle')
    .eq('is_active', true);

  if (error) {
    console.error('⚠️  Error fetching existing courses:', error);
    return [];
  }

  return data || [];
}

/**
 * Display course information
 */
function displayCourses(moodleCourses, existingCourses) {
  console.log('\n📋 Hadasa\'s Moodle Courses:\n');
  console.log('─'.repeat(100));

  const existingMap = new Map();
  existingCourses.forEach(course => {
    existingMap.set(course.lms_course_id, course);
  });

  moodleCourses.forEach((course, index) => {
    const existing = existingMap.get(course.id.toString());
    const status = existing ? '✅ IN DATABASE' : '❌ NOT SYNCED';

    console.log(`${index + 1}. ${course.fullname}`);
    console.log(`   Moodle ID: ${course.id} | Status: ${status}`);
    if (existing) {
      console.log(`   Database ID: ${existing.id} | Name: ${existing.course_name}`);
    }
    console.log(`   Short Name: ${course.shortname}`);
    console.log(`   Visible: ${course.visible ? 'Yes' : 'No'}`);
    if (course.startdate) {
      const startDate = new Date(course.startdate * 1000);
      console.log(`   Start Date: ${startDate.toLocaleDateString()}`);
    }
    console.log('─'.repeat(100));
  });

  console.log(`\nTotal: ${moodleCourses.length} Moodle courses`);
  console.log(`Synced to database: ${existingCourses.length} courses\n`);
}

/**
 * Main execution
 */
async function main() {
  try {
    console.log('🚀 Testing Hadasa\'s Moodle Integration\n');

    // Step 1: Get LMS account from database
    const lmsAccount = await getHadasaLmsAccount();

    // Step 2: Get user ID
    const userId = await getUserInfo(lmsAccount);

    // Step 3: Fetch courses from Moodle
    const moodleCourses = await getMoodleCourses(lmsAccount, userId);

    // Step 3: Get existing courses from database
    console.log('\n🗄️  Checking existing courses in database...');
    const existingCourses = await getExistingCourses();
    console.log(`✅ Found ${existingCourses.length} courses in database`);

    // Step 4: Display results
    displayCourses(moodleCourses, existingCourses);

    console.log('✅ Test completed successfully!\n');

    const notSynced = moodleCourses.length - existingCourses.length;
    if (notSynced > 0) {
      console.log(`📝 Next steps:`);
      console.log(`   ${notSynced} course(s) not yet synced to database`);
      console.log(`   You can sync these courses using the MoodleSetup component\n`);
    } else {
      console.log('✅ All Moodle courses are synced to the database!\n');
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
