#!/usr/bin/env node

/**
 * CLI script for calculating dates only (no sync)
 *
 * Usage:
 *   npx tsx scripts/calculate-dates-only.ts --course-id 51
 */

import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

import { calculatePlanDates } from '../lib/sync/calculate-dates';

// Parse command line arguments
const args = process.argv.slice(2);

function getArg(flag: string): string | null {
  const index = args.indexOf(flag);
  return index !== -1 && args[index + 1] ? args[index + 1] : null;
}

const courseIdStr = getArg('--course-id');
const courseIdsStr = getArg('--course-ids');

const courseId = courseIdStr ? parseInt(courseIdStr) : undefined;
const courseIds = courseIdsStr ? courseIdsStr.split(',').map(id => parseInt(id.trim())) : undefined;

// Validate arguments
if (!courseId && !courseIds) {
  console.error('❌ Must provide --course-id or --course-ids');
  console.log('\nUsage:');
  console.log('  npx tsx scripts/calculate-dates-only.ts --course-id 51');
  console.log('  npx tsx scripts/calculate-dates-only.ts --course-ids 51,52,53');
  process.exit(1);
}

const ids = courseIds || (courseId ? [courseId] : []);

// Run the calculation
console.log('📅 Calculate Plan Dates');
console.log('════════════════════════════════════════');
console.log(`Course IDs: ${ids.join(', ')}`);
console.log('════════════════════════════════════════\n');

calculatePlanDates({
  courseIds: ids,
  onProgress: (message) => {
    console.log(message);
  }
})
  .then(() => {
    console.log('\n✅ Date calculation completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Date calculation failed:', error.message);
    console.error(error);
    process.exit(1);
  });
