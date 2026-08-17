#!/usr/bin/env node
/**
 * Canvas LMS Course Sync Script
 * Syncs Canvas course modules, workgroups, and assignments to the database
 *
 * Usage:
 *   node sync-canvas.mjs --course <course_id> [--mode all|incremental]
 *
 * Options:
 *   --course <id>    Course ID to sync
 *   --mode <mode>    Sync mode: 'all' (full sync) or 'incremental' (default)
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jfdrzjueqfxvozwcsyhm.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmZHJ6anVlcWZ4dm96d2NzeWhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDc4OTA4MCwiZXhwIjoyMDcwMzY1MDgwfQ.zJEJed2-6VPNjk2IM4xFZVU99lGdEeWfPZ5f0QVHmyc';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Parse command line arguments
const args = process.argv.slice(2);
const courseIdIndex = args.indexOf('--course');
const modeIndex = args.indexOf('--mode');

if (courseIdIndex === -1) {
  console.error('❌ Missing required --course argument');
  process.exit(1);
}

const courseId = parseInt(args[courseIdIndex + 1]);
const mode = modeIndex !== -1 ? args[modeIndex + 1] : 'incremental';

if (!['all', 'incremental'].includes(mode)) {
  console.error('❌ Invalid mode. Use "all" or "incremental"');
  process.exit(1);
}

const isIncremental = mode === 'incremental';

console.log(`🚀 Starting Canvas sync for course ${courseId} (${mode} mode)`);

/**
 * Get all pages from Canvas API (handles pagination)
 */
async function canvasFetchAll(url, token) {
  const items = [];
  let currentUrl = url;

  while (currentUrl) {
    const response = await fetch(currentUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Canvas API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    items.push(...data);

    // Check for next page in Link header
    const linkHeader = response.headers.get('Link');
    currentUrl = null;

    if (linkHeader) {
      const links = linkHeader.split(',');
      const nextLink = links.find(link => link.includes('rel="next"'));
      if (nextLink) {
        const match = nextLink.match(/<([^>]+)>/);
        if (match) {
          currentUrl = match[1];
        }
      }
    }
  }

  return items;
}

/**
 * Main sync function
 */
async function syncCourse() {
  try {
    // Get course details
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select(`
        id,
        course_name,
        lms_course_id,
        lms_account_id,
        kid_id,
        school_id,
        lms_synced_at,
        exclusion_patterns
      `)
      .eq('id', courseId)
      .single();

    if (courseError) throw courseError;
    if (!course) throw new Error(`Course ${courseId} not found`);

    console.log(`📚 Course: ${course.course_name}`);
    console.log(`   School ID: ${course.school_id}`);

    if (!course.lms_course_id) {
      console.error('❌ Course is not linked to a Canvas course. Please map it first.');
      process.exit(1);
    }

    // Get LMS account details
    const { data: lmsAccount, error: accountError } = await supabase
      .from('lms_accounts')
      .select('id, name, lms_url, api_token')
      .eq('id', course.lms_account_id)
      .single();

    if (accountError) throw accountError;
    if (!lmsAccount) throw new Error('LMS account not found');

    console.log(`🔗 Canvas URL: ${lmsAccount.lms_url}`);
    console.log(`📅 Last synced: ${course.lms_synced_at || 'Never'}`);

    const lastSyncTime = course.lms_synced_at ? new Date(course.lms_synced_at).getTime() : 0;
    const stats = { modules: { added: 0, updated: 0, skipped: 0 }, items: { added: 0, updated: 0, skipped: 0 } };

    // Fetch modules with items from Canvas
    const modulesUrl = `${lmsAccount.lms_url}/api/v1/courses/${course.lms_course_id}/modules?include[]=items`;
    console.log(`\n📡 Fetching modules from Canvas...`);

    const modules = await canvasFetchAll(modulesUrl, lmsAccount.api_token);
    console.log(`   Found ${modules.length} modules`);

    // Sync each module
    for (const module of modules) {
      try {
        await syncModule(course, module, lastSyncTime, isIncremental, stats);
      } catch (error) {
        console.error(`❌ Error syncing module "${module.name}":`, error.message);
      }
    }

    // Update last sync timestamp
    await supabase
      .from('courses')
      .update({ lms_synced_at: new Date().toISOString() })
      .eq('id', courseId);

    // Print summary
    console.log(`\n✅ Sync completed!`);
    console.log(`   Modules: ${stats.modules.added} added, ${stats.modules.updated} updated, ${stats.modules.skipped} skipped`);
    console.log(`   Items: ${stats.items.added} added, ${stats.items.updated} updated, ${stats.items.skipped} skipped`);

  } catch (error) {
    console.error(`\n❌ Sync failed:`, error.message);
    process.exit(1);
  }
}

/**
 * Helper to parse exclusion patterns robustly
 */
function getExclusionPatterns(exclusionConfig) {
  if (!exclusionConfig) return [];
  let raw = exclusionConfig;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = raw.split(',');
    }
  }
  if (Array.isArray(raw)) {
    return raw.map(p => String(p).trim().toLowerCase()).filter(Boolean);
  }
  return [];
}

/**
 * Helper function to handle upsert / timestamp checking efficiently
 */
