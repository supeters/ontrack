import { getServiceRoleClient } from '@/lib/supabase/service';

export interface MoodleSyncParams {
  courseId: number;
  onProgress?: (message: string) => void;
}

/**
 * Strips inline style attributes and font tags from HTML
 */
function sanitizeDescriptionHtml(rawHtml: string | null): string | null {
  if (!rawHtml) return null;

  const cleaned = rawHtml
    .replace(/\s*style="[^"]*"/gi, '')
    .replace(/\s*style='[^']*'/gi, '')
    .replace(/<\/?font[^>]*>/gi, '')
    .replace(/<(span|div)[^>]*>\s*<\/\1>/gi, '')
    .trim();

  return cleaned || null;
}

/**
 * Parse "Day 1:", "Day 2:", etc. patterns from section content
 * Returns array of tasks with their text
 */
function parseDayTasks(htmlContent: string | null): Array<{ text: string; dayNumber: number }> {
  if (!htmlContent) return [];

  // Strip HTML tags first
  const textContent = htmlContent
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .trim();

  const tasks: Array<{ text: string; dayNumber: number }> = [];
  const lines = textContent.split('\n').map(line => line.trim()).filter(Boolean);

  let currentDay: number | null = null;
  let currentText: string[] = [];

  for (const line of lines) {
    // Match "Day N:" or "Day N—" at the start of a line (case insensitive)
    // Handles : (colon), — (em dash), – (en dash), - (hyphen)
    const dayMatch = line.match(/^Day\s+(\d+)\s*[:\-—–]/i);

    if (dayMatch) {
      // Save previous day's content if exists
      if (currentDay !== null && currentText.length > 0) {
        tasks.push({
          dayNumber: currentDay,
          text: currentText.join(' ').trim()
        });
      }

      // Start new day
      currentDay = parseInt(dayMatch[1], 10);
      // Get text after "Day N:"
      const afterColon = line.substring(dayMatch[0].length).trim();
      currentText = afterColon ? [afterColon] : [];
    } else if (currentDay !== null) {
      // Continue accumulating text for current day
      // Stop if we hit another section marker or empty pattern
      if (line && !line.match(/^(Before Class|Attend Class|Week \d+)/i)) {
        currentText.push(line);
      }
    }
  }

  // Save last day's content
  if (currentDay !== null && currentText.length > 0) {
    tasks.push({
      dayNumber: currentDay,
      text: currentText.join(' ').trim()
    });
  }

  return tasks;
}

/**
 * Parse simple list-based tasks from section content
 * Each non-heading line becomes a task
 * Skips Week/Chapter headings
 */
function parseListTasks(htmlContent: string | null): Array<{ text: string; lineNumber: number }> {
  if (!htmlContent) return [];

  // Strip HTML tags first
  const textContent = htmlContent
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .trim();

  const tasks: Array<{ text: string; lineNumber: number }> = [];
  const lines = textContent.split('\n').map(line => line.trim()).filter(Boolean);

  let lineNumber = 0;

  for (const line of lines) {
    // Skip common heading patterns
    if (line.match(/^Week\s+\d+/i)) continue;
    if (line.match(/^Unit\s+\d+/i)) continue;
    if (line.match(/^Day\s+\d+\s*[:\-—–]/i)) continue; // Skip if Day N: pattern exists (will be handled by parseDayTasks)

    // Skip very short lines (likely fragments)
    if (line.length < 5) continue;

    // This is a task line
    lineNumber++;
    tasks.push({
      text: line,
      lineNumber: lineNumber
    });
  }

  return tasks;
}

/**
 * Map Moodle module type to activity type
 */
