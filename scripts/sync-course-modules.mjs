#!/usr/bin/env node

/**
 * Sync Moodle Course Modules and Assignments
 *
 * Usage:
 *   node scripts/sync-course-modules.mjs --course 58 --mode incremental
 *   node scripts/sync-course-modules.mjs --course 58 --mode all
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jfdrzjueqfxvozwcsyhm.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmZHJ6anVlcWZ4dm96d2NzeWhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDc4OTA4MCwiZXhwIjoyMDcwMzY1MDgwfQ.zJEJed2-6VPNjk2IM4xFZVU99lGdEeWfPZ5f0QVHmyc';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Parse command line arguments
const courseIdArg = process.argv.find((arg, i) => process.argv[i - 1] === '--course');
const modeArg = process.argv.find((arg, i) => process.argv[i - 1] === '--mode');

const COURSE_ID = courseIdArg ? parseInt(courseIdArg, 10) : 58;
const SYNC_MODE = modeArg && ['all', 'incremental'].includes(modeArg.toLowerCase()) ? modeArg.toLowerCase() : 'incremental';

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
 * Call Moodle Web Service helper
 */
async function callMoodleApi(lmsAccount, wsFunction, params = {}) {
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

  const result = await response.json();
  if (result.exception || (result.warnings && result.warnings.length > 0 && !Array.isArray(result))) {
    console.error(`❌ Moodle API Error (${wsFunction}):`, JSON.stringify(result, null, 2));
  }
  return result;
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
 * SYNC COURSE CONTENTS (Supports Incremental & Full Modes)
 */
async function syncCourseContents(lmsAccount, course, isIncremental = false) {
  const lastSyncTime = (isIncremental && course.activities_last_sync)
    ? Math.floor(new Date(course.activities_last_sync).getTime() / 1000)
    : 0;

  if (isIncremental) {
    console.log(`⚡ Running Incremental Sync (checking items modified since timestamp: ${lastSyncTime})...`);
  } else {
    console.log('📥 Running Full Sync (fetching complete course tree)...');
  }

  const sections = await callMoodleApi(lmsAccount, 'core_course_get_contents', {
    courseid: course.lms_course_id
  });

  if (!Array.isArray(sections) || sections.exception) {
    throw new Error(`Failed to fetch course contents from Moodle: ${sections.message || 'Unknown error'}`);
  }

  const stats = {
    sections: { created: 0, updated: 0 },
    modules: { created: 0, updated: 0, skipped: 0 }
  };

  for (const section of sections) {
    const sectionId = section.id.toString();

    const { data: existingSection } = await supabase
      .from('activities')
      .select('id')
      .eq('lms_id', sectionId)
      .eq('course_id', course.id)
      .single();

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

    let parentActivityId;
    if (existingSection) {
      await supabase.from('activities').update(sectionData).eq('id', existingSection.id);
      parentActivityId = existingSection.id;
      stats.sections.updated++;
    } else {
      const { data: newSec } = await supabase.from('activities').insert(sectionData).select('id').single();
      parentActivityId = newSec?.id;
      stats.sections.created++;
    }

    for (const module of section.modules || []) {
      const moduleId = module.id.toString();
      const moduleModified = module.timemodified || 0;

      const { data: existingModule } = await supabase
        .from('activities')
        .select('id')
        .eq('lms_id', moduleId)
        .eq('course_id', course.id)
        .single();

      // Skip in incremental mode if the module hasn't been modified since last sync
      if (isIncremental && existingModule && moduleModified > 0 && moduleModified <= lastSyncTime) {
        stats.modules.skipped++;
        continue;
      }

      const activityType = getActivityType(module.modname);
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
        is_action_sync: activityType === 'assignment',
        item_needs_processing: true,
        lms_synced_at: new Date().toISOString()
      };

      if (existingModule) {
        await supabase.from('activities').update(moduleData).eq('id', existingModule.id);
        stats.modules.updated++;
        console.log(`   ✏️  Updated activity: ${moduleData.title}`);
      } else {
        await supabase.from('activities').insert(moduleData);
        stats.modules.created++;
        console.log(`   ➕ Created activity: ${moduleData.title}`);
      }
    }
  }

  return stats;
}

/**
 * Main execution
 */
async function main() {
  try {
    console.log(`🚀 Starting Moodle Sync | Course ID: ${COURSE_ID} | Mode: ${SYNC_MODE.toUpperCase()}\n`);

    const course = await getCourse(COURSE_ID);
    const lmsAccount = await getLmsAccount(course.lms_account_id);

    const isIncremental = SYNC_MODE === 'incremental';
    const stats = await syncCourseContents(lmsAccount, course, isIncremental);

    console.log(`\n📊 Sync Complete: ${stats.modules.created} created, ${stats.modules.updated} updated, ${stats.modules.skipped} skipped.`);

    // Update last sync timestamp
    await supabase
      .from('courses')
      .update({ activities_last_sync: new Date().toISOString() })
      .eq('id', course.id);

    console.log('⏰ Updated activities_last_sync timestamp.\n');

  } catch (error) {
    console.error('\n❌ Sync failed:', error.message);
    process.exit(1);
  }
}

main();