async function upsertActivity(existingRecord, activityData, statsGroup, label, isIncremental, canvasRecord, lastSyncTime) {
  const updatedAt = canvasRecord.updated_at ? new Date(canvasRecord.updated_at).getTime() : null;
  const createdAt = canvasRecord.created_at ? new Date(canvasRecord.created_at).getTime() : null;

  const relevantCanvasTime = updatedAt || createdAt;
  const timeLabel = updatedAt ? 'updated_at' : (createdAt ? 'created_at (fallback)' : 'none');

  if (isIncremental) {
    console.log(`         ⏱️ [Incremental Check] ${label} "${activityData.title}" | Canvas ${timeLabel}: ${canvasRecord.updated_at || canvasRecord.created_at || 'N/A'}`);
  }

  if (isIncremental && existingRecord && relevantCanvasTime && relevantCanvasTime <= lastSyncTime) {
    statsGroup.skipped++;
    console.log(`         ⏭️ Skipped unchanged ${activityData.activity_type} (Timestamp older than last sync): ${activityData.title}`);
    return existingRecord.id;
  }

  if (existingRecord) {
    const isUnchanged =
      existingRecord.title === activityData.title &&
      existingRecord.activity_type === activityData.activity_type &&
      existingRecord.parent_activity_id === activityData.parent_activity_id &&
      existingRecord.lms_url === activityData.lms_url &&
      existingRecord.resource_url === activityData.resource_url &&
      existingRecord.position === activityData.position &&
      existingRecord.is_action_sync === activityData.is_action_sync;

    if (isIncremental && isUnchanged) {
      statsGroup.skipped++;
      console.log(`         ⏭️ Skipped unchanged ${activityData.activity_type} (Field match): ${activityData.title}`);
      return existingRecord.id;
    }

    activityData.item_needs_processing = true;

    await supabase
      .from('activities')
      .update(activityData)
      .eq('id', existingRecord.id);

    statsGroup.updated++;
    console.log(`         ✏️ Updated ${activityData.activity_type}: ${activityData.title}`);
    return existingRecord.id;
  } else {
    activityData.item_needs_processing = true;

    const { data, error } = await supabase
      .from('activities')
      .insert(activityData)
      .select('id')
      .single();

    if (error) throw error;
    statsGroup.added++;
    console.log(`         ➕ Added ${activityData.activity_type}: ${activityData.title}`);
    return data.id;
  }
}

/**
 * Sync a Canvas module
 */
async function syncModule(course, module, lastSyncTime, isIncremental, stats) {
  const lmsId = `canvas_module_${module.id}`;

  const { data: existingModule } = await supabase
    .from('activities')
    .select('id, title, activity_type, parent_activity_id, lms_url, resource_url, position, is_action_sync')
    .eq('lms_id', lmsId)
    .eq('course_id', course.id)
    .single();

  const moduleData = {
    title: module.name || `Module ${module.position}`,
    description: null,
    activity_type: 'module',
    course_id: course.id,
    kid_id: course.kid_id,
    parent_activity_id: null,
    lms_id: lmsId,
    lms_type: 'module',
    lms_source: 'canvas',
    position: module.position || 0,
    is_action_sync: false,
    lms_synced_at: new Date().toISOString()
  };

  const moduleDbId = await upsertActivity(
    existingModule,
    moduleData,
    stats.modules,
    'Module',
    isIncremental,
    module,
    lastSyncTime
  );

  // Sync module items
  if (module.items && module.items.length > 0) {
    console.log(`      📝 Syncing ${module.items.length} items...`);

    let currentWorkgroupId = null;

    for (const item of module.items) {
      try {
        const result = await syncModuleItem(course, moduleDbId, item, lastSyncTime, currentWorkgroupId, isIncremental, stats);

        if (item.type === 'SubHeader' && result) {
          currentWorkgroupId = result;
        }
      } catch (error) {
        console.error(`        ❌ Error syncing item "${item.title}":`, error.message);
      }
    }
  }
}

/**
 * Sync a Canvas module item
 */
async function syncModuleItem(course, moduleDbId, item, lastSyncTime, currentWorkgroupId, isIncremental, stats) {
  const lmsId = `canvas_item_${item.id}`;

  // Determine activity type and parent
  let activityType, parentActivityId;

  if (item.type === 'SubHeader') {
    activityType = 'workgroup';
    parentActivityId = moduleDbId;
  } else if (['Assignment', 'Discussion', 'Quiz'].includes(item.type)) {
    activityType = 'assignment';
    parentActivityId = currentWorkgroupId || moduleDbId;
  } else {
    activityType = 'resource';
    parentActivityId = currentWorkgroupId || moduleDbId;
  }

  // Determine actionability and exclusion patterns
  const title = item.title || 'Untitled';
  let isActionable = activityType === 'assignment';

  if (isActionable && course.exclusion_patterns) {
    const patterns = getExclusionPatterns(course.exclusion_patterns);
    const titleLower = title.toLowerCase();
    const matchesExclusion = patterns.some(pattern => pattern && titleLower.includes(pattern));

    if (matchesExclusion) {
      isActionable = false;
      console.log(`         ⊘ Excluded (non-actionable): ${title}`);
    }
  }

  // Check if item exists in DB
  const { data: existingItem } = await supabase
    .from('activities')
    .select('id, title, activity_type, parent_activity_id, lms_url, resource_url, position, is_action_sync')
    .eq('lms_id', lmsId)
    .eq('course_id', course.id)
    .single();

  const itemData = {
    title: title,
    description: null,
    activity_type: activityType,
    course_id: course.id,
    kid_id: course.kid_id,
    parent_activity_id: parentActivityId,
    lms_id: lmsId,
    lms_type: item.type.toLowerCase(),
    lms_source: 'canvas',
    lms_url: item.html_url || null,
    resource_url: item.external_url || null,
    position: item.position || 0,
    is_action_sync: isActionable,
    lms_synced_at: new Date().toISOString()
  };

  if (item.content_id) {
    itemData.lms_assignment_id = item.content_id.toString();
  }

  return await upsertActivity(
    existingItem,
    itemData,
    stats.items,
    'Item',
    isIncremental,
    item,
    lastSyncTime
  );
}

// Run the sync
syncCourse();