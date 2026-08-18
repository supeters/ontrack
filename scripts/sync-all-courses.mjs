#!/usr/bin/env node
/**
 * Sync All Courses Script
 * Finds all courses for the current school year with LMS mappings and syncs them
 *
 * Usage:
 *   node scripts/sync-all-courses.mjs [--year 2026-27] [--mode incremental|all]
 *
 * Options:
 *   --year <year>    School year (default: current year from env or 2026-27)
 *   --mode <mode>    Sync mode: 'incremental' or 'all' (default: incremental)
 */

import { createClient } from '@supabase/supabase-js';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SUPABASE_URL = 'https://jfdrzjueqfxvozwcsyhm.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmZHJ6anVlcWZ4dm96d2NzeWhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDc4OTA4MCwiZXhwIjoyMDcwMzY1MDgwfQ.zJEJed2-6VPNjk2IM4xFZVU99lGdEeWfPZ5f0QVHmyc';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Parse command line arguments
const args = process.argv.slice(2);
const yearIndex = args.indexOf('--year');
const modeIndex = args.indexOf('--mode');

const SCHOOL_YEAR = yearIndex !== -1 ? args[yearIndex + 1] : '2026-27';
const SYNC_MODE = modeIndex !== -1 ? args[modeIndex + 1] : 'incremental';

if (!['incremental', 'all'].includes(SYNC_MODE)) {
  console.error('❌ Invalid mode. Use "incremental" or "all"');
  process.exit(1);
}

console.log(`🚀 Syncing all courses for ${SCHOOL_YEAR} (${SYNC_MODE} mode)\n`);

/**
 * Run a script as a child process and stream output
 */
function runScript(scriptPath, args) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [scriptPath, ...args], {
      cwd: path.join(__dirname, '..')
    });

    child.stdout.on('data', (data) => {
      process.stdout.write(data.toString());
    });

    child.stderr.on('data', (data) => {
      process.stderr.write(data.toString());
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Script exited with code ${code}`));
      }
    });
  });
}

/**
 * Main execution
 */
async function main() {
  try {
    // Get all courses for the school year with LMS mappings
    const { data: courses, error: coursesError } = await supabase
      .from('courses')
      .select(`
        id,
        course_name,
        school_id,
        calendar_id,
        lms_account_id,
        lms_course_id,
        source_type,
        schools!school_id (
          id,
          name
        ),
        school_calendars!calendar_id (
          school_year_name
        )
      `)
      .not('lms_account_id', 'is', null)
      .not('lms_course_id', 'is', null)
      .order('school_id')
      .order('course_name');

    if (coursesError) throw coursesError;

    // Filter by school_year_name
    const filteredCourses = courses?.filter(c =>
      c.school_calendars?.school_year_name === SCHOOL_YEAR
    ) || [];

    if (filteredCourses.length === 0) {
      console.log(`📭 No courses found for ${SCHOOL_YEAR} with LMS mappings`);
      return;
    }

    console.log(`📚 Found ${filteredCourses.length} courses to sync:
`);


    // Group by school
    const coursesBySchool = filteredCourses.reduce((acc, course) => {
      const schoolName = course.schools?.name || `School ${course.school_id}`;
      if (!acc[schoolName]) {
        acc[schoolName] = [];
      }
      acc[schoolName].push(course);
      return acc;
    }, {});

    // Print summary
    for (const [schoolName, schoolCourses] of Object.entries(coursesBySchool)) {
      console.log(`   ${schoolName}: ${schoolCourses.length} courses`);
      schoolCourses.forEach(c => {
        console.log(`      - ${c.course_name} (${c.source_type?.toUpperCase() || 'unknown'})`);
      });
      console.log('');
    }

    const stats = {
      total: filteredCourses.length,
      succeeded: 0,
      failed: 0,
      errors: []
    };

    // Sync each course
    for (const course of filteredCourses) {
      console.log(`\n${'═'.repeat(80)}`);
      console.log(`📚 Syncing: ${course.course_name} (ID: ${course.id})`);
      console.log(`   School: ${course.schools?.name || course.school_id}`);
      console.log(`   LMS: ${course.source_type?.toUpperCase() || 'unknown'}`);
      console.log(`${'═'.repeat(80)}\n`);

      try {
        // Determine which sync script to use based on source_type
        const syncScript = course.school_id === 1
          ? 'sync-canvas-bulk.mjs'
          : 'sync-course-modules.mjs';

        const syncScriptPath = path.join(__dirname, syncScript);

        // Run sync script
        await runScript(syncScriptPath, [
          '--course', course.id.toString(),
          '--mode', SYNC_MODE
        ]);

        // Run plan date calculation
        const planScriptPath = path.join(__dirname, 'calculate-plan-dates-v2.mjs');
        const planArgs = ['--course', course.id.toString()];
        if (SYNC_MODE === 'incremental') {
          planArgs.push('--incremental');
        }

        console.log(`\n📅 Calculating plan dates...\n`);
        await runScript(planScriptPath, planArgs);

        stats.succeeded++;
        console.log(`\n✅ Successfully synced ${course.course_name}\n`);

      } catch (error) {
        stats.failed++;
        stats.errors.push({ course: course.course_name, error: error.message });
        console.error(`\n❌ Failed to sync ${course.course_name}: ${error.message}\n`);
      }
    }

    // Print final summary
    console.log(`\n${'═'.repeat(80)}`);
    console.log(`📊 SYNC SUMMARY`);
    console.log(`${'═'.repeat(80)}`);
    console.log(`Total courses: ${stats.total}`);
    console.log(`✅ Succeeded: ${stats.succeeded}`);
    console.log(`❌ Failed: ${stats.failed}`);

    if (stats.errors.length > 0) {
      console.log(`\nErrors:`);
      stats.errors.forEach(e => {
        console.log(`   - ${e.course}: ${e.error}`);
      });
    }

    console.log(`${'═'.repeat(80)}\n`);

    if (stats.failed > 0) {
      process.exit(1);
    }

  } catch (error) {
    console.error(`\n❌ Sync failed:`, error.message);
    process.exit(1);
  }
}

main();
