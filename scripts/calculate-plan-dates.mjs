#!/usr/bin/env node

/**
 * Calculate Plan Dates for Course Modules and Assignments
 *
 * Logic:
 * - Calendar start date → First occurrence of class day = Week 1
 * - Each module (position 1, 2, 3...) = Week N
 * - Module plan_date = The class day for that week
 * - Assignment plan_date = The work day within that week
 *
 * Usage:
 *   node scripts/calculate-plan-dates.mjs --course 59
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jfdrzjueqfxvozwcsyhm.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmZHJ6anVlcWZ4dm96d2NzeWhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDc4OTA4MCwiZXhwIjoyMDcwMzY1MDgwfQ.zJEJed2-6VPNjk2IM4xFZVU99lGdEeWfPZ5f0QVHmyc';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Parse command line arguments
const courseIdArg = process.argv.find((arg, i) => process.argv[i - 1] === '--course');
const COURSE_ID = courseIdArg ? parseInt(courseIdArg) : 59;

/**
 * Get course with calendar info
 */
async function getCourseWithCalendar(courseId) {
  const { data: course, error } = await supabase
    .from('courses')
    .select('*')
    .eq('id', courseId)
    .single();

  if (error) throw error;
  if (!course) throw new Error(`Course ${courseId} not found`);
  if (!course.calendar_id) throw new Error('Course has no calendar assigned');
  if (!course.class_days) throw new Error('Course has no class_days set');

  // Get calendar
  const { data: calendar, error: calError } = await supabase
    .from('school_calendars')
    .select('*')
    .eq('id', course.calendar_id)
    .single();

  if (calError) throw calError;

  // Get holidays for this calendar
  const { data: holidays, error: holError } = await supabase
    .from('holidays')
    .select('*')
    .eq('calendar_id', course.calendar_id);

  if (holError) throw holError;

  calendar.holidays = holidays || [];
  course.school_calendars = calendar;

  return course;
}

/**
 * Parse date string as local date (avoid timezone issues)
 * From lib/datetime.ts - parseLocalTimestamp
 */
