#!/usr/bin/env node

/**
 * CLI wrapper for course sync
 *
 * Usage:
 *   node scripts/sync-courses.mjs --kid-id 3
 *   node scripts/sync-courses.mjs --course-id 59
 *   node scripts/sync-courses.mjs --course-ids 59,60,61

 *   node scripts/sync-courses.mjs --kid-id 3 --no-calculate-dates
 */

// This is a temporary workaround - we'll need to transpile the TypeScript lib files
// or convert them to JavaScript for CLI use. For now, this script documents the interface.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jfdrzjueqfxvozwcsyhm.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmZHJ6anVlcWZ4dm96d2NzeWhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDc4OTA4MCwiZXhwIjoyMDcwMzY1MDgwfQ.zJEJed2-6VPNjk2IM4xFZVU99lGdEeWfPZ5f0QVHmyc';

// Parse arguments
const args = process.argv.slice(2);
const kidIdIndex = args.indexOf('--kid-id');
const courseIdIndex = args.indexOf('--course-id');
const courseIdsIndex = args.indexOf('--course-ids');

const kidId = kidIdIndex !== -1 ? parseInt(args[kidIdIndex + 1]) : null;
const courseId = courseIdIndex !== -1 ? parseInt(args[courseIdIndex + 1]) : null;
const courseIds = courseIdsIndex !== -1 ? args[courseIdsIndex + 1].split(',').map(id => parseInt(id.trim())) : null;
const calculateDates = !args.includes('--no-calculate-dates');

if (!kidId && !courseId && !courseIds) {
  console.error('❌ Must provide --kid-id, --course-id, or --course-ids');
  console.log('Usage:');
  console.log('  node scripts/sync-courses.mjs --kid-id 3');
  console.log('  node scripts/sync-courses.mjs --course-id 59');
  console.log('  node scripts/sync-courses.mjs --course-ids 59,60,61');

  console.log('  node scripts/sync-courses.mjs --kid-id 3 --no-calculate-dates');
  process.exit(1);
}

console.log('🚀 Sync Courses CLI');
console.log('════════════════════════════════════════');

console.log(`Calculate dates: ${calculateDates}`);
if (kidId) console.log(`Kid ID: ${kidId}`);
if (courseId) console.log(`Course ID: ${courseId}`);
if (courseIds) console.log(`Course IDs: ${courseIds.join(', ')}`);
console.log('════════════════════════════════════════\n');

/**
 * NOTE: This CLI script currently uses the API endpoint approach.
 * To use the lib/sync functions directly, we would need to either:
 * 1. Transpile TypeScript to JavaScript at runtime (using tsx or similar)
 * 2. Convert lib/sync to pure JavaScript (.mjs)
 * 3. Build the TypeScript files as part of the project setup
 *
 * For now, this demonstrates the interface and can be run via the API.
 */

console.log('⚠️  This script is a template for direct library usage.');
console.log('    For now, please use the web UI or call the API endpoint directly.');
console.log('    To enable direct CLI usage, the lib/sync TypeScript files need to be');
console.log('    transpiled to JavaScript or run with tsx/ts-node.\n');

console.log('Example API usage:');
console.log(`  curl -X POST http://localhost:3000/api/sync-courses \\`);
console.log(`    -H "Content-Type: application/json" \\`);
const payload = {};
if (kidId) payload.kid_id = kidId;
if (courseId) payload.course_id = courseId;
if (courseIds) payload.course_ids = courseIds;
payload.calculate_dates = calculateDates;
console.log(`    -d '${JSON.stringify(payload)}'`);

process.exit(0);
