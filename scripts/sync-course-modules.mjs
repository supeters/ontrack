#!/usr/bin/env node

/**
 * Sync Moodle Course Modules and Assignments (Incremental)
 *
 * Usage:
 *   node scripts/sync-course-modules.mjs --course 59
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jfdrzjueqfxvozwcsyhm.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmZHJ6anVlcWZ4dm96d2NzeWhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDc4OTA4MCwiZXhwIjoyMDcwMzY1MDgwfQ.zJEJed2-6VPNjk2IM4xFZVU99lGdEeWfPZ5f0QVHmyc';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Parse command line arguments
const courseIdArg = process.argv.find((arg, i) => process.argv[i - 1] === '--course');
const COURSE_ID = courseIdArg ? parseInt(courseIdArg) : 59; // Default to High School Comp 3

/**
 * Get course from database
 */
async function getCourse(courseId) {
  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .eq('id', courseId)
    .single();

  if (error) throw error;
  if (!data) throw new Error(`Course ${courseId} not found`);
  if (data.source_type !== 'moodle') throw new Error('Course is not a Moodle course');
  if (!data.lms_course_id) throw new Error('Course has no Moodle course ID');

  return data;
}

/**
 * Get LMS account
 */
async function getLmsAccount(accountId) {
  const { data, error } = await supabase
    .from('lms_accounts')
    .select('*')
    .eq('id', accountId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Fetch course contents from Moodle
 */
async function fetchMoodleContents(lmsAccount, moodleCourseId) {
  console.log('📥 Fetching course contents from Moodle...');

  const response = await fetch(`${lmsAccount.lms_url}/webservice/rest/server.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      wstoken: lmsAccount.api_token,
      wsfunction: 'core_course_get_contents',
      moodlewsrestformat: 'json',
      courseid: moodleCourseId
    })
  });

  const result = await response.json();

  if (!Array.isArray(result)) {
    console.error('❌ Moodle API error:', result);
    throw new Error('Failed to fetch course contents');
  }

  console.log(`✅ Found ${result.length} sections`);
  return result;
}

/**
 * Sync a section (module) to activities table
 */
async function syncSection(section, course, lastSync) {
  const sectionId = section.id.toString();

  // Check if already exists
  const { data: existing } = await supabase
    .from('activities')
    .select('id, lms_synced_at')
    .eq('lms_id', sectionId)
    .eq('course_id', course.id)
    .single();

  // Section has no timemodified, so we always update if it exists
  const sectionData = {
    title: section.name || `Section ${section.section}`,
    description: section.summary || null,
    activity_type: 'module',
    course_id: course.id,
    kid_id: course.kid_id,
    lms_id: sectionId,
    lms_type: 'section',
    lms_source: 'moodle',
    position: section.section || 0,
    is_hidden: section.visible === 0,
    lms_synced_at: new Date().toISOString()
  };

  let activityId;

  if (existing) {
    // Update existing
    const { error } = await supabase
      .from('activities')
      .update(sectionData)
      .eq('id', existing.id);

    if (error) throw error;
    activityId = existing.id;
    console.log(`   ✏️  Updated section: ${sectionData.title}`);
  } else {
    // Insert new
    const { data: newActivity, error } = await supabase
      .from('activities')
      .insert(sectionData)
      .select('id')
      .single();

    if (error) throw error;
    activityId = newActivity.id;
    console.log(`   ➕ Created section: ${sectionData.title}`);
  }

  return activityId;
}

/**
 * Sync a module (assignment/resource) to activities table
 */
async function syncModule(module, course, parentActivityId, lastSync) {
  const moduleId = module.id.toString();

  // Check if already exists
  const { data: existing } = await supabase
    .from('activities')
    .select('id, lms_synced_at')
    .eq('lms_id', moduleId)
    .eq('course_id', course.id)
    .single();

  // Check if module was modified since last sync
  const moduleModified = module.timemodified || 0;
  const lastSyncTime = lastSync ? new Date(lastSync).getTime() / 1000 : 0;

  if (existing && moduleModified > 0 && moduleModified <= lastSyncTime) {
    // Skip - not modified since last sync
    return { id: existing.id, skipped: true };
  }

  const activityType = getActivityType(module.modname);

  // Construct Moodle URL if module.url is empty
  const resourceUrl = module.url || `${lmsAccount.lms_url}/mod/${module.modname}/view.php?id=${module.id}`;

  const moduleData = {
    title: module.name || 'Unnamed',
    description: module.description || null,
    activity_type: activityType,
    course_id: course.id,
    kid_id: course.kid_id,
    parent_activity_id: parentActivityId,
    lms_id: moduleId,
    lms_type: module.modname,
    lms_source: 'moodle',
    resource_url: resourceUrl,
    position: module.indent || 0,
    is_hidden: module.visible === 0,
    is_action_sync: activityType === 'assignment', // Assignments are actionable, resources are not
    lms_synced_at: new Date().toISOString()
  };

  let activityId;

  if (existing) {
    // Update existing
    const { error } = await supabase
      .from('activities')
      .update(moduleData)
      .eq('id', existing.id);

    if (error) throw error;
    activityId = existing.id;
    console.log(`      ✏️  Updated ${activityType}: ${moduleData.title}`);
  } else {
    // Insert new
    const { data: newActivity, error } = await supabase
      .from('activities')
      .insert(moduleData)
      .select('id')
      .single();

    if (error) throw error;
    activityId = newActivity.id;
    console.log(`      ➕ Created ${activityType}: ${moduleData.title}`);
  }

  return { id: activityId, skipped: false };
}

/**
 * Map Moodle module type to activity type
 */
function getActivityType(modname) {
  const typeMap = {
    'assign': 'assignment',
    'resource': 'resource',
    'url': 'resource',
    'page': 'resource',
    'book': 'resource',
    'folder': 'resource',
    'quiz': 'assignment',
    'forum': 'assignment',
    'label': 'resource'
  };

  return typeMap[modname] || 'resource';
}

/**
 * Display sync summary
 */
function displaySummary(stats, course) {
  console.log('\n' + '═'.repeat(80));
  console.log('📊 SYNC SUMMARY');
  console.log('═'.repeat(80));
  console.log(`Course: ${course.course_name}`);
  console.log(`Moodle Course ID: ${course.lms_course_id}`);
  console.log(`\nSections: ${stats.sections.created} created, ${stats.sections.updated} updated`);
  console.log(`Modules: ${stats.modules.created} created, ${stats.modules.updated} updated, ${stats.modules.skipped} skipped (unchanged)`);
  console.log(`\nTotal activities synced: ${stats.sections.created + stats.sections.updated + stats.modules.created + stats.modules.updated}`);
  console.log('═'.repeat(80));
}

/**
 * Main execution
 */
async function main() {
  try {
    console.log(`🚀 Syncing Moodle Course ${COURSE_ID}\n`);

    // Step 1: Get course from database
    console.log('🔍 Loading course from database...');
    const course = await getCourse(COURSE_ID);
    console.log(`✅ Course: ${course.course_name}`);
    console.log(`   Moodle ID: ${course.lms_course_id}`);
    console.log(`   Last sync: ${course.activities_last_sync || 'Never'}`);

    // Step 2: Get LMS account
    console.log('\n🔑 Loading LMS account...');
    const lmsAccount = await getLmsAccount(course.lms_account_id);
    console.log(`✅ Account: ${lmsAccount.lms_user_name}`);

    // Step 3: Fetch course contents from Moodle
    const sections = await fetchMoodleContents(lmsAccount, course.lms_course_id);

    // Step 4: Sync sections and modules
    console.log('\n📝 Syncing activities...\n');

    const stats = {
      sections: { created: 0, updated: 0 },
      modules: { created: 0, updated: 0, skipped: 0 }
    };

    for (const section of sections) {
      // Sync section (parent module)
      const { data: existingSection } = await supabase
        .from('activities')
        .select('id')
        .eq('lms_id', section.id.toString())
        .eq('course_id', course.id)
        .single();

      const sectionId = await syncSection(section, course, course.activities_last_sync);

      if (existingSection) {
        stats.sections.updated++;
      } else {
        stats.sections.created++;
      }

      // Sync modules within section
      for (const module of section.modules || []) {
        const { data: existingModule } = await supabase
          .from('activities')
          .select('id')
          .eq('lms_id', module.id.toString())
          .eq('course_id', course.id)
          .single();

        const result = await syncModule(module, course, sectionId, course.activities_last_sync);

        if (result.skipped) {
          stats.modules.skipped++;
        } else if (existingModule) {
          stats.modules.updated++;
        } else {
          stats.modules.created++;
        }
      }
    }

    // Step 5: Update last sync timestamp
    console.log('\n⏰ Updating last sync timestamp...');
    const { error: updateError } = await supabase
      .from('courses')
      .update({ activities_last_sync: new Date().toISOString() })
      .eq('id', course.id);

    if (updateError) throw updateError;
    console.log('✅ Timestamp updated');

    // Step 6: Display summary
    displaySummary(stats, course);

    console.log('\n✅ Sync complete!\n');

  } catch (error) {
    console.error('\n❌ Sync failed:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