function parseLocalDate(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Format Date object as YYYY-MM-DD in local timezone
 * From lib/datetime.ts - formatDateLocal
 */
function formatDateLocal(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Find first occurrence of a weekday on or after a date
 */
function findFirstWeekday(startDate, weekday) {
  const date = parseLocalDate(startDate);

  while (date.getDay() !== weekday) {
    date.setDate(date.getDate() + 1);
  }
  return date;
}

/**
 * Check if date is a holiday
 */
function isHoliday(date, holidays) {
  const dateStr = formatDateLocal(date);
  return holidays.some(holiday => {
    const start = holiday.start_date;
    const end = holiday.end_date || holiday.start_date;
    return dateStr >= start && dateStr <= end;
  });
}

/**
 * Find next occurrence of target weekday (do NOT skip holidays - teachers create modules for those weeks)
 */
function findNextWeekday(date, targetWeekday) {
  const result = new Date(date);

  while (result.getDay() !== targetWeekday) {
    result.setDate(result.getDate() + 1);

    // Skip weekends only
    if (result.getDay() === 0) result.setDate(result.getDate() + 1); // Skip Sunday
    if (result.getDay() === 6) result.setDate(result.getDate() + 2); // Skip Saturday
  }

  return result;
}

/**
 * Calculate plan dates for all modules and assignments
 */
async function calculatePlanDates(course) {
  console.log('\n📅 Calculating plan dates...\n');

  const calendar = course.school_calendars;
  const holidays = calendar.holidays || [];

  // Parse class_days (e.g., "1" = Monday, "24" = Tuesday/Thursday)
  const classDays = course.class_days.split('').map(d => parseInt(d));
  const primaryClassDay = classDays[0]; // First class day of the week

  // Parse work_days - day when assignments should be completed
  // If not set, default to Friday (5)
  const workDay = course.work_days ? parseInt(course.work_days.charAt(course.work_days.length - 1)) : 5;

  console.log(`Class meets on: ${getDayName(primaryClassDay)}`);
  console.log(`Assignments due on: ${getDayName(workDay)}`);
  console.log(`Calendar starts: ${calendar.start_date}`);
  console.log(`Holidays: ${holidays.length}\n`);

  // Find first class day
  const firstClassDay = findFirstWeekday(calendar.start_date, primaryClassDay);
  console.log(`First class (Week 1): ${formatDateLocal(firstClassDay)}\n`);

  // Get all modules (sections) for this course, ordered by position
  const { data: modules, error: modulesError } = await supabase
    .from('activities')
    .select('id, title, position, lms_id')
    .eq('course_id', course.id)
    .eq('activity_type', 'module')
    .order('position');

  if (modulesError) throw modulesError;

  let stats = { modulesUpdated: 0, assignmentsUpdated: 0 };

  for (const module of modules) {
    // Handle "General" section (position 0) - set to week before start
    if (module.position === 0) {
      const generalDate = new Date(calendar.start_date);
      generalDate.setDate(generalDate.getDate() - 7); // One week before start
      const generalPlanDate = formatDateLocal(parseLocalDate(calendar.start_date)); // Actually use start date itself

      // Update General section plan_date
      const { error: updateModuleError } = await supabase
        .from('activities')
        .update({ plan_date: generalPlanDate })
        .eq('id', module.id);

      if (updateModuleError) throw updateModuleError;
      stats.modulesUpdated++;

      console.log(`📌 Week 0 (General): ${module.title}`);
      console.log(`   Module plan_date: ${generalPlanDate} (Calendar Start)`);

      // Set plan dates for all items in General section
      const { data: generalItems, error: generalItemsError } = await supabase
        .from('activities')
        .select('id, title, activity_type')
        .eq('parent_activity_id', module.id);

      if (!generalItemsError && generalItems && generalItems.length > 0) {
        const generalItemIds = generalItems.map(a => a.id);
        const { error: updateGeneralError } = await supabase
          .from('activities')
          .update({ plan_date: generalPlanDate })
          .in('id', generalItemIds);

        if (updateGeneralError) throw updateGeneralError;
        stats.assignmentsUpdated += generalItems.length;
        console.log(`   ${generalItems.length} item(s) in General set to: ${generalPlanDate}`);
      }
      console.log('');
      continue;
    }

    // Calculate week N based on position
    const weekNumber = module.position;

    // Calculate class day for this week
    // Week 1 = firstClassDay
    // Week 2 = firstClassDay + 7 days
    // Week N = firstClassDay + (N-1) * 7 days
    const weekStart = new Date(firstClassDay);
    weekStart.setDate(weekStart.getDate() + (weekNumber - 1) * 7);

    // Do NOT skip holidays - teachers create modules for those weeks too
    const moduleDate = findNextWeekday(weekStart, primaryClassDay);
    const modulePlanDate = formatDateLocal(moduleDate);

    // Update module plan_date
    const { error: updateModuleError } = await supabase
      .from('activities')
      .update({ plan_date: modulePlanDate })
      .eq('id', module.id);

    if (updateModuleError) throw updateModuleError;
    stats.modulesUpdated++;

    console.log(`📌 Week ${weekNumber}: ${module.title}`);
    console.log(`   Module plan_date: ${modulePlanDate} (${getDayName(moduleDate.getDay())})`);

    // Calculate assignment plan_date = work day within this week (do NOT skip holidays)
    const assignmentDate = findNextWeekday(weekStart, workDay);
    const assignmentPlanDate = formatDateLocal(assignmentDate);

    // Get all assignments within this module
    const { data: assignments, error: assignmentsError } = await supabase
      .from('activities')
      .select('id, title, activity_type')
      .eq('parent_activity_id', module.id)
      .eq('is_action_sync', true); // Only actionable items

    if (assignmentsError) throw assignmentsError;

    if (assignments && assignments.length > 0) {
      // Update all assignments with the same plan_date
      const assignmentIds = assignments.map(a => a.id);

      const { error: updateAssignmentsError } = await supabase
        .from('activities')
        .update({ plan_date: assignmentPlanDate })
        .in('id', assignmentIds);

      if (updateAssignmentsError) throw updateAssignmentsError;

      stats.assignmentsUpdated += assignments.length;
      console.log(`   ${assignments.length} assignment(s) plan_date: ${assignmentPlanDate} (${getDayName(assignmentDate.getDay())})`);
    }

    console.log('');
  }

  return stats;
}

/**
 * Get day name from day number
 */
function getDayName(dayNum) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dayNum];
}

/**
 * Display summary
 */
function displaySummary(stats, course) {
  console.log('═'.repeat(80));
  console.log('📊 PLAN DATE CALCULATION SUMMARY');
  console.log('═'.repeat(80));
  console.log(`Course: ${course.course_name}`);
  console.log(`Modules updated: ${stats.modulesUpdated}`);
  console.log(`Assignments updated: ${stats.assignmentsUpdated}`);
  console.log('═'.repeat(80));
}

/**
 * Main execution
 */
async function main() {
  try {
    console.log(`🚀 Calculating Plan Dates for Course ${COURSE_ID}\n`);

    // Step 1: Get course with calendar
    console.log('🔍 Loading course and calendar...');
    const course = await getCourseWithCalendar(COURSE_ID);
    console.log(`✅ Course: ${course.course_name}`);

    // Step 2: Calculate plan dates
    const stats = await calculatePlanDates(course);

    // Step 3: Display summary
    displaySummary(stats, course);

    console.log('\n✅ Plan date calculation complete!\n');

  } catch (error) {
    console.error('\n❌ Calculation failed:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