function getActivityType(modname: string): string {
  const typeMap: Record<string, string> = {
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
async function callMoodleApi(lmsAccount: any, wsFunction: string, params: Record<string, any> = {}): Promise<any> {
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
 * Sync Moodle course sections and modules
 *
 * Parsed Task Behavior:
 * - Parses section summaries to extract tasks automatically:
 *   1. "Day 1:", "Day 2:", etc. patterns → day_task
 *   2. Simple line-by-line lists → list_task (skips Week/Chapter headings)
 * - Creates tasks on FIRST sync only (insert-only, never updates)
 * - Once created, parsed tasks become fully user-controlled
 * - Users can freely modify title, plan_date, completion status, etc.
 * - If content is removed from Moodle, the task is soft-deleted
 * - If new content is added to Moodle, new tasks are created
 */
export async function syncMoodleCourse(params: MoodleSyncParams): Promise<void> {
  const { courseId, onProgress } = params;

  const log = (message: string) => {
    console.log(message);
    if (onProgress) {
      onProgress(message);
    }
  };

  const supabase = getServiceRoleClient();

  log(`🚀 Starting Moodle sync for course ${courseId}`);

  // Fetch Course
  const { data: course, error: courseError } = await supabase
    .from('courses')
    .select('*')
    .eq('id', courseId)
    .single();

  if (courseError || !course) throw new Error(`Course ${courseId} not found`);
  if (course.source_type !== 'moodle') throw new Error('Course is not a Moodle course');
  if (!course.lms_course_id) throw new Error('Course has no Moodle course ID');

  // Fetch LMS Account
  const { data: lmsAccount, error: accountError } = await supabase
    .from('lms_accounts')
    .select('*')
    .eq('id', course.lms_account_id)
    .single();

  if (accountError || !lmsAccount) throw new Error('LMS account not found');

  const isIncremental = false;
  const lastSyncTime = (isIncremental && course.activities_last_sync)
    ? Math.floor(new Date(course.activities_last_sync).getTime() / 1000)
    : 0;

  log(`📡 Fetching course structure from Moodle...`);
  const sections = await callMoodleApi(lmsAccount, 'core_course_get_contents', {
    courseid: course.lms_course_id
  });

  if (!Array.isArray(sections) || (sections as any).exception) {
    throw new Error(`Failed to fetch course contents from Moodle: ${(sections as any).message || 'Unknown error'}`);
  }

  const sectionSyncRecords = [];
  const itemSyncRecords = [];
  const taskSyncRecords = []; // For Day N tasks parsed from section summaries
  // Track all lms_id values we sync (for deletion detection)
  const syncedLmsIds = new Set<string>();


  // Traverse Moodle tree and collect data
  for (const section of sections) {
    const sectionLmsId = section.id.toString();
    const isSection0 = section.section === 0;

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
      lms_synced_at: new Date().toISOString(),
      item_needs_processing: !isSection0
    });
    syncedLmsIds.add(sectionLmsId);

    // Parse tasks from section summary (if not section 0)
    if (!isSection0 && section.summary) {
      // Try Day N: pattern first
      const dayTasks = parseDayTasks(section.summary);

      if (dayTasks.length > 0) {
        // Use Day N: tasks
        for (const dayTask of dayTasks) {
          const taskLmsId = `${sectionLmsId}_day_${dayTask.dayNumber}`;

          taskSyncRecords.push({
            lms_id: taskLmsId,
            course_id: course.id,
            lms_source: 'moodle',
            title: `Day ${dayTask.dayNumber}: ${dayTask.text}`,
            description: null,
            activity_type: 'task',
            kid_id: course.kid_id,
            _parent_section_lms_id: sectionLmsId,
            lms_type: 'day_task',
            position: dayTask.dayNumber,
            is_hidden: section.visible === 0,
            is_action_sync: true,
            lms_synced_at: new Date().toISOString(),
            item_needs_processing: false,
            _is_day_task: true
          });
          syncedLmsIds.add(taskLmsId);
        }
      } else {
        // No Day N: pattern found, try list-based tasks
        const listTasks = parseListTasks(section.summary);

        for (const listTask of listTasks) {
          const taskLmsId = `${sectionLmsId}_line_${listTask.lineNumber}`;

          taskSyncRecords.push({
            lms_id: taskLmsId,
            course_id: course.id,
            lms_source: 'moodle',
            title: listTask.text,
            description: null,
            activity_type: 'task',
            kid_id: course.kid_id,
            _parent_section_lms_id: sectionLmsId,
            lms_type: 'list_task',
            position: listTask.lineNumber,
            is_hidden: section.visible === 0,
            is_action_sync: true,
            lms_synced_at: new Date().toISOString(),
            item_needs_processing: false,
            _is_list_task: true
          });
          syncedLmsIds.add(taskLmsId);
        }
      }
    }

    // Module Item Records
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
        _parent_section_lms_id: sectionLmsId,
        lms_type: module.modname,
        resource_url: resourceUrl,
        position: module.indent || 0,
        is_hidden: module.visible === 0,
        is_action_sync: isActionable,
        lms_synced_at: new Date().toISOString(),
        item_needs_processing: !isSection0
      });
      syncedLmsIds.add(module.id.toString());
    }
  }

  log(`📦 Prepared ${sectionSyncRecords.length} sections, ${itemSyncRecords.length} items, and ${taskSyncRecords.length} day tasks`);

  // STEP 1: Bulk Upsert Sections
  log(`💾 Step 1: Bulk upserting ${sectionSyncRecords.length} sections...`);
  const { data: sectionResults, error: sectionError } = await supabase.rpc('safe_bulk_sync_upsert', {
    sync_records: sectionSyncRecords
  });

  if (sectionError) throw sectionError;

  // Create mapping from Section LMS ID -> Activity ID
  const sectionLmsToDbId: Record<string, number> = {};
  sectionResults.forEach((res: any) => {
    if (res.activity_id) {
      sectionLmsToDbId[res.lms_id] = res.activity_id;
    }
  });

  const secInserted = sectionResults.filter((r: any) => r.was_inserted).length;
  const secUpdated = sectionResults.filter((r: any) => r.was_updated).length;
  const secSkipped = sectionResults.filter((r: any) => r.was_skipped).length;
  log(`   📊 Sections -> Inserted: ${secInserted}, Updated: ${secUpdated}, Skipped: ${secSkipped}`);

  // STEP 2: Resolve Parent IDs & Bulk Upsert Items
  log(`💾 Step 2: Resolving parent sections & bulk upserting ${itemSyncRecords.length} items...`);

  itemSyncRecords.forEach((item: any) => {
    const parentSectionLmsId = item._parent_section_lms_id;
    const dbParentId = sectionLmsToDbId[parentSectionLmsId] || null;

    item.parent_activity_id = dbParentId;
    item.module_id = dbParentId;

    delete item._parent_section_lms_id;
  });

  const { data: itemResults, error: itemError } = await supabase.rpc('safe_bulk_sync_upsert', {
    sync_records: itemSyncRecords
  });

  if (itemError) throw itemError;

  const itemsInserted = itemResults.filter((r: any) => r.was_inserted).length;
  const itemsUpdated = itemResults.filter((r: any) => r.was_updated).length;
  const itemsSkipped = itemResults.filter((r: any) => r.was_skipped).length;
  log(`   📊 Items -> Inserted: ${itemsInserted}, Updated: ${itemsUpdated}, Skipped: ${itemsSkipped}`);

  // STEP 3: Insert NEW Parsed Tasks Only (Never Update)
  // Parsed tasks (day_task, list_task) are "seed data" - once created, they become fully user-controlled
  if (taskSyncRecords.length > 0) {
    log(`💾 Step 3: Checking for new parsed tasks...`);

    // Get existing parsed task lms_ids for this course (both day_task and list_task)
    const { data: existingParsedTasks } = await supabase
      .from('activities')
      .select('lms_id')
      .eq('course_id', courseId)
      .eq('lms_source', 'moodle')
      .in('lms_type', ['day_task', 'list_task'])
      .eq('is_deleted', false);

    const existingLmsIds = new Set((existingParsedTasks || []).map(t => t.lms_id));

    // Filter to only NEW tasks that don't exist yet
    const newTasksToInsert = taskSyncRecords.filter((task: any) => !existingLmsIds.has(task.lms_id));

    if (newTasksToInsert.length > 0) {
      log(`   Found ${newTasksToInsert.length} new parsed tasks to create...`);

      // Resolve parent IDs for new tasks
      newTasksToInsert.forEach((task: any) => {
        const parentSectionLmsId = task._parent_section_lms_id;
        const dbParentId = sectionLmsToDbId[parentSectionLmsId] || null;

        task.parent_activity_id = dbParentId;
        task.module_id = dbParentId;

        delete task._parent_section_lms_id;
        delete task._is_day_task;
        delete task._is_list_task;
      });

      const { data: taskResults, error: taskError } = await supabase.rpc('safe_bulk_sync_upsert', {
        sync_records: newTasksToInsert
      });

      if (taskError) throw taskError;

      const tasksInserted = taskResults.filter((r: any) => r.was_inserted).length;
      log(`   📊 Parsed Tasks -> Created: ${tasksInserted} new tasks`);
    } else {
      log(`   📊 Parsed Tasks -> No new tasks to create (all existing tasks preserved)`);
    }
  }

  // Step 4: Handle deletions - soft delete items that weren't in the sync
  log(`🗑️  Step 4: Processing deletions...`);

  const syncedLmsIdsArray = Array.from(syncedLmsIds);
  const { data: deletedItems, error: deleteError } = await supabase
    .from('activities')
    .update({ is_deleted: true })
    .eq('course_id', courseId)
    .eq('lms_source', 'moodle')
    .eq('is_deleted', false)
    .not('lms_id', 'in', `(${syncedLmsIdsArray.map(id => `"${id}"`).join(',')})`)
    .select('id, title');

  if (deleteError) {
    log(`   ⚠️  Warning: Could not process deletions: ${deleteError.message}`);
  } else {
    const deletedCount = deletedItems?.length || 0;
    if (deletedCount > 0) {
      log(`   📊 Soft-deleted ${deletedCount} items removed from Moodle`);
    } else {
      log(`   📊 No items to delete`);
    }
  }
  // Update Last Sync Timestamp
  await supabase
    .from('courses')
    .update({ activities_last_sync: new Date().toISOString() })
    .eq('id', course.id);

  log(`✅ Moodle sync completed!`);
}
