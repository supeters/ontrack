#!/usr/bin/env tsx
/**
 * Unit tests for plan date calculation logic
 * Uses real course data from JSON fixtures
 * Does NOT touch the database - runs calculation logic in isolation
 *
 * Usage:
 *   1. First extract test data: npx tsx scripts/extract-test-data.ts
 *   2. Then run tests: npx tsx scripts/test-plan-date-logic.ts
 */

import * as fs from 'fs';
import * as path from 'path';

interface TestCourse {
  id: number;
  course_name: string;
  school_id: number;
  work_days: string;
  class_days: string;
  school_calendars: {
    start_date: string;
    holidays: any[];
  };
}

interface TestActivity {
  id: number;
  title: string;
  activity_type: 'module' | 'workgroup' | 'assignment';
  parent_activity_id: number | null;
  position?: number;
  is_action?: boolean;
  is_pinned?: boolean;
  is_hidden?: boolean;
  item_needs_processing?: boolean;
  current_plan_date?: string | null; // What's currently in DB
  expected_plan_date?: string | null; // What we EXPECT the result to be
}

interface TestCase {
  name: string;
  description: string;
  course: TestCourse;
  activities: TestActivity[];
}

// Load test fixtures from JSON files
function loadTestFixtures(): TestCase[] {
  const testDataDir = path.join(__dirname, 'test-data');
  const fixtures: TestCase[] = [];

  // Check if test-data directory exists
  if (!fs.existsSync(testDataDir)) {
    console.log('⚠️  No test-data directory found.');
    console.log('   Run this first: npx tsx scripts/extract-test-data.ts\n');
    return [];
  }

  // Load all JSON files from test-data directory
  const files = fs.readdirSync(testDataDir).filter(f => f.endsWith('.json'));

  if (files.length === 0) {
    console.log('⚠️  No test fixtures found.');
    console.log('   Run this first: npx tsx scripts/extract-test-data.ts\n');
    return [];
  }

  console.log('📂 Loading test fixtures:');
  for (const file of files) {
    const filePath = path.join(testDataDir, file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    fixtures.push(data);
    console.log(`   ✅ ${file}`);
  }
  console.log('');

  return fixtures;
}

// ============================================================================
// CALCULATION LOGIC (extracted from lib/sync/calculate-dates.ts)
// ============================================================================

function addDaysToDate(year: number, month: number, day: number, daysToAdd: number) {
  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  if ((year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0)) {
    daysInMonth[1] = 29;
  }

  let newDay = day + daysToAdd;
  let newMonth = month;
  let newYear = year;

  while (newDay > daysInMonth[newMonth - 1]) {
    newDay -= daysInMonth[newMonth - 1];
    newMonth++;
    if (newMonth > 12) {
      newMonth = 1;
      newYear++;
      if ((newYear % 4 === 0 && newYear % 100 !== 0) || (newYear % 400 === 0)) {
        daysInMonth[1] = 29;
      } else {
        daysInMonth[1] = 28;
      }
    }
  }

  while (newDay < 1) {
    newMonth--;
    if (newMonth < 1) {
      newMonth = 12;
      newYear--;
      if ((newYear % 4 === 0 && newYear % 100 !== 0) || (newYear % 400 === 0)) {
        daysInMonth[1] = 29;
      } else {
        daysInMonth[1] = 28;
      }
    }
    newDay += daysInMonth[newMonth - 1];
  }

  return { year: newYear, month: newMonth, day: newDay };
}

function formatDateString(dateObj: { year: number; month: number; day: number }): string {
  const year = dateObj.year;
  const month = String(dateObj.month).padStart(2, '0');
  const day = String(dateObj.day).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function hasWorkgroupPattern(title: string): boolean {
  const patterns = [
    /due\s+(on\s+)?day\s+1/i,
    /due\s+(on\s+)?day\s+2/i,
    /homework\s+due.*next\s+week/i,
    /end\s+of\s+(the\s+)?week/i,
    /due\s+(at|on)\s+end\s+of\s+(the\s+)?week/i
  ];
  return patterns.some(pattern => pattern.test(title));
}

function calculateWorkgroupPlanDate(
  weekStartDate: { year: number; month: number; day: number },
  title: string,
  workDays: string
): string {
  const normalizedTitle = title.toLowerCase();

  const workDaysMap: Record<string, Record<string, number>> = {
    '135': { '1': 1, '2': 3, '3': 5, endOfWeek: 5 },
    '524': { '1': -2, '2': 2, '3': 4, endOfWeek: 4 }
  };

  const offsets = workDaysMap[workDays] || workDaysMap['135'];

  const isEndOfWeek = /end\s+of\s+(the\s+)?week/i.test(normalizedTitle);
  const isNextWeekDay1 = /next\s+week.*day\s+1/i.test(normalizedTitle);

  if (isEndOfWeek || isNextWeekDay1) {
    return formatDateString(
      addDaysToDate(weekStartDate.year, weekStartDate.month, weekStartDate.day, offsets.endOfWeek)
    );
  }

  const dayMatch = normalizedTitle.match(/due\s+(?:on\s+)?day\s+(\d+)/i);
  if (dayMatch) {
    const dayNum = dayMatch[1];
    const offset = offsets[dayNum] ?? offsets.endOfWeek;

    return formatDateString(
      addDaysToDate(weekStartDate.year, weekStartDate.month, weekStartDate.day, offset)
    );
  }

  return formatDateString(
    addDaysToDate(weekStartDate.year, weekStartDate.month, weekStartDate.day, offsets.endOfWeek)
  );
}

function findFirstWeekday(startDate: string, weekday: number): Date {
  const [year, month, day] = startDate.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  while (date.getDay() !== weekday) {
    date.setDate(date.getDate() + 1);
  }
  return date;
}

function findNextWeekday(date: Date, targetWeekday: number): Date {
  const result = new Date(date);
  while (result.getDay() !== targetWeekday) {
    result.setDate(result.getDate() + 1);
    if (result.getDay() === 0) result.setDate(result.getDate() + 1);
    if (result.getDay() === 6) result.setDate(result.getDate() + 2);
  }
  return result;
}

function formatDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// School ID = 1: Week-pattern-based calculation
function calculateWeekPatternBased(course: TestCourse, activities: TestActivity[]): Map<number, string | null> {
  const results = new Map<number, string | null>();

  const [year, month, day] = course.school_calendars.start_date.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const dayOfWeek = date.getDay();
  const daysBack = dayOfWeek === 0 ? 0 : dayOfWeek;
  const sundayDay = day - daysBack;
  const week1StartDate = addDaysToDate(year, month, sundayDay, 0);

  const allModules = activities
    .filter(a => a.activity_type === 'module')
    .sort((a, b) => (a.id || 0) - (b.id || 0));

  const weekModules = allModules.filter(a => /week\s+\d+/i.test(a.title));

  // Process week modules
  for (const module of weekModules) {
    const match = module.title.match(/week\s+(\d+)/i);
    if (!match) continue;

    const weekNumber = parseInt(match[1]);
    const weeksFromWeek1 = weekNumber - 1;

    const weekStartDate = addDaysToDate(
      week1StartDate.year,
      week1StartDate.month,
      week1StartDate.day,
      weeksFromWeek1 * 7
    );
    const weekSundayDate = formatDateString(weekStartDate);

    if (!module.is_pinned && module.item_needs_processing) {
      results.set(module.id, weekSundayDate);
    }

    // Process direct children (workgroups and assignments)
    const directChildren = activities.filter(a => a.parent_activity_id === module.id);

    for (const child of directChildren) {
      let planDate: string;

      // Check if this is a workgroup with a due day pattern
      if (child.activity_type === 'workgroup' && hasWorkgroupPattern(child.title)) {
        planDate = calculateWorkgroupPlanDate(weekStartDate, child.title, course.work_days || '135');
      } else {
        // Default to Friday
        const fridayDate = addDaysToDate(weekStartDate.year, weekStartDate.month, weekStartDate.day, 5);
        planDate = formatDateString(fridayDate);
      }

      // Update workgroup or assignment if it's actionable
      if ((child.activity_type === 'workgroup' || child.is_action === true) && !child.is_pinned && child.item_needs_processing) {
        results.set(child.id, planDate);
      }

      // Process children of workgroups (assignments under workgroups)
      const subChildren = activities.filter(a =>
        a.parent_activity_id === child.id && a.is_action === true
      );
      for (const subChild of subChildren) {
        if (!subChild.is_pinned && subChild.item_needs_processing) {
          results.set(subChild.id, planDate);
        }
      }
    }
  }

  // Process assignments with "Participation Assignment Week N" pattern
  const participationWeekPattern = activities.filter(a =>
    a.activity_type === 'assignment' &&
    a.is_action === true &&
    /^Participation (Assessment|Assignment)\s+Week\s+\d+/i.test(a.title)
  );

  for (const assignment of participationWeekPattern) {
    const match = assignment.title.match(/week\s+(\d+)/i);
    if (!match) continue;

    const weekNumber = parseInt(match[1]);
    const weeksFromWeek1 = weekNumber - 1;

    const weekStartDate = addDaysToDate(
      week1StartDate.year,
      week1StartDate.month,
      week1StartDate.day,
      weeksFromWeek1 * 7
    );

    if (!assignment.is_pinned && assignment.item_needs_processing) {
      const fridayDate = addDaysToDate(weekStartDate.year, weekStartDate.month, weekStartDate.day, 5);
      const planDate = formatDateString(fridayDate);
      results.set(assignment.id, planDate);
    }
  }

  return results;
}

// School ID = 2: Position-based calculation
function calculatePositionBased(course: TestCourse, activities: TestActivity[]): Map<number, string | null> {
  const results = new Map<number, string | null>();

  const classDays = course.class_days.split('').map(d => parseInt(d));
  const primaryClassDay = classDays[0];
  const workDay = course.work_days ? parseInt(course.work_days.charAt(course.work_days.length - 1)) : 5;

  const firstClassDay = findFirstWeekday(course.school_calendars.start_date, primaryClassDay);

  const modules = activities
    .filter(a => a.activity_type === 'module')
    .sort((a, b) => (a.position || 0) - (b.position || 0));

  let visibleWeekNumber = 0;

  for (const module of modules) {
    // Position 0: General Section (No plan date, no week increment)
    if (module.position === 0) {
      if (module.item_needs_processing) {
        results.set(module.id, null);
      }

      const generalItems = activities.filter(a => a.parent_activity_id === module.id);
      generalItems.forEach(item => {
        if (item.item_needs_processing) {
          results.set(item.id, null);
        }
      });
      continue;
    }

    // Pinned or Hidden modules: Skip week slot, force plan_date = null
    if (module.is_pinned) {
      if (module.item_needs_processing) {
        results.set(module.id, null);
      }

      const childItems = activities.filter(a => a.parent_activity_id === module.id);
      childItems.forEach(item => {
        if (item.item_needs_processing) {
          results.set(item.id, null);
        }
      });

      continue;
    }

    // Active unpinned modules: Advance week & calculate dates
    visibleWeekNumber++;

    const weekStart = new Date(firstClassDay);
    weekStart.setDate(weekStart.getDate() + (visibleWeekNumber - 1) * 7);

    const moduleDate = findNextWeekday(weekStart, primaryClassDay);
    const modulePlanDate = formatDateLocal(moduleDate);

    if (module.item_needs_processing) {
      results.set(module.id, modulePlanDate);
    }

    // Process child assignments for active week
    const assignmentDate = findNextWeekday(weekStart, workDay);
    const assignmentPlanDate = formatDateLocal(assignmentDate);

    const assignments = activities.filter(a =>
      a.parent_activity_id === module.id && a.is_action === true
    );

    assignments.forEach(a => {
      // If an individual assignment is pinned inside an active module, ignore/clear it
      if (a.is_pinned) {
        if (a.item_needs_processing) {
          results.set(a.id, null);
        }
      } else if (a.item_needs_processing) {
        results.set(a.id, assignmentPlanDate);
      }
    });
  }

  return results;
}

// Main calculation function - routes to appropriate strategy
function calculatePlanDatesForTest(course: TestCourse, activities: TestActivity[]): Map<number, string | null> {
  if (course.school_id === 2) {
    return calculatePositionBased(course, activities);
  } else {
    return calculateWeekPatternBased(course, activities);
  }
}

// Helper to format date comparison
function formatDateComparison(expected: string | null, actual: string | null): string {
  if (expected === actual) return '✅';
  return `❌ Expected: ${expected || 'null'}, Got: ${actual || 'null'}`;
}

// Run tests
function runTests() {
  console.log('🧪 Plan Date Logic Unit Tests');
  console.log('═══════════════════════════════════════\n');

  const testCases = loadTestFixtures();

  if (testCases.length === 0) {
    console.log('❌ No test cases to run. Exiting.');
    process.exit(1);
  }

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  for (const testCase of testCases) {
    console.log(`\n📋 ${testCase.name}`);
    console.log(`   ${testCase.description}`);
    console.log(`   School: ${testCase.course.school_id}, Work Days: ${testCase.course.work_days}\n`);

    // Run calculation
    const results = calculatePlanDatesForTest(testCase.course, testCase.activities);

    // Track activities by type
    const modules = testCase.activities.filter(a => a.activity_type === 'module');
    const workgroups = testCase.activities.filter(a => a.activity_type === 'workgroup');
    const assignments = testCase.activities.filter(a => a.is_action === true);

    // Test modules
    if (modules.length > 0) {
      console.log('   📁 Modules:');
      for (const module of modules.slice(0, 5)) { // Show first 5
        totalTests++;
        const actual = results.get(module.id);
        const expected = module.expected_plan_date;

        if (actual === expected) {
          passedTests++;
          console.log(`      ✅ ${module.title.substring(0, 40).padEnd(40)} → ${expected || 'null'}`);
        } else {
          failedTests++;
          console.log(`      ❌ ${module.title.substring(0, 40).padEnd(40)}`);
          console.log(`         Expected: ${expected || 'null'}, Got: ${actual || 'null'}`);
        }
      }
      if (modules.length > 5) {
        console.log(`      ... and ${modules.length - 5} more modules`);
      }
      console.log('');
    }

    // Test workgroups
    if (workgroups.length > 0) {
      console.log('   📦 Workgroups (Due Days):');
      for (const wg of workgroups.slice(0, 5)) {
        totalTests++;
        const actual = results.get(wg.id);
        const expected = wg.expected_plan_date;

        if (actual === expected) {
          passedTests++;
          console.log(`      ✅ ${wg.title.substring(0, 40).padEnd(40)} → ${expected || 'null'}`);
        } else {
          failedTests++;
          console.log(`      ❌ ${wg.title.substring(0, 40).padEnd(40)}`);
          console.log(`         Expected: ${expected || 'null'}, Got: ${actual || 'null'}`);
        }
      }
      if (workgroups.length > 5) {
        console.log(`      ... and ${workgroups.length - 5} more workgroups`);
      }
      console.log('');
    }

    // Test assignments (sample)
    if (assignments.length > 0) {
      console.log('   📝 Assignments (sample):');
      for (const assignment of assignments.slice(0, 5)) {
        totalTests++;
        const actual = results.get(assignment.id);
        const expected = assignment.expected_plan_date;

        if (actual === expected) {
          passedTests++;
          console.log(`      ✅ ${assignment.title.substring(0, 40).padEnd(40)} → ${expected || 'null'}`);
        } else {
          failedTests++;
          console.log(`      ❌ ${assignment.title.substring(0, 40).padEnd(40)}`);
          console.log(`         Expected: ${expected || 'null'}, Got: ${actual || 'null'}`);
        }
      }
      if (assignments.length > 5) {
        console.log(`      ... and ${assignments.length - 5} more assignments`);
      }
    }
  }

  console.log('\n═══════════════════════════════════════');
  console.log(`📊 Results: ${passedTests}/${totalTests} passed`);

  if (failedTests > 0) {
    console.log(`   ❌ ${failedTests} failed`);
  }

  const passRate = Math.round((passedTests / totalTests) * 100);
  console.log(`   Success Rate: ${passRate}%`);
  console.log('═══════════════════════════════════════\n');

  if (failedTests > 0) {
    console.error(`❌ ${failedTests} test(s) failed`);
    process.exit(1);
  } else {
    console.log('✅ All tests passed!');
    process.exit(0);
  }
}

// Handle CLI arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Plan Date Logic Unit Tests

Tests the plan date calculation logic using real course data.

Setup:
  1. Extract test data from database:
     npx tsx scripts/extract-test-data.ts

  2. Run tests:
     npx tsx scripts/test-plan-date-logic.ts

How it works:
  - Loads course structure from JSON fixtures in scripts/test-data/
  - Runs plan date calculation logic
  - Compares actual results to expected results
  - Reports pass/fail for each activity

Fixture files contain:
  - Real course configuration (work_days, class_days, etc.)
  - Real module/workgroup/assignment structure
  - current_plan_date: What's in DB now
  - expected_plan_date: What we expect (you can edit this)
  `);
  process.exit(0);
}

runTests();
