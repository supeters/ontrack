#!/usr/bin/env node

/**
 * Sync Moodle Course Modules and Assignments (BULK VERSION)
 * Uses safe_bulk_sync_upsert in 2 sequential steps for high performance.
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
 * Normalizes multi-line task strings by removing extra newlines,
 * unescaping HTML entities, and trimming whitespace per line.
 */
function sanitizeTaskText(rawTasks) {
  if (!rawTasks) return '';

  return rawTasks
    .replace(/\r\n/g, '\n')              // Normalize line endings
    .replace(/&nbsp;/gi, ' ')            // Convert non-breaking spaces
    .replace(/&amp;/gi, '&')             // Decode basic HTML entities
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .split('\n')                         // Split into individual lines
    .map((line) => line.trim())          // Trim each line
    .filter((line) => line.length > 0)    // Drop completely empty lines
    .join('\n');                         // Rejoin with single clean newlines
}

/**
 * Strips inline style attributes and font tags from HTML descriptions
 * while retaining clean structural tags.
 */
function sanitizeDescriptionHtml(rawHtml) {
  if (!rawHtml) return null;

  const cleaned = rawHtml
    // Strip inline style attributes (e.g. style="font-family: georgia; ...")
    .replace(/\s*style="[^"]*"/gi, '')
    .replace(/\s*style='[^']*'/gi, '')
    // Strip font tags
    .replace(/<\/?font[^>]*>/gi, '')
    // Remove empty spans or divs left over after style removal
    .replace(/<(span|div)[^>]*>\s*<\/\1>/gi, '')
    .trim();

  return cleaned || null;
}

/**
 * Parse daily checklist from section summary/description
 */
