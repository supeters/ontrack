#!/usr/bin/env node

/**
 * CLI script for syncing courses
 *
 * Usage:
 *   npx tsx scripts/sync-courses.ts --kid-id 3
 *   npx tsx scripts/sync-courses.ts --course-id 59
 *   npx tsx scripts/sync-courses.ts --course-id 59 --school-year "2024-25"
 *   npx tsx scripts/sync-courses.ts --course-ids 59,60,61
 *   npx tsx scripts/sync-courses.ts --course-id 59
 *   npx tsx scripts/sync-courses.ts --kid-id 3 --no-calculate-dates
 */

import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

import { syncCourses } from '../lib/sync/orchestrator';

// Parse command line arguments
const args = process.argv.slice(2);

function getArg(flag: string): string | null {
  const index = args.indexOf(flag);
  return index !== -1 && args[index + 1] ? args[index + 1] : null;
}

function hasFlag(flag: string): boolean {
  return args.includes(flag);
}

const kidIdStr = getArg('--kid-id');
const courseIdStr = getArg('--course-id');
const courseIdsStr = getArg('--course-ids');
const schoolYear = getArg('--school-year');
const calculateDates = !hasFlag('--no-calculate-dates');

const kidId = kidIdStr ? parseInt(kidIdStr) : undefined;
const courseId = courseIdStr ? parseInt(courseIdStr) : undefined;
const courseIds = courseIdsStr ? courseIdsStr.split(',').map(id => parseInt(id.trim())) : undefined;

// Validate arguments
if (!kidId && !courseId && !courseIds) {
  console.error('❌ Must provide --kid-id, --course-id, or --course-ids');
  console.log('\nUsage:');
  console.log('  npx tsx scripts/sync-courses.ts --kid-id 3');
  console.log('  npx tsx scripts/sync-courses.ts --course-id 59');
  console.log('  npx tsx scripts/sync-courses.ts --course-ids 59,60,61');
  console.log('  npx tsx scripts/sync-courses.ts --course-id 59');
  console.log('  npx tsx scripts/sync-courses.ts --kid-id 3 --no-calculate-dates');
  process.exit(1);
}

// Run the sync
console.log('🚀 Sync Courses CLI');
console.log('════════════════════════════════════════');
console.log(`Calculate dates: ${calculateDates}`);
if (schoolYear) console.log(`School Year: ${schoolYear}`);
if (kidId) console.log(`Kid ID: ${kidId}`);
if (courseId) console.log(`Course ID: ${courseId}`);
if (courseIds) console.log(`Course IDs: ${courseIds.join(', ')}`);
console.log('════════════════════════════════════════\n');

syncCourses({
  kid_id: kidId,
  course_id: courseId,
  course_ids: courseIds,
  school_year: schoolYear || undefined,
  calculate_dates: calculateDates,
  onProgress: (message, data) => {
    // Strip ANSI codes and extra whitespace for cleaner output
    const cleanMessage = message.replace(/\n+$/, '');
    if (cleanMessage) {
      console.log(cleanMessage);
    }
  }
})
  .then((result) => {
    console.log('\n✅ Sync completed!');
    console.log(`Total: ${result.total}, Succeeded: ${result.succeeded}, Failed: ${result.failed}`);
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Sync failed:', error.message);
    console.error(error);
    process.exit(1);
  });
