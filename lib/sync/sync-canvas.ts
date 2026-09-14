import { getServiceRoleClient } from '@/lib/supabase/service';

export interface CanvasSyncParams {
  courseId: number;
  onProgress?: (message: string) => void;
}

/**
 * Get all pages from Canvas API (handles pagination)
 */
async function canvasFetchAll(url: string, token: string): Promise<any[]> {
  const items = [];
  let currentUrl: string | null = url;

  while (currentUrl) {
    const response: Response = await fetch(currentUrl, {
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
function getExclusionPatterns(exclusionConfig: any): string[] {
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
 * Sync Canvas course modules, workgroups, and assignments
 */
export async function syncCanvasCourse(params: CanvasSyncParams): Promise<void> {
  const { courseId, onProgress } = params;

  const log = (message: string) => {
    console.log(message);
    if (onProgress) {
      onProgress(message);
    }
  };

  const supabase = getServiceRoleClient();

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

  log(`📚 Course: ${course.course_name}`);

  if (!course.lms_course_id) {
    throw new Error('Course is not linked to a Canvas course. Please map it first.');
  }

  // Get LMS account details
  const { data: lmsAccount, error: accountError } = await supabase
    .from('lms_accounts')
    .select('id, name, lms_url, api_token')
    .eq('id', course.lms_account_id)
    .single();

  if (accountError) throw accountError;
  if (!lmsAccount) throw new Error('LMS account not found');

  log(`📡 Fetching modules from Canvas...`);

  // Fetch modules with items from Canvas
  const modulesUrl = `${lmsAccount.lms_url}/api/v1/courses/${course.lms_course_id}/modules?include[]=items`;
  const modules = await canvasFetchAll(modulesUrl, lmsAccount.api_token);
  log(`   Found ${modules.length} modules`);

  // Collect all sync records for bulk processing
  const moduleSyncRecords = [];
  const workgroupSyncRecords = [];
  const assignmentSyncRecords = [];

  // Track all assignment occurrences with their context (for priority-based duplicate detection)
  const assignmentOccurrences = new Map<string, Array<{
    itemLmsId: string;
    workgroupTitle: string | null;
    moduleTitle: string;
    position: number;
    isSpecialReading: boolean;
  }>>();
  // Track all lms_id values we sync (for deletion detection)
  const syncedLmsIds = new Set<string>();


  log(`📦 Preparing bulk sync data...`);

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
        lms_url: null,
        resource_url: null,
        position: module.position || 0,
        is_action_sync: false,
        is_hidden: false,
        lms_synced_at: new Date().toISOString(),
      });
      syncedLmsIds.add(moduleLmsId);

      // Prepare item sync records - separate workgroups from assignments
      if (module.items && module.items.length > 0) {
        let currentWorkgroupLmsId = null;
        let currentWorkgroupTitle: string | null = null;

        for (const item of module.items) {
          const itemLmsId = `canvas_item_${item.id}`;
          const title = item.title || 'Untitled';

          // Determine activity type
          let activityType;
          let isSpecialReadingAssignment = false;

          if (item.type === 'SubHeader') {
            // Special handling for course_id 63: SubHeaders starting with "Read" are assignments
            if (course.id === 63 && title.toLowerCase().startsWith('read')) {
              activityType = 'assignment';
              isSpecialReadingAssignment = true;
              // Do NOT update currentWorkgroupLmsId - this is an assignment, not a workgroup
            } else {
              activityType = 'workgroup';
              currentWorkgroupLmsId = itemLmsId;
              currentWorkgroupTitle = title;
            }
          } else if (['Assignment', 'Discussion', 'Quiz'].includes(item.type)) {
            activityType = 'assignment';
          } else {
            activityType = 'resource';
          }

          // Track assignment occurrences for priority-based duplicate detection
          // We'll determine which occurrence is actionable after collecting all of them
          let isActionable = activityType === 'assignment';

          if (isActionable && item.content_id) {
            const assignmentId = item.content_id.toString();

            if (!assignmentOccurrences.has(assignmentId)) {
              assignmentOccurrences.set(assignmentId, []);
            }

            assignmentOccurrences.get(assignmentId)!.push({
              itemLmsId,
              workgroupTitle: currentWorkgroupTitle,
              moduleTitle: module.name || `Module ${module.position}`,
              position: item.position || 0,
              isSpecialReading: isSpecialReadingAssignment,
            });

            // Temporarily mark all as actionable - we'll adjust this after processing all items
            isActionable = true;
          }

          // Check exclusion patterns
          if (isActionable && course.exclusion_patterns) {
            const patterns = getExclusionPatterns(course.exclusion_patterns);
            const titleLower = title.toLowerCase();
            const matchesExclusion = patterns.some(pattern => pattern && titleLower.includes(pattern));
            if (matchesExclusion) {
              isActionable = false;
            }
          }

          const itemRecord: any = {
            lms_id: itemLmsId,
            course_id: course.id,
            lms_source: 'canvas',
            title: title,
            description: null,
            activity_type: activityType,
            kid_id: course.kid_id,
            _parent_module_lms_id: moduleLmsId,
            // Special reading assignments in course 63 should be assigned to the current workgroup
            // Regular SubHeaders (workgroups) should have null parent
            _parent_workgroup_lms_id: isSpecialReadingAssignment ? currentWorkgroupLmsId : (item.type === 'SubHeader' ? null : currentWorkgroupLmsId),
            lms_type: item.type.toLowerCase(),
            lms_url: item.html_url || null,
            resource_url: item.external_url || null,
            lms_assignment_id: item.content_id ? item.content_id.toString() : null,
            position: item.position || 0,
            is_action_sync: isActionable,
            lms_synced_at: new Date().toISOString(),
          };

          // Track this lms_id
          syncedLmsIds.add(itemLmsId);

          // Separate workgroups from assignments
          if (activityType === 'workgroup') {
            workgroupSyncRecords.push(itemRecord);
          } else {
            assignmentSyncRecords.push(itemRecord);
          }
        }
      }
    } catch (error: any) {
      log(`❌ Error preparing module "${module.name}": ${error.message}`);
    }
  }

  log(`   📊 Prepared ${moduleSyncRecords.length} modules, ${workgroupSyncRecords.length} workgroups, ${assignmentSyncRecords.length} assignments`);

  // Apply priority-based duplicate resolution
  log(`🔍 Resolving duplicate assignments using workgroup priority...`);
  const duplicateCount = resolveDuplicateAssignments(assignmentOccurrences, assignmentSyncRecords);
  if (duplicateCount > 0) {
    log(`   ✅ Resolved ${duplicateCount} duplicate assignments`);
  }

  // Step 1: Bulk sync modules first
  log(`💾 Step 1: Syncing ${moduleSyncRecords.length} modules...`);
  const { data: moduleResults, error: moduleSyncError } = await supabase.rpc('safe_bulk_sync_upsert', {
    sync_records: moduleSyncRecords
  });

  if (moduleSyncError) {
    throw new Error(`Module sync error: ${moduleSyncError.message}`);
  }

  // Build lms_id -> activity_id map for modules
  const lmsIdToActivityId: Record<string, number> = {};
  moduleResults.forEach((result: any) => {
    if (result.activity_id) {
      lmsIdToActivityId[result.lms_id] = result.activity_id;
    }
  });

  const modInserted = moduleResults.filter((r: any) => r.was_inserted).length;
  const modUpdated = moduleResults.filter((r: any) => r.was_updated).length;
  const modUnchanged = moduleResults.filter((r: any) => r.was_skipped).length;

  log(`   📊 Inserted: ${modInserted}, Updated: ${modUpdated}, Unchanged: ${modUnchanged}`);

  // Step 2: Sync workgroups
  log(`💾 Step 2: Syncing ${workgroupSyncRecords.length} workgroups...`);

  // Resolve module_id and parent_activity_id for workgroups
  workgroupSyncRecords.forEach(item => {
    const moduleLmsId = item._parent_module_lms_id;

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
    throw new Error(`Workgroup sync error: ${workgroupSyncError.message}`);
  }

  // Add workgroups to the lmsIdToActivityId map
  workgroupResults.forEach((result: any) => {
    if (result.activity_id) {
      lmsIdToActivityId[result.lms_id] = result.activity_id;
    }
  });

  const wgInserted = workgroupResults.filter((r: any) => r.was_inserted).length;
  const wgUpdated = workgroupResults.filter((r: any) => r.was_updated).length;
  const wgUnchanged = workgroupResults.filter((r: any) => r.was_skipped).length;

  log(`   📊 Inserted: ${wgInserted}, Updated: ${wgUpdated}, Unchanged: ${wgUnchanged}`);

  // Step 3: Sync assignments
  log(`💾 Step 3: Syncing ${assignmentSyncRecords.length} assignments...`);

  // Resolve module_id and parent_activity_id for assignments
  assignmentSyncRecords.forEach(item => {
    const workgroupLmsId = item._parent_workgroup_lms_id;
    const moduleLmsId = item._parent_module_lms_id;

    if (workgroupLmsId && lmsIdToActivityId[workgroupLmsId]) {
      item.parent_activity_id = lmsIdToActivityId[workgroupLmsId];
    } else if (moduleLmsId && lmsIdToActivityId[moduleLmsId]) {
      item.parent_activity_id = lmsIdToActivityId[moduleLmsId];
    } else {
      item.parent_activity_id = null;
    }

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
    throw new Error(`Assignment sync error: ${assignmentSyncError.message}`);
  }

  const asgInserted = assignmentResults.filter((r: any) => r.was_inserted).length;
  const asgUpdated = assignmentResults.filter((r: any) => r.was_updated).length;
  const asgUnchanged = assignmentResults.filter((r: any) => r.was_skipped).length;

  log(`   📊 Inserted: ${asgInserted}, Updated: ${asgUpdated}, Unchanged: ${asgUnchanged}`);

  // Step 4: Handle deletions - soft delete items that weren't in the sync
  log(`🗑️  Step 4: Processing deletions...`);

  const syncedLmsIdsArray = Array.from(syncedLmsIds);
  const { data: deletedItems, error: deleteError } = await supabase
    .from('activities')
    .update({ is_deleted: true })
    .eq('course_id', courseId)
    .eq('lms_source', 'canvas')
    .eq('is_deleted', false)
    .not('lms_id', 'in', `(${syncedLmsIdsArray.map(id => `"${id}"`).join(',')})`)
    .select('id, title');

  if (deleteError) {
    log(`   ⚠️  Warning: Could not process deletions: ${deleteError.message}`);
  } else {
    const deletedCount = deletedItems?.length || 0;
    if (deletedCount > 0) {
      log(`   📊 Soft-deleted ${deletedCount} items removed from Canvas`);
    } else {
      log(`   📊 No items to delete`);
    }
  }

  // Step 5: Sync grades and teacher comments
  log(`📊 Syncing grades and teacher comments...`);
  try {
    const gradesUrl = `${lmsAccount.lms_url}/api/v1/courses/${course.lms_course_id}/assignments?include[]=submission&include[]=submission_comments&per_page=100`;
    const assignments = await canvasFetchAll(gradesUrl, lmsAccount.api_token);

    const gradeRecords = [];

    for (const assignment of assignments) {
      if (assignment.submission) {
        const submission = assignment.submission;

        gradeRecords.push({
          lms_assignment_id: assignment.id.toString(),
          kid_id: course.kid_id,
          course_id: course.id,
          lms_source: 'canvas',

          // Submission info
          submitted_at: submission.submitted_at,
          submission_type: submission.submission_type,
          workflow_state: submission.workflow_state,
          submission_url: submission.preview_url || submission.url || null,

          // Grade info
          score: submission.score,
          grade: submission.grade,
          graded_at: submission.graded_at,

          // Status
          late: submission.late || false,
          missing: submission.missing || false,
          needs_grading: submission.workflow_state === 'submitted' && !submission.graded_at,

          // Comments and rubric from teacher - handle both locations
          submission_comments: submission.submission_comments || assignment.submission_comments || null,
          rubric_assessment: submission.rubric_assessment || null,

          // LMS data
          lms_submission_id: submission.id?.toString(),
          lms_grade_data: {
            canvas_submission_id: submission.id,
            grade_matches_current_submission: submission.grade_matches_current_submission,
            points_possible: assignment.points_possible,
            excused: submission.excused,
            attempt: submission.attempt,
            assignment_name: assignment.name,
            due_at: assignment.due_at
          },

          last_sync_date: new Date().toISOString()
        });
      }
    }

    log(`   📊 Prepared ${gradeRecords.length} grade records`);

    if (gradeRecords.length > 0) {
      // Bulk upsert grades
      const { data: gradeResults, error: gradeError } = await supabase.rpc('safe_bulk_grade_upsert', {
        grade_records: gradeRecords
      });

      if (gradeError) {
        log(`   ⚠️  Grade sync error: ${gradeError.message}`);
      } else if (gradeResults) {
        const inserted = gradeResults.filter((r: any) => r.was_inserted).length;
        const updated = gradeResults.filter((r: any) => r.was_updated).length;
        const errors = gradeResults.filter((r: any) => r.error_message).length;

        log(`   ✅ Grades: ${inserted} inserted, ${updated} updated`);

        if (errors > 0) {
          log(`   ⚠️  ${errors} grade(s) had errors:`);
          gradeResults
            .filter((r: any) => r.error_message)
            .forEach((r: any) => {
              log(`      Assignment ${r.lms_assignment_id}: ${r.error_message}`);
            });
        }
      }
    }
  } catch (gradeError: any) {
    log(`   ⚠️  Grade sync failed: ${gradeError.message}`);
    // Continue - don't fail the whole sync if grades fail
  }

  // Update last sync timestamp
  await supabase
    .from('courses')
    .update({ lms_synced_at: new Date().toISOString() })
    .eq('id', courseId);

  log(`✅ Canvas sync completed!`);
}

/**
 * Resolve duplicate assignments using workgroup priority
 * Returns the number of duplicates resolved
 */
function resolveDuplicateAssignments(
  assignmentOccurrences: Map<string, Array<{
    itemLmsId: string;
    workgroupTitle: string | null;
    moduleTitle: string;
    position: number;
    isSpecialReading: boolean;
  }>>,
  assignmentSyncRecords: any[]
): number {
  let duplicatesResolved = 0;

  // Workgroup priority ranking (higher = better priority)
  const getWorkgroupPriority = (workgroupTitle: string | null): number => {
    if (!workgroupTitle) return 50; // No workgroup = medium priority (module-level assignment)

    const titleLower = workgroupTitle.toLowerCase();

    // Highest priority: actual work sections
    if (titleLower.includes('due day 1')) return 100;
    if (titleLower.includes('due day 2')) return 95;
    if (titleLower.startsWith('due ')) return 90;
    if (titleLower.includes('end of') && titleLower.includes('week')) return 85;
    if (titleLower.includes('end of') && titleLower.includes('work')) return 85;

    // Low priority: preview/reference sections
    if (titleLower.includes('looking ahead')) return 10;
    if (titleLower.includes('look ahead')) return 10;
    if (titleLower.includes('helpful resource')) return 5;
    if (titleLower.includes('resources')) return 5;

    // Medium priority: everything else
    return 50;
  };

  // Process each assignment that has duplicates
  for (const [assignmentId, occurrences] of Array.from(assignmentOccurrences.entries())) {
    if (occurrences.length <= 1) continue; // Not a duplicate

    duplicatesResolved++;

    // Special reading assignments (course 63) are always actionable - skip priority logic
    if (occurrences.some(occ => occ.isSpecialReading)) {
      continue;
    }

    // Find the highest-priority occurrence
    let bestOccurrence = occurrences[0];
    let bestPriority = getWorkgroupPriority(bestOccurrence.workgroupTitle);

    for (const occurrence of occurrences) {
      const priority = getWorkgroupPriority(occurrence.workgroupTitle);

      if (priority > bestPriority) {
        bestOccurrence = occurrence;
        bestPriority = priority;
      } else if (priority === bestPriority && occurrence.position < bestOccurrence.position) {
        // Same priority, prefer earlier position
        bestOccurrence = occurrence;
      }
    }

    // Mark only the best occurrence as actionable
    for (const record of assignmentSyncRecords) {
      if (occurrences.some(occ => occ.itemLmsId === record.lms_id)) {
        // This is one of the duplicate occurrences
        record.is_action_sync = (record.lms_id === bestOccurrence.itemLmsId);
      }
    }
  }

  return duplicatesResolved;
}
