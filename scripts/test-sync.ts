#!/usr/bin/env tsx
/**
 * Test script for course syncing
 * Usage:
 *   npx tsx scripts/test-sync.ts --course-id 64
 *   npx tsx scripts/test-sync.ts --kid-id 3
 *   npx tsx scripts/test-sync.ts --all
 */

import { syncCourses } from '@/lib/sync/orchestrator';

interface SyncOptions {
  courseId?: number;
  kidId?: number;
  syncAll?: boolean;
  schoolYear?: string;
  calculateDates?: boolean;
}

async function testSync(options: SyncOptions) {
  console.log('🧪 Testing Course Sync');
  console.log('═══════════════════════════════════════\n');

  const startTime = Date.now();

  try {
    let courseIds: number[] = [];
    let kidId: number | undefined;

    if (options.courseId) {
      courseIds = [options.courseId];
      console.log(`📌 Testing single course: ${options.courseId}`);
    } else if (options.kidId) {
      kidId = options.kidId;
      console.log(`📌 Testing all courses for kid: ${options.kidId}`);
    } else if (options.syncAll) {
      console.log('📌 Testing sync for ALL courses');
    } else {
      console.log('❌ Error: Must specify --course-id, --kid-id, or --all');
      process.exit(1);
    }

    console.log(`📅 School Year: ${options.schoolYear || 'Current'}`);
    console.log(`📊 Calculate Dates: ${options.calculateDates !== false ? 'Yes' : 'No'}`);
    console.log('');

    // Run the sync
    await syncCourses({
      courseIds: courseIds.length > 0 ? courseIds : undefined,
      kidId,
      schoolYear: options.schoolYear,
      calculateDates: options.calculateDates !== false,
      onProgress: (message) => {
        console.log(message);
      },
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('');
    console.log('═══════════════════════════════════════');
    console.log(`✅ Test completed in ${elapsed}s`);
    console.log('═══════════════════════════════════════\n');

    // Summary
    console.log('📊 Test Summary:');
    console.log(`   Duration: ${elapsed}s`);
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
const options: SyncOptions = {};

for (let i = 0; i < args.length; i++) {
  const arg = args[i];

  switch (arg) {
    case '--course-id':
      options.courseId = parseInt(args[++i]);
      break;
    case '--kid-id':
      options.kidId = parseInt(args[++i]);
      break;
    case '--all':
      options.syncAll = true;
      break;
    case '--school-year':
      options.schoolYear = args[++i];
      break;
    case '--no-dates':
      options.calculateDates = false;
      break;
    case '--help':
    case '-h':
      console.log(`
Test Course Sync

Usage:
  npx tsx scripts/test-sync.ts [options]

Options:
  --course-id <id>     Test sync for a specific course
  --kid-id <id>        Test sync for all courses of a kid
  --all                Test sync for all courses
  --school-year <name> Filter by school year
  --no-dates           Skip plan date calculation
  -h, --help           Show this help

Examples:
  npx tsx scripts/test-sync.ts --course-id 64
  npx tsx scripts/test-sync.ts --kid-id 3 --school-year "2026-2027"
  npx tsx scripts/test-sync.ts --all --no-dates
      `);
      process.exit(0);
  }
}

// Run the test
testSync(options);
