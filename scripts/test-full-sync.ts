#!/usr/bin/env tsx
/**
 * Full integration test: Sync + Plan Dates
 * Usage:
 *   npx tsx scripts/test-full-sync.ts --course-id 64
 *   npx tsx scripts/test-full-sync.ts --kid-id 3
 */

import { syncCourses } from '@/lib/sync/orchestrator';
import { getServiceRoleClient } from '@/lib/supabase/service';

interface TestOptions {
  courseId?: number;
  kidId?: number;
  schoolYear?: string;
}

async function testFullSync(options: TestOptions) {
  console.log('🧪 Full Integration Test: Sync + Plan Dates');
  console.log('═══════════════════════════════════════\n');

  const startTime = Date.now();
  const supabase = getServiceRoleClient();

  try {
    let courseIds: number[] = [];
    let kidId: number | undefined;

    // Get course IDs to test
    if (options.courseId) {
      courseIds = [options.courseId];
      const { data: course } = await supabase
        .from('courses')
        .select('course_name, kid_id')
        .eq('id', options.courseId)
        .single();

      console.log(`📌 Testing course: ${course?.course_name || options.courseId}`);
      kidId = course?.kid_id;
    } else if (options.kidId) {
      kidId = options.kidId;
      const { data: courses } = await supabase
        .from('courses')
        .select('id, course_name')
        .eq('kid_id', options.kidId);

      courseIds = courses?.map(c => c.id) || [];
      console.log(`📌 Testing ${courseIds.length} courses for kid ${options.kidId}`);
    } else {
      console.log('❌ Error: Must specify --course-id or --kid-id');
      process.exit(1);
    }

    console.log(`📅 School Year: ${options.schoolYear || 'Current'}`);
    console.log('');

    // Get baseline metrics
    console.log('📊 Baseline Metrics:');
    const { data: beforeActivities } = await supabase
      .from('activities')
      .select('id, activity_type, is_action, plan_date')
      .in('course_id', courseIds);

    const beforeTotal = beforeActivities?.length || 0;
    const beforeModules = beforeActivities?.filter(a => a.activity_type === 'module').length || 0;
    const beforeAssignments = beforeActivities?.filter(a => a.is_action === true).length || 0;
    const beforeWithDates = beforeActivities?.filter(a => a.plan_date !== null).length || 0;

    console.log(`   Activities: ${beforeTotal}`);
    console.log(`   Modules: ${beforeModules}`);
    console.log(`   Assignments: ${beforeAssignments}`);
    console.log(`   With plan_date: ${beforeWithDates} (${Math.round((beforeWithDates / beforeTotal) * 100)}%)`);
    console.log('');

    // Step 1: Sync
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('STEP 1: Syncing from LMS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    await syncCourses({
      courseIds: courseIds.length > 0 ? courseIds : undefined,
      kidId,
      schoolYear: options.schoolYear,
      calculateDates: true, // Include plan date calculation
      onProgress: (message) => {
        console.log(message);
      },
    });

    // Get final metrics
    const { data: afterActivities } = await supabase
      .from('activities')
      .select('id, activity_type, is_action, plan_date, title')
      .in('course_id', courseIds);

    const afterTotal = afterActivities?.length || 0;
    const afterModules = afterActivities?.filter(a => a.activity_type === 'module').length || 0;
    const afterAssignments = afterActivities?.filter(a => a.is_action === true).length || 0;
    const afterWithDates = afterActivities?.filter(a => a.plan_date !== null).length || 0;

    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('FINAL METRICS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('📊 Activity Counts:');
    console.log(`   Total: ${beforeTotal} → ${afterTotal} (${afterTotal - beforeTotal > 0 ? '+' : ''}${afterTotal - beforeTotal})`);
    console.log(`   Modules: ${beforeModules} → ${afterModules} (${afterModules - beforeModules > 0 ? '+' : ''}${afterModules - beforeModules})`);
    console.log(`   Assignments: ${beforeAssignments} → ${afterAssignments} (${afterAssignments - beforeAssignments > 0 ? '+' : ''}${afterAssignments - beforeAssignments})`);
    console.log('');

    console.log('📅 Plan Date Coverage:');
    console.log(`   Before: ${beforeWithDates}/${beforeTotal} (${Math.round((beforeWithDates / beforeTotal) * 100)}%)`);
    console.log(`   After:  ${afterWithDates}/${afterTotal} (${Math.round((afterWithDates / afterTotal) * 100)}%)`);
    console.log(`   Change: ${afterWithDates - beforeWithDates > 0 ? '+' : ''}${afterWithDates - beforeWithDates} assignments`);
    console.log('');

    // Show assignments without dates (if any)
    const withoutDates = afterActivities?.filter(a => a.is_action === true && a.plan_date === null);
    if (withoutDates && withoutDates.length > 0) {
      console.log(`⚠️  Assignments still without plan_date: ${withoutDates.length}`);
      withoutDates.slice(0, 5).forEach(a => {
        console.log(`   - ${a.title}`);
      });
      if (withoutDates.length > 5) {
        console.log(`   ... and ${withoutDates.length - 5} more`);
      }
      console.log('');
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('═══════════════════════════════════════');
    console.log(`✅ Full test completed in ${elapsed}s`);
    console.log('═══════════════════════════════════════\n');

    // Final summary
    const successRate = Math.round((afterWithDates / afterTotal) * 100);
    console.log('📊 Test Summary:');
    console.log(`   Duration: ${elapsed}s`);
    console.log(`   Courses: ${courseIds.length}`);
    console.log(`   Activities Synced: ${afterTotal - beforeTotal > 0 ? '+' : ''}${afterTotal - beforeTotal}`);
    console.log(`   Plan Date Coverage: ${successRate}%`);
    console.log(`   Status: ${successRate >= 80 ? '✅ SUCCESS' : successRate >= 50 ? '⚠️  PARTIAL' : '❌ NEEDS ATTENTION'}`);

  } catch (error: any) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error('');
    console.error('═══════════════════════════════════════');
    console.error(`❌ Test failed after ${elapsed}s`);
    console.error('═══════════════════════════════════════\n');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const options: TestOptions = {};

for (let i = 0; i < args.length; i++) {
  const arg = args[i];

  switch (arg) {
    case '--course-id':
      options.courseId = parseInt(args[++i]);
      break;
    case '--kid-id':
      options.kidId = parseInt(args[++i]);
      break;
    case '--school-year':
      options.schoolYear = args[++i];
      break;
    case '--help':
    case '-h':
      console.log(`
Full Integration Test: Sync + Plan Dates

This test runs a complete sync from LMS and calculates plan dates,
then reports on the results.

Usage:
  npx tsx scripts/test-full-sync.ts [options]

Options:
  --course-id <id>     Test a specific course
  --kid-id <id>        Test all courses for a kid
  --school-year <name> Filter by school year
  -h, --help           Show this help

Examples:
  npx tsx scripts/test-full-sync.ts --course-id 64
  npx tsx scripts/test-full-sync.ts --kid-id 3
  npx tsx scripts/test-full-sync.ts --kid-id 3 --school-year "2026-2027"
      `);
      process.exit(0);
  }
}

// Run the test
testFullSync(options);
