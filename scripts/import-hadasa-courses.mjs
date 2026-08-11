#!/usr/bin/env node

/**
 * Import Hadasa's Moodle Courses to OnTrack Database
 *
 * Usage:
 *   node scripts/import-hadasa-courses.mjs
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jfdrzjueqfxvozwcsyhm.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmZHJ6anVlcWZ4dm96d2NzeWhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDc4OTA4MCwiZXhwIjoyMDcwMzY1MDgwfQ.zJEJed2-6VPNjk2IM4xFZVU99lGdEeWfPZ5f0QVHmyc';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Course mapping: Moodle ID -> Database ID
const COURSE_MAPPING = {
  5596: { db_id: 59, name: 'High School Composition III D 2026-27' },
  5361: { db_id: 58, name: 'AP US History A 2026-27' },
  5601: { db_id: 61, name: 'Informal Fallacies Spring A 2026-27' }
};

const HADASA_KID_ID = 2;

/**
 * Get Hadasa's LMS account
 */
async function getHadasaLmsAccount() {
  const { data, error } = await supabase
    .from('lms_accounts')
    .select('*')
    .eq('kid_id', HADASA_KID_ID)
    .eq('lms_type', 'moodle')
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get user ID from Moodle
 */
async function getUserInfo(lmsAccount) {
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
  if (!result.userid) throw new Error('Failed to get user info');
  return result.userid;
}

/**
 * Get Moodle courses
 */
async function getMoodleCourses(lmsAccount, userId) {
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
  if (!Array.isArray(result)) throw new Error('Failed to fetch courses');
  return result;
}

/**
 * Import course to database
 */
async function importCourse(moodleCourse, dbId, lmsAccountId) {
  console.log(`\n📚 Importing: ${moodleCourse.fullname}`);
  console.log(`   Moodle ID: ${moodleCourse.id} -> Database ID: ${dbId}`);

  // Prepare course data
  const courseData = {
    kid_id: HADASA_KID_ID,
    course_name: moodleCourse.fullname,
    subject: extractSubject(moodleCourse.fullname),
    teacher: null, // Can be updated later
    course_code: moodleCourse.shortname,
    lms_course_id: moodleCourse.id.toString(),
    source_type: 'moodle',
    lms_account_id: lmsAccountId,
    sync_status: 'synced',
    is_active: true,
    lms_synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  // Check if course already exists
  const { data: existing, error: checkError } = await supabase
    .from('courses')
    .select('id, course_name')
    .eq('id', dbId)
    .single();

  if (existing) {
    // Update existing course
    console.log(`   ⚠️  Course ${dbId} already exists: ${existing.course_name}`);
    console.log(`   Updating with Moodle data...`);

    const { error: updateError } = await supabase
      .from('courses')
      .update(courseData)
      .eq('id', dbId);

    if (updateError) {
      console.error(`   ❌ Error updating course:`, updateError);
      throw updateError;
    }

    console.log(`   ✅ Updated course ${dbId}`);
  } else {
    // Insert new course
    const { error: insertError } = await supabase
      .from('courses')
      .insert(courseData);

    if (insertError) {
      console.error(`   ❌ Error inserting course:`, insertError);
      throw insertError;
    }

    console.log(`   ✅ Created course ${dbId}`);
  }

  return dbId;
}

/**
 * Extract subject from course name
 */
function extractSubject(courseName) {
  // Extract subject from name like "High School Composition III D 2026-27"
  if (courseName.includes('Composition')) return 'Writing';
  if (courseName.includes('History')) return 'History';
  if (courseName.includes('Logic') || courseName.includes('Fallacies')) return 'Logic';
  if (courseName.includes('Science')) return 'Science';
  if (courseName.includes('Studies')) return 'Classical Studies';
  return 'Other';
}

/**
 * Display summary
 */
function displaySummary(imported) {
  console.log('\n' + '═'.repeat(80));
  console.log('📊 IMPORT SUMMARY');
  console.log('═'.repeat(80));
  console.log(`Total courses imported: ${imported.length}`);
  console.log('\nCourses in database:');
  imported.forEach(course => {
    console.log(`  • ${course.course_name} (ID: ${course.db_id}, Moodle: ${course.moodle_id})`);
  });
  console.log('═'.repeat(80));
  console.log('\n✅ Import complete!\n');
}

/**
 * Main execution
 */
async function main() {
  try {
    console.log('🚀 Importing Hadasa\'s Moodle Courses to OnTrack\n');

    // Step 1: Get LMS account
    console.log('🔍 Getting Hadasa\'s LMS account...');
    const lmsAccount = await getHadasaLmsAccount();
    console.log(`✅ LMS Account ID: ${lmsAccount.id}`);

    // Step 2: Get user ID
    console.log('\n👤 Getting Moodle user ID...');
    const userId = await getUserInfo(lmsAccount);
    console.log(`✅ User ID: ${userId}`);

    // Step 3: Fetch all Moodle courses
    console.log('\n📚 Fetching Moodle courses...');
    const allCourses = await getMoodleCourses(lmsAccount, userId);
    console.log(`✅ Found ${allCourses.length} total courses`);

    // Step 4: Filter to only the courses we want to import
    const coursesToImport = allCourses.filter(course =>
      COURSE_MAPPING.hasOwnProperty(course.id)
    );

    console.log(`\n🎯 Importing ${coursesToImport.length} selected courses...`);

    // Step 5: Import each course
    const imported = [];
    for (const moodleCourse of coursesToImport) {
      const mapping = COURSE_MAPPING[moodleCourse.id];
      const dbId = await importCourse(moodleCourse, mapping.db_id, lmsAccount.id);

      imported.push({
        db_id: dbId,
        moodle_id: moodleCourse.id,
        course_name: moodleCourse.fullname
      });
    }

    // Step 6: Display summary
    displaySummary(imported);

  } catch (error) {
    console.error('\n❌ Import failed:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
