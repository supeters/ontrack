#!/usr/bin/env tsx
/**
 * Extract real course data to use for test cases
 * This helps create realistic test scenarios based on actual data
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

import { getServiceRoleClient } from '@/lib/supabase/service';

async function extractTestData() {
  const supabase = getServiceRoleClient();

  console.log('🔍 Extracting test data from database...\n');

  // Get a School ID = 1 course (week-based)
  console.log('📚 Looking for School ID = 1 course (week-based)...');
  const { data: school1Courses, error: s1Error } = await supabase
    .from('courses')
    .select(`
      id,
      course_name,
      school_id,
      work_days,
      class_days,
      school_calendars!calendar_id (
        start_date,
        school_year_name
      )
    `)
    .eq('school_id', 1)
    .not('lms_course_id', 'is', null)
    .limit(5);

  if (s1Error) throw s1Error;

  console.log(`   Found ${school1Courses?.length || 0} courses:`);
  school1Courses?.forEach(c => {
    console.log(`   - ${c.course_name} (ID: ${c.id})`);
    console.log(`     work_days: ${c.work_days}, class_days: ${c.class_days}`);
  });

  // Get a School ID = 2 course (position-based)
  console.log('\n📚 Looking for School ID = 2 course (position-based)...');
  const { data: school2Courses, error: s2Error } = await supabase
    .from('courses')
    .select(`
      id,
      course_name,
      school_id,
      work_days,
      class_days,
      school_calendars!calendar_id (
        start_date,
        school_year_name
      )
    `)
    .eq('school_id', 2)
    .not('lms_course_id', 'is', null)
    .limit(5);

  if (s2Error) throw s2Error;

  console.log(`   Found ${school2Courses?.length || 0} courses:`);
  school2Courses?.forEach(c => {
    console.log(`   - ${c.course_name} (ID: ${c.id})`);
    console.log(`     work_days: ${c.work_days}, class_days: ${c.class_days}`);
  });

  // Use specific course IDs
  console.log('\n═══════════════════════════════════════');
  console.log('Extracting test data for specific courses:');
  console.log('═══════════════════════════════════════\n');

  const courseId1 = 52; // School 1 (week-based)
  const courseId2 = 45; // School 2 (position-based)

  console.log(`\n📋 Extracting School 1 course (ID: ${courseId1})`);
  await extractCourseData(courseId1, 'school1');

  console.log(`\n📋 Extracting School 2 course (ID: ${courseId2})`);
  await extractCourseData(courseId2, 'school2');

  console.log('\n✅ Test data extracted!');
  console.log('   Check the generated files in scripts/test-data/\n');
}

async function extractCourseData(courseId: number, label: string) {
  const supabase = getServiceRoleClient();

  // Get course details
  const { data: course } = await supabase
    .from('courses')
    .select(`
      id,
      course_name,
      school_id,
      work_days,
      class_days,
      lms_course_id,
      school_calendars!calendar_id (
        start_date,
        end_date,
        school_year_name
      )
    `)
    .eq('id', courseId)
    .single();

  if (!course) return;

  // Get activities (limit to first 2 weeks of modules)
  const { data: activities } = await supabase
    .from('activities')
    .select('id, title, activity_type, parent_activity_id, position, is_action, is_pinned, is_hidden, plan_date, lms_id')
    .eq('course_id', courseId)
    .order('position', { ascending: true })
    .limit(50);

  // Build test case structure
  const testCase = {
    name: `${course.school_id === 1 ? 'Week-based' : 'Position-based'}: ${course.course_name}`,
    description: `Real data from course ${courseId}. ${course.school_id === 1 ? 'Uses week pattern logic.' : 'Uses position-based logic.'}`,
    course: {
      id: courseId,
      course_name: course.course_name,
      school_id: course.school_id,
      work_days: course.work_days || '135',
      class_days: course.class_days || '13',
      school_calendars: Array.isArray(course.school_calendars)
        ? (course.school_calendars[0] ? { start_date: course.school_calendars[0].start_date, holidays: [] } : null)
        : { start_date: (course.school_calendars as any)?.start_date, holidays: [] }
    },
    activities: activities?.map(a => ({
      id: a.id,
      title: a.title,
      activity_type: a.activity_type,
      parent_activity_id: a.parent_activity_id,
      position: a.position,
      is_action: a.is_action,
      is_pinned: a.is_pinned,
      is_hidden: a.is_hidden,
      item_needs_processing: true,
      current_plan_date: a.plan_date, // What's currently in DB
      expected_plan_date: a.plan_date // Initially same, you can adjust manually
    }))
  };

  // Save to file
  const fs = require('fs');
  const path = require('path');

  const dir = path.join(process.cwd(), 'scripts', 'test-data');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const filename = path.join(dir, `${label}-course-${courseId}.json`);
  fs.writeFileSync(filename, JSON.stringify(testCase, null, 2));

  console.log(`   ✅ Saved to: ${filename}`);
  console.log(`   📊 Activities: ${activities?.length || 0}`);
  console.log(`      Modules: ${activities?.filter(a => a.activity_type === 'module').length || 0}`);
  console.log(`      Workgroups: ${activities?.filter(a => a.activity_type === 'workgroup').length || 0}`);
  console.log(`      Assignments: ${activities?.filter(a => a.is_action).length || 0}`);
}

// Run extraction
extractTestData().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
