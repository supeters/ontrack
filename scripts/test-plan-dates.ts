#!/usr/bin/env tsx
/**
 * Test script for plan date calculation
 * Usage:
 *   npx tsx scripts/test-plan-dates.ts --course-id 64
 *   npx tsx scripts/test-plan-dates.ts --kid-id 3
 */

import { calculatePlanDates } from '@/lib/sync/calculate-dates';
import { getServiceRoleClient } from '@/lib/supabase/service';

interface TestOptions {
  courseId?: number;
  kidId?: number;
}

async function testPlanDates(options: TestOptions) {
  console.log('🧪 Testing Plan Date Calculation');
  console.log('═══════════════════════════════════════\n');

  const startTime = Date.now();
  const supabase = getServiceRoleClient();

  try {
    let courseIds: number[] = [];

    // Get course IDs to test
    if (options.courseId) {
      courseIds = [options.courseId];
      console.log(`📌 Testing course: ${options.courseId}`);
    } else if (options.kidId) {
      console.log(`📌 Getting all courses for kid: ${options.kidId}`);
      const { data: courses, error } = await supabase
        .from('courses')
        .select('id, course_name')
        .eq('kid_id', options.kidId);

      if (error) throw error;
      if (!courses || courses.length === 0) {
        throw new Error(`No courses found for kid ${options.kidId}`);
      }

      courseIds = courses.map(c => c.id);
      console.log(`   Found ${courses.length} courses:`);
      courses.forEach(c => console.log(`   - ${c.course_name} (ID: ${c.id})`));
    } else {
      console.log('❌ Error: Must specify --course-id or --kid-id');
      process.exit(1);
    }

    console.log('');

    // Get activities BEFORE calculation
    const { data: beforeActivities } = await supabase
      .from('activities')
      .select('id, title, plan_date, activity_type, is_action')
      .in('course_id', courseIds)
      .order('course_id', { ascending: true })
      .order('position', { ascending: true });

    const beforeWithDates = beforeActivities?.filter(a => a.plan_date !== null).length || 0;
    const beforeModules = beforeActivities?.filter(a => a.activity_type === 'module').length || 0;
    const beforeAssignments = beforeActivities?.filter(a => a.is_action === true).length || 0;

    console.log('📊 Before Calculation:');
    console.log(`   Total Activities: ${beforeActivities?.length || 0}`);
    console.log(`   Modules: ${beforeModules}`);
    console.log(`   Assignments: ${beforeAssignments}`);
    console.log(`   With plan_date: ${beforeWithDates}`);
    console.log('');

    // Run calculation
    console.log('🔄 Running plan date calculation...\n');
    await calculatePlanDates({
      courseIds,
      onProgress: (message) => {
        console.log(message);
      },
    });

    // Get activities AFTER calculation
    const { data: afterActivities } = await supabase
      .from('activities')
      .select('id, title, plan_date, activity_type, is_action, parent_activity_id')
      .in('course_id', courseIds)
      .order('course_id', { ascending: true })
      .order('plan_date', { ascending: true, nullsFirst: false });

    const afterWithDates = afterActivities?.filter(a => a.plan_date !== null).length || 0;
    const afterModulesWithDates = afterActivities?.filter(a => a.activity_type === 'module' && a.plan_date !== null).length || 0;
    const afterAssignmentsWithDates = afterActivities?.filter(a => a.is_action === true && a.plan_date !== null).length || 0;

    console.log('');
    console.log('📊 After Calculation:');
    console.log(`   Total with plan_date: ${afterWithDates} (was ${beforeWithDates})`);
    console.log(`   Modules with dates: ${afterModulesWithDates}`);
    console.log(`   Assignments with dates: ${afterAssignmentsWithDates}`);
    console.log(`   Changed: ${afterWithDates - beforeWithDates > 0 ? '+' : ''}${afterWithDates - beforeWithDates}`);

    // Show sample of assigned dates
    console.log('');
    console.log('📅 Sample Assigned Dates:');
    const sampleActivities = afterActivities
      ?.filter(a => a.plan_date !== null)
      .slice(0, 10);

    sampleActivities?.forEach(a => {
      const type = a.activity_type === 'module' ? '📁' : a.is_action ? '📝' : '📄';
      console.log(`   ${type} ${a.title.substring(0, 50).padEnd(50)} → ${a.plan_date}`);
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('');
    console.log('═══════════════════════════════════════');
    console.log(`✅ Test completed in ${elapsed}s`);
    console.log('═══════════════════════════════════════\n');

    // Summary
    console.log('📊 Test Summary:');
    console.log(`   Duration: ${elapsed}s`);
    console.log(`   Courses Tested: ${courseIds.length}`);
    console.log(`   Dates Assigned: ${afterWithDates - beforeWithDates > 0 ? '+' : ''}${afterWithDates - beforeWithDates}`);
    console.log(`   Final Coverage: ${afterWithDates}/${beforeActivities?.length} (${Math.round((afterWithDates / (beforeActivities?.length || 1)) * 100)}%)`);
    console.log(`   Status: SUCCESS`);

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
    case '--help':
    case '-h':
      console.log(`
Test Plan Date Calculation

Usage:
  npx tsx scripts/test-plan-dates.ts [options]

Options:
  --course-id <id>     Test plan dates for a specific course
  --kid-id <id>        Test plan dates for all courses of a kid
  -h, --help           Show this help

Examples:
  npx tsx scripts/test-plan-dates.ts --course-id 64
  npx tsx scripts/test-plan-dates.ts --kid-id 3
      `);
      process.exit(0);
  }
}

// Run the test
testPlanDates(options);