function parseChecklist(description) {
  if (!description) return null;

  // 1. Convert block/list elements to newlines BEFORE stripping HTML tags.
  //    This prevents <li>Day 1...</li> or <p>Day 1</p> from fusing with preceding text.
  const cleanText = description
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<\/(p|li|div|h[1-6])>/gi, '\n')
    .replace(/<(p|li|div|ul|ol|h[1-6])[^>]*>/gi, '\n')
    .replace(/&nbsp;/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .trim();

  // 2. Day pattern:
  //    - Case insensitive ('Day' or 'day')
  //    - Handles ASCII hyphens, en-dashes (\u2013), em-dashes (\u2014), colons, and whitespace
  const dayNumberPattern = /Day\s+(\d+)[:\s\u2010-\u2015\-]*((?:(?!Day\s+\d+).)+)/gis;
  const dayMatches = [...cleanText.matchAll(dayNumberPattern)];

  if (dayMatches.length > 0) {
    const checklist = {};
    dayMatches.forEach((match) => {
      const dayNum = match[1];
      const tasks = sanitizeTaskText(match[2]);

      if (tasks) {
        checklist[`day${dayNum}`] = {
          label: `Day ${dayNum}`,
          tasks,
          completed: false
        };
      }
    });
    return Object.keys(checklist).length > 0 ? checklist : null;
  }

  // 3. Weekday pattern with Unicode dash support
  const weekdayPattern = /(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)[:\s\u2010-\u2015\-]*((?:(?!(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)).)+)/gis;
  const weekdayMatches = [...cleanText.matchAll(weekdayPattern)];

  if (weekdayMatches.length > 0) {
    const checklist = {};
    weekdayMatches.forEach((match, index) => {
      const weekday = match[1];
      const tasks = sanitizeTaskText(match[2]);

      if (tasks) {
        checklist[`day${index + 1}`] = {
          label: weekday,
          tasks,
          completed: false
        };
      }
    });
    return Object.keys(checklist).length > 0 ? checklist : null;
  }

  return null;
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
 * Call Moodle Web Service API
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
 * Main execution using 2-step Bulk Sync
 */
async function syncCourseContents() {
  try {
    console.log(`🚀 Starting Moodle BULK Sync | Course ID: ${COURSE_ID} | Mode: ${SYNC_MODE.toUpperCase()}\n`);

    // 1. Fetch Course
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('*')
      .eq('id', COURSE_ID)
      .single();

    if (courseError || !course) throw new Error(`Course ${COURSE_ID} not found`);
    if (course.source_type !== 'moodle') throw new Error('Course is not a Moodle course');
    if (!course.lms_course_id) throw new Error('Course has no Moodle course ID');

    // 2. Fetch LMS Account
    const { data: lmsAccount, error: accountError } = await supabase
      .from('lms_accounts')
      .select('*')
      .eq('id', course.lms_account_id)
      .single();

    if (accountError || !lmsAccount) throw new Error('LMS account not found');

    const isIncremental = SYNC_MODE === 'incremental';
    const lastSyncTime = (isIncremental && course.activities_last_sync)
      ? Math.floor(new Date(course.activities_last_sync).getTime() / 1000)
      : 0;

    console.log(`📡 Fetching course structure from Moodle...`);
    const sections = await callMoodleApi(lmsAccount, 'core_course_get_contents', {
      courseid: course.lms_course_id
    });

    if (!Array.isArray(sections) || sections.exception) {
      throw new Error(`Failed to fetch course contents from Moodle: ${sections.message || 'Unknown error'}`);
    }

    const sectionSyncRecords = [];
    const itemSyncRecords = [];
    let parsedChecklistsCount = 0;

    // Traverse Moodle tree and collect data
    for (const section of sections) {
      const sectionLmsId = section.id.toString();
      const isSection0 = section.section === 0;
      const dailyChecklist = !isSection0 ? parseChecklist(section.summary) : null;

      if (dailyChecklist) {
        parsedChecklistsCount++;
      }

      // Section Record (Module)
      sectionSyncRecords.push({
        lms_id: sectionLmsId,
        course_id: course.id,
        lms_source: 'moodle',
        title: section.name || `Section ${section.section}`,
        description: sanitizeDescriptionHtml(section.summary),
        activity_type: 'module',
        kid_id: course.kid_id,
        parent_activity_id: null,
        module_id: null,
        lms_type: 'section',
        position: section.section || 0,
        is_hidden: section.visible === 0,
        is_action_sync: !isSection0,
        daily_checklist: dailyChecklist,
        lms_synced_at: new Date().toISOString(),
        item_needs_processing: !isSection0
      });

      // Module Item Records (Assignments, Resources, Labels)
      for (const module of section.modules || []) {
        const moduleAdded = module.added || 0;
        const moduleModified = module.timemodified || 0;
        const mostRecentChange = Math.max(moduleAdded, moduleModified);

        // Incremental check: Skip if unmodified
        if (isIncremental && mostRecentChange > 0 && mostRecentChange <= lastSyncTime) {
          continue;
        }

        const activityType = getActivityType(module.modname);
        const resourceUrl = module.url || `${lmsAccount.lms_url}/mod/${module.modname}/view.php?id=${module.id}`;
        const isActionable = !isSection0 && (activityType === 'assignment' || module.modname === 'label');

        itemSyncRecords.push({
          lms_id: module.id.toString(),
          course_id: course.id,
          lms_source: 'moodle',
          title: module.name || 'Unnamed',
          description: sanitizeDescriptionHtml(module.description),
          activity_type: activityType,
          kid_id: course.kid_id,
          _parent_section_lms_id: sectionLmsId, // Temporary key for resolution in Step 2
          lms_type: module.modname,
          resource_url: resourceUrl,
          position: module.indent || 0,
          is_hidden: module.visible === 0,
          is_action_sync: isActionable,
          lms_synced_at: new Date().toISOString(),
          item_needs_processing: true
        });
      }
    }

    console.log(`\n📦 Prepared ${sectionSyncRecords.length} sections and ${itemSyncRecords.length} items for bulk sync.`);
    console.log(`📋 Successfully extracted checklists from ${parsedChecklistsCount} sections.`);

    // -------------------------------------------------------------
    // STEP 1: Bulk Upsert Sections
    // -------------------------------------------------------------
    console.log(`\n💾 Step 1: Bulk upserting ${sectionSyncRecords.length} sections...`);
    const { data: sectionResults, error: sectionError } = await supabase.rpc('safe_bulk_sync_upsert', {
      sync_records: sectionSyncRecords
    });

    if (sectionError) throw sectionError;

    // Create a mapping from Moodle Section LMS ID -> Supabase Activity ID
    const sectionLmsToDbId = {};
    sectionResults.forEach((res) => {
      if (res.activity_id) {
        sectionLmsToDbId[res.lms_id] = res.activity_id;
      }
    });

    const secInserted = sectionResults.filter(r => r.was_inserted).length;
    const secUpdated = sectionResults.filter(r => r.was_updated).length;
    const secSkipped = sectionResults.filter(r => r.was_skipped).length;
    console.log(`   📊 Sections -> Inserted: ${secInserted}, Updated: ${secUpdated}, Skipped: ${secSkipped}`);

    // -------------------------------------------------------------
    // STEP 2: Resolve Parent IDs & Bulk Upsert Items
    // -------------------------------------------------------------
    console.log(`\n💾 Step 2: Resolving parent sections & bulk upserting ${itemSyncRecords.length} items...`);

    itemSyncRecords.forEach((item) => {
      const parentSectionLmsId = item._parent_section_lms_id;
      const dbParentId = sectionLmsToDbId[parentSectionLmsId] || null;

      item.parent_activity_id = dbParentId;
      item.module_id = dbParentId;

      delete item._parent_section_lms_id; // Clean up temporary key
    });

    const { data: itemResults, error: itemError } = await supabase.rpc('safe_bulk_sync_upsert', {
      sync_records: itemSyncRecords
    });

    if (itemError) throw itemError;

    const itemsInserted = itemResults.filter(r => r.was_inserted).length;
    const itemsUpdated = itemResults.filter(r => r.was_updated).length;
    const itemsSkipped = itemResults.filter(r => r.was_skipped).length;
    console.log(`   📊 Items -> Inserted: ${itemsInserted}, Updated: ${itemsUpdated}, Skipped: ${itemsSkipped}`);

    // Update Last Sync Timestamp
    await supabase
      .from('courses')
      .update({ activities_last_sync: new Date().toISOString() })
      .eq('id', course.id);

    console.log(`\n✅ Moodle Bulk Sync Completed Successfully!`);

  } catch (error) {
    console.error(`\n❌ Moodle Bulk Sync Failed:`, error.message);
    process.exit(1);
  }
}

syncCourseContents();