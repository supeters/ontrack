#!/usr/bin/env node
/**
 * Canvas LMS Course Sync Script (BULK VERSION)
 * Syncs Canvas course modules, workgroups, and assignments using bulk upsert
 * Preserves user-entered data (completion status, actual time, overrides)
 *
 * Usage:
 *   node sync-canvas-bulk.mjs --course <course_id> [--mode all|incremental]
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

console.log(`🚀 Starting Canvas BULK sync for course ${courseId} (${mode} mode)`);

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
    const { data: lmsAccount, error: accountError} = await supabase
      .from('lms_accounts')
      .select('id, name, lms_url, api_token')
      .eq('id', course.lms_account_id)
      .single();

    if (accountError) throw accountError;
    if (!lmsAccount) throw new Error('LMS account not found');

    console.log(`🔗 Canvas URL: ${lmsAccount.lms_url}`);
    console.log(`📅 Last synced: ${course.lms_synced_at || 'Never'}`);

    const stats = { modules: { added: 0, updated: 0, skipped: 0 }, items: { added: 0, updated: 0, skipped: 0 } };

    // Fetch modules with items from Canvas
    const modulesUrl = `${lmsAccount.lms_url}/api/v1/courses/${course.lms_course_id}/modules?include[]=items`;
    console.log(`\n📡 Fetching modules from Canvas...`);

    const modules = await canvasFetchAll(modulesUrl, lmsAccount.api_token);
    console.log(`   Found ${modules.length} modules`);

    // Collect all sync records for bulk processing
    const moduleSyncRecords = [];
    const workgroupSyncRecords = [];
    const assignmentSyncRecords = [];

    console.log(`\n📦 Preparing bulk sync data...`);

    for (const module of modules) {
      try {
        // Prepare module sync record
        const moduleLmsId = `canvas_module_${module.id}`;
        moduleSyncRecords.push({
          lms_id: moduleLmsId,
          course_id: course.id,
          lms_source: 'canvas',
          title: module.name || `Module ${module.position}`,
          description: null,
          activity_type: 'module',
          kid_id: course.kid_id,
          parent_activity_id: null,
          module_id: null,
          lms_type: 'module',
          position: module.position || 0,
          is_action_sync: false,
          lms_synced_at: new Date().toISOString(),
          item_needs_processing: false
        });

        // Prepare item sync records - separate workgroups from assignments
        if (module.items && module.items.length > 0) {
          let currentWorkgroupLmsId = null;

          for (const item of module.items) {
            const itemLmsId = `canvas_item_${item.id}`;
            const title = item.title || 'Untitled';

            // Determine activity type
            let activityType;
            if (item.type === 'SubHeader') {
              activityType = 'workgroup';
              currentWorkgroupLmsId = itemLmsId;
            } else if (['Assignment', 'Discussion', 'Quiz'].includes(item.type)) {
              activityType = 'assignment';
            } else {
              activityType = 'resource';
            }

            // Check exclusion patterns
            let isActionable = activityType === 'assignment';
            if (isActionable && course.exclusion_patterns) {
              const patterns = getExclusionPatterns(course.exclusion_patterns);
              const titleLower = title.toLowerCase();
              const matchesExclusion = patterns.some(pattern => pattern && titleLower.includes(pattern));
              if (matchesExclusion) {
                isActionable = false;
                
              }
            }

            const itemRecord = {
              lms_id: itemLmsId,
              course_id: course.id,
              lms_source: 'canvas',
              title: title,
              description: null,
              activity_type: activityType,
              kid_id: course.kid_id,
              _parent_module_lms_id: moduleLmsId, // Temporary field to resolve later
              _parent_workgroup_lms_id: item.type === 'SubHeader' ? null : currentWorkgroupLmsId,
              lms_type: item.type.toLowerCase(),
              lms_url: item.html_url || null,
              resource_url: item.external_url || null,
              lms_assignment_id: item.content_id ? item.content_id.toString() : null,
              position: item.position || 0,
              is_action_sync: isActionable,
              lms_synced_at: new Date().toISOString(),
              item_needs_processing: activityType === 'assignment'
            };

            // Separate workgroups from assignments
            if (activityType === 'workgroup') {
              workgroupSyncRecords.push(itemRecord);
            } else {
              assignmentSyncRecords.push(itemRecord);
            }
          }
        }
      } catch (error) {
        console.error(`❌ Error preparing module "${module.name}":`, error.message);
      }
    }

    console.log(`   📊 Prepared ${moduleSyncRecords.length} modules, ${workgroupSyncRecords.length} workgroups, ${assignmentSyncRecords.length} assignments`);

    // Step 1: Bulk sync modules first
    console.log(`\n💾 Step 1: Syncing ${moduleSyncRecords.length} modules...`);
    const { data: moduleResults, error: moduleSyncError } = await supabase.rpc('safe_bulk_sync_upsert', {
      sync_records: moduleSyncRecords
    });

    if (moduleSyncError) {
      console.error('❌ Module sync error:', moduleSyncError);
      throw moduleSyncError;
    }

    // Build lms_id -> activity_id map for modules
    const lmsIdToActivityId = {};
    moduleResults.forEach(result => {
      if (result.activity_id) {
        lmsIdToActivityId[result.lms_id] = result.activity_id;
      }
    });

    const modInserted = moduleResults.filter(r => r.was_inserted).length;
    const modUpdated = moduleResults.filter(r => r.was_updated).length;
    const modUnchanged = moduleResults.filter(r => r.was_skipped).length;
    const modErrors = moduleResults.filter(r => r.error_message).length;

    stats.modules.added = modInserted;
    stats.modules.updated = modUpdated;
    stats.modules.skipped = modUnchanged;

    console.log(`   📊 Sent: ${moduleSyncRecords.length} → Inserted: ${modInserted}, Updated: ${modUpdated}, Unchanged: ${modUnchanged}`);

    if (modErrors > 0) {
      console.log(`   ⚠️  ${modErrors} errors`);
    }

    // Step 2: Sync workgroups
    console.log(`
💾 Step 2: Syncing ${workgroupSyncRecords.length} workgroups...`);

    // Resolve module_id and parent_activity_id for workgroups
    workgroupSyncRecords.forEach(item => {
      const moduleLmsId = item._parent_module_lms_id;

      // Workgroups parent to their module
      if (moduleLmsId && lmsIdToActivityId[moduleLmsId]) {
        item.parent_activity_id = lmsIdToActivityId[moduleLmsId];
        item.module_id = lmsIdToActivityId[moduleLmsId];
      } else {
        item.parent_activity_id = null;
        item.module_id = null;
      }

      delete item._parent_module_lms_id;
      delete item._parent_workgroup_lms_id;
    });

    const { data: workgroupResults, error: workgroupSyncError } = await supabase.rpc('safe_bulk_sync_upsert', {
      sync_records: workgroupSyncRecords
    });

    if (workgroupSyncError) {
      console.error('❌ Workgroup sync error:', workgroupSyncError);
      throw workgroupSyncError;
    }

    // Add workgroups to the lmsIdToActivityId map
    workgroupResults.forEach(result => {
      if (result.activity_id) {
        lmsIdToActivityId[result.lms_id] = result.activity_id;
      }
    });

    const wgInserted = workgroupResults.filter(r => r.was_inserted).length;
    const wgUpdated = workgroupResults.filter(r => r.was_updated).length;
    const wgUnchanged = workgroupResults.filter(r => r.was_skipped).length;
    const wgErrors = workgroupResults.filter(r => r.error_message).length;

    console.log(`   📊 Sent: ${workgroupSyncRecords.length} → Inserted: ${wgInserted}, Updated: ${wgUpdated}, Unchanged: ${wgUnchanged}`);

    if (wgErrors > 0) {
      console.log(`   ⚠️  ${wgErrors} errors`);
    }

    // Step 3: Sync assignments
    console.log(`
💾 Step 3: Syncing ${assignmentSyncRecords.length} assignments...`);

    // Resolve module_id and parent_activity_id for assignments
    assignmentSyncRecords.forEach(item => {
      const workgroupLmsId = item._parent_workgroup_lms_id;
      const moduleLmsId = item._parent_module_lms_id;

      // Assignments parent to workgroup (if exists) or module
      if (workgroupLmsId && lmsIdToActivityId[workgroupLmsId]) {
        item.parent_activity_id = lmsIdToActivityId[workgroupLmsId];
      } else if (moduleLmsId && lmsIdToActivityId[moduleLmsId]) {
        item.parent_activity_id = lmsIdToActivityId[moduleLmsId];
      } else {
        item.parent_activity_id = null;
      }

      // All assignments have module_id
      if (moduleLmsId && lmsIdToActivityId[moduleLmsId]) {
        item.module_id = lmsIdToActivityId[moduleLmsId];
      } else {
        item.module_id = null;
      }

      delete item._parent_module_lms_id;
      delete item._parent_workgroup_lms_id;
    });

    const { data: assignmentResults, error: assignmentSyncError } = await supabase.rpc('safe_bulk_sync_upsert', {
      sync_records: assignmentSyncRecords
    });

    if (assignmentSyncError) {
      console.error('❌ Assignment sync error:', assignmentSyncError);
      throw assignmentSyncError;
    }

    const asgInserted = assignmentResults.filter(r => r.was_inserted).length;
    const asgUpdated = assignmentResults.filter(r => r.was_updated).length;
    const asgUnchanged = assignmentResults.filter(r => r.was_skipped).length;
    const asgErrors = assignmentResults.filter(r => r.error_message).length;

    stats.items.added = asgInserted + wgInserted;
    stats.items.updated = asgUpdated + wgUpdated;
    stats.items.skipped = asgUnchanged + wgUnchanged;

    console.log(`   📊 Sent: ${assignmentSyncRecords.length} → Inserted: ${asgInserted}, Updated: ${asgUpdated}, Unchanged: ${asgUnchanged}`);

    if (asgErrors > 0) {
      console.log(`   ⚠️  ${asgErrors} errors:`);
      assignmentResults.filter(r => r.error_message).forEach(r => {
        console.log(`      - ${r.lms_id}: ${r.error_message}`);
      });
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
    console.error(error);
    process.exit(1);
  }
}

// Run the sync
syncCourse();
