#!/usr/bin/env node

/**
 * Calculate Plan Dates for Course Activities (Consolidated)
 *
 * Strategies:
 * - School ID = 2: Position-based (module position 1, 2, 3... = Week N)
 * - School ID = 1: Week-pattern-based (searches for "Week X" in titles)
 *
 * Features:
 * - Incremental mode: Only process items where item_needs_processing = true
 * - Bulk updates: Minimizes database calls
 *
 * Usage:
 *   node scripts/calculate-plan-dates-v2.mjs --course 59 [--incremental]
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://jfdrzjueqfxvozwcsyhm.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmZHJ6anVlcWZ4dm96d2NzeWhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDc4OTA4MCwiZXhwIjoyMDcwMzY1MDgwfQ.zJEJed2-6VPNjk2IM4xFZVU99lGdEeWfPZ5f0QVHmyc';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Parse command line arguments
const args = process.argv.slice(2);
const courseIdIndex = args.indexOf('--course');
const COURSE_ID = courseIdIndex !== -1 ? parseInt(args[courseIdIndex + 1]) : null;
const INCREMENTAL = args.includes('--incremental');

if (!COURSE_ID) {
  console.error('❌ Missing required --course argument');
  console.log('Usage: node calculate-plan-dates-v2.mjs --course <id> [--incremental]');
  process.exit(1);
}

/**
 * Get course with calendar and school info
 */
async function getCourseWithCalendar(courseId) {
  const { data: course, error } = await supabase
    .from('courses')
    .select('*, school_calendars!calendar_id(*)')
    .eq('id', courseId)
    .single();

  if (error) throw error;
  if (!course) throw new Error(`Course ${courseId} not found`);
  if (!course.calendar_id) throw new Error('Course has no calendar assigned');
  if (!course.class_days) throw new Error('Course has no class_days set');
  if (!course.school_id) throw new Error('Course has no school_id set');

  // Get holidays for this calendar
  const { data: holidays, error: holError } = await supabase
    .from('holidays')
    .select('*')
    .eq('calendar_id', course.calendar_id);

  if (holError) throw holError;

  course.school_calendars.holidays = holidays || [];

  return course;
}

/**
 * Parse date string as local date (avoid timezone issues)
 */
function parseLocalDate(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Format Date object as YYYY-MM-DD in local timezone
 */
function formatDateLocal(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Find first occurrence of a weekday on or after startDate
 */
function findFirstWeekday(startDate, weekday) {
  const date = parseLocalDate(startDate);
  while (date.getDay() !== weekday) {
    date.setDate(date.getDate() + 1);
  }
  return date;
}

/**
 * Find next occurrence of target weekday (skip weekends only, not holidays)
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
 * Add days to a date
 */
function addDaysToDate(year, month, day, daysToAdd) {
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

/**
 * Format date object to YYYY-MM-DD
 */
function formatDateString(dateObj) {
  const year = dateObj.year;
  const month = String(dateObj.month).padStart(2, '0');
  const day = String(dateObj.day).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Check if week overlaps with holiday
 */
function weekOverlapsHoliday(weekStart, holidays) {
  const weekEnd = addDaysToDate(weekStart.year, weekStart.month, weekStart.day, 6);
  const weekStartStr = formatDateString(weekStart);
  const weekEndStr = formatDateString(weekEnd);

  for (const holiday of holidays) {
    const holidayStart = holiday.start_date;
    const holidayEnd = holiday.end_date || holiday.start_date;

    if (weekStartStr <= holidayEnd && weekEndStr >= holidayStart) {
      return true;
    }
  }

  return false;
}

/**
 * Check if title has "Week X" pattern (School ID = 1)
 */
function hasWeekPattern(title) {
  return /week\s+\d+/i.test(title);
}

/**
 * Extract week number from title (School ID = 1)
 */
function extractWeekNumber(title) {
  const match = title.match(/week\s+(\d+)/i);
  return match ? parseInt(match[1]) : null;
}

/**
 * Check if title has workgroup pattern (School ID = 1)
 */
function hasWorkgroupPattern(title) {
  const patterns = [
    /due\s+(on\s+)?day\s+1/i,
    /due\s+(on\s+)?day\s+2/i,
    /homework\s+due.*next\s+week/i,
    /end\s+of\s+(the\s+)?week/i,
    /due\s+(at|on)\s+end\s+of\s+(the\s+)?week/i
  ];
  return patterns.some(pattern => pattern.test(title));
}

/**
 * Apply work day pattern (School ID = 1)
 */
function applyWorkDayPattern(weekStartDate, workDays, dayNumber) {
  if (workDays === '135') {
    // Day 1=Monday, Day 2=Wednesday, Day 3=Friday
    const dayOffsets = { 1: 1, 2: 3, 3: 5 };
    const targetDate = addDaysToDate(weekStartDate.year, weekStartDate.month, weekStartDate.day, dayOffsets[dayNumber]);
    return formatDateString(targetDate);
  } else if (workDays === '524') {
    // Day 1=Previous Friday, Day 2=Tuesday, Day 3=Thursday
    const dayOffsets = { 1: -2, 2: 2, 3: 4 };
    const targetDate = addDaysToDate(weekStartDate.year, weekStartDate.month, weekStartDate.day, dayOffsets[dayNumber]);
    return formatDateString(targetDate);
  }

  return null;
}

/**
 * Calculate workgroup plan date based on pattern (School ID = 1)
 */
/**
 * Calculate workgroup plan date based on pattern and course work_days
 */
function calculateWorkgroupPlanDate(weekStartDate, title, workDays) {
  const normalizedTitle = title.toLowerCase();

  // Offset mappings relative to Sunday (weekStartDate)
  const workDaysMap = {
    // 135: Mon (+1), Wed (+3), Fri (+5)
    '135': { 1: 1, 2: 3, 3: 5, endOfWeek: 5 },
    // 524: Prev Fri (-2), Tue (+2), Thu (+4)
    '524': { 1: -2, 2: 2, 3: 4, endOfWeek: 4 }
  };

  const offsets = workDaysMap[workDays] || workDaysMap['135'];

  // 1. Treat "End of Week" AND "Next Week Day 1" as End of Week (added (the\s+)? check)
  const isEndOfWeek = /end\s+of\s+(the\s+)?week/i.test(normalizedTitle);
  const isNextWeekDay1 = /next\s+week.*day\s+1/i.test(normalizedTitle);

  if (isEndOfWeek || isNextWeekDay1) {
    return formatDateString(
      addDaysToDate(weekStartDate.year, weekStartDate.month, weekStartDate.day, offsets.endOfWeek)
    );
  }

  // 2. Parse "Due Day X" (Due Day 1, Due Day 2, etc.)
  const dayMatch = normalizedTitle.match(/due\s+(?:on\s+)?day\s+(\d+)/i);
  if (dayMatch) {
    const dayNum = parseInt(dayMatch[1], 10);
    const offset = offsets[dayNum] ?? offsets.endOfWeek;

    return formatDateString(
      addDaysToDate(weekStartDate.year, weekStartDate.month, weekStartDate.day, offset)
    );
  }

  return null;
}

/**
 * Calculate week start date for Week 1 (School ID = 1)
 */
function calculateWeek1StartDate(firstClassDate) {
  if (!firstClassDate) return null;

  const [year, month, day] = firstClassDate.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const dayOfWeek = date.getDay();

  // Find the Sunday of this week
  const daysBack = dayOfWeek === 0 ? 0 : dayOfWeek;
  const sundayDay = day - daysBack;

  return addDaysToDate(year, month, sundayDay, 0);
}

/**
 * Calculate week start date relative to Week 1, skipping holidays (School ID = 1)
 */
function calculateWeekStartDate(week1StartDate, weeksFromWeek1, holidays = []) {
  if (!week1StartDate) return null;
  if (weeksFromWeek1 === 0) return week1StartDate;

  let currentWeek = week1StartDate;
  let actualWeeksPassed = 0;

  while (actualWeeksPassed < weeksFromWeek1) {
    currentWeek = addDaysToDate(currentWeek.year, currentWeek.month, currentWeek.day, 7);

    if (weekOverlapsHoliday(currentWeek, holidays)) {
      console.log(`   ⏭️  Skipping holiday week starting ${formatDateString(currentWeek)}`);
    } else {
      actualWeeksPassed++;
    }
  }

  return currentWeek;
}

/**
 * Get day name from day number
 */
function getDayName(dayNum) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dayNum];
}

/**
 * Bulk update activities
 */
async function bulkUpdateActivities(updates) {
  if (updates.length === 0) return;

  // Group updates into batches of 100
  const batchSize = 100;
  for (let i = 0; i < updates.length; i += batchSize) {
    const batch = updates.slice(i, i + batchSize);

    for (const update of batch) {
      const { error } = await supabase
        .from('activities')
        .update({
          plan_date: update.plan_date,
          item_needs_processing: false,
          ...(update.is_action_sync !== undefined && { is_action_sync: update.is_action_sync })
        })
        .eq('id', update.id);

      if (error) {
        console.error(`Failed to update activity ${update.id}:`, error.message);
      }
    }
  }
}

/**
 * School ID = 2: Position-based calculation
 */
async function calculatePositionBased(course, incremental) {
  console.log('\n📅 Using position-based calculation (School ID = 2)\n');

  const calendar = course.school_calendars;
  const holidays = calendar.holidays || [];

  const classDays = course.class_days.split('').map(d => parseInt(d));
  const primaryClassDay = classDays[0];
  const workDay = course.work_days ? parseInt(course.work_days.charAt(course.work_days.length - 1)) : 5;

  console.log(`Class meets on: ${getDayName(primaryClassDay)}`);
  console.log(`Assignments due on: ${getDayName(workDay)}`);
  console.log(`Calendar starts: ${calendar.start_date}`);
  console.log(`Holidays: ${holidays.length}\n`);

  const firstClassDay = findFirstWeekday(calendar.start_date, primaryClassDay);
  console.log(`First class (Week 1): ${formatDateLocal(firstClassDay)}\n`);

  // Get all modules for this course
  let moduleQuery = supabase
    .from('activities')
    .select('id, title, position, lms_id')
    .eq('course_id', course.id)
    .eq('activity_type', 'module')
    .order('position');

  if (incremental) {
    moduleQuery = moduleQuery.eq('item_needs_processing', true);
  }

  const { data: modules, error: modulesError } = await moduleQuery;

  if (modulesError) throw modulesError;

  console.log(`Processing ${modules.length} modules${incremental ? ' (incremental)' : ''}...\n`);

  const updates = [];
  let stats = { modulesUpdated: 0, assignmentsUpdated: 0 };

  for (const module of modules) {
    // Handle "General" section (position 0)
    if (module.position === 0) {
      const generalPlanDate = formatDateLocal(parseLocalDate(calendar.start_date));
      updates.push({ id: module.id, plan_date: generalPlanDate });
      stats.modulesUpdated++;

      console.log(`📌 Week 0 (General): ${module.title}`);
      console.log(`   Module plan_date: ${generalPlanDate}`);

      // Get items in General section
      let itemQuery = supabase
        .from('activities')
        .select('id, title, activity_type')
        .eq('parent_activity_id', module.id);

      if (incremental) {
        itemQuery = itemQuery.eq('item_needs_processing', true);
      }

      const { data: generalItems } = await itemQuery;

      if (generalItems && generalItems.length > 0) {
        generalItems.forEach(item => {
          updates.push({ id: item.id, plan_date: generalPlanDate });
        });
        stats.assignmentsUpdated += generalItems.length;
        console.log(`   ${generalItems.length} item(s) set to: ${generalPlanDate}`);
      }
      console.log('');
      continue;
    }

    // Calculate week N based on position
    const weekNumber = module.position;
    const weekStart = new Date(firstClassDay);
    weekStart.setDate(weekStart.getDate() + (weekNumber - 1) * 7);

    const moduleDate = findNextWeekday(weekStart, primaryClassDay);
    const modulePlanDate = formatDateLocal(moduleDate);

    updates.push({ id: module.id, plan_date: modulePlanDate });
    stats.modulesUpdated++;

    console.log(`📌 Week ${weekNumber}: ${module.title}`);
    console.log(`   Module plan_date: ${modulePlanDate} (${getDayName(moduleDate.getDay())})`);

    // Calculate assignment plan_date
    const assignmentDate = findNextWeekday(weekStart, workDay);
    const assignmentPlanDate = formatDateLocal(assignmentDate);

    // Get assignments within this module
    let assignmentQuery = supabase
      .from('activities')
      .select('id, title, activity_type')
      .eq('parent_activity_id', module.id)
      .eq('is_action_sync', true);

    if (incremental) {
      assignmentQuery = assignmentQuery.eq('item_needs_processing', true);
    }

    const { data: assignments } = await assignmentQuery;

    if (assignments && assignments.length > 0) {
      assignments.forEach(a => {
        updates.push({ id: a.id, plan_date: assignmentPlanDate });
      });
      stats.assignmentsUpdated += assignments.length;
      console.log(`   ${assignments.length} assignment(s) plan_date: ${assignmentPlanDate} (${getDayName(assignmentDate.getDay())})`);
    }

    console.log('');
  }

  // Bulk update all activities
  console.log(`\n💾 Bulk updating ${updates.length} activities...`);
  await bulkUpdateActivities(updates);

  return stats;
}

/**
 * School ID = 1: Week-pattern-based calculation
 */
/**
 * School ID = 1: Week-pattern-based calculation
 */
/**
 * School ID = 1: Week-pattern-based calculation
 */
async function calculateWeekPatternBased(course, incremental) {
  console.log('\n📅 Using Week-pattern-based calculation (School ID = 1)\n');

  const calendar = course.school_calendars;
  const holidays = calendar.holidays || [];
  const workDays = course.work_days || '135';

  console.log(`Work days: ${workDays}`);
  console.log(`Class days: ${course.class_days}`);
  console.log(`Calendar starts: ${calendar.start_date}`);
  console.log(`Holidays: ${holidays.length}\n`);

  // Always fetch ALL activities to build hierarchy
  const { data: allActivities, error: allActivitiesError } = await supabase
    .from('activities')
    .select('*')
    .eq('course_id', course.id);

  if (allActivitiesError) throw allActivitiesError;

  console.log(`Found ${allActivities?.length || 0} total activities`);

  // Filter items needing update in incremental mode
  const activitiesToUpdate = incremental
    ? allActivities.filter(a => a.item_needs_processing === true)
    : allActivities;

  console.log(`   ${activitiesToUpdate.length} activities marked to process${incremental ? ' (incremental)' : ''}`);

  const idsToUpdate = new Set(activitiesToUpdate.map(a => a.id));
  const processedIds = new Set(); // Track processed items

  // Get all modules
  const allModules = allActivities
    .filter(a => a.activity_type === 'module')
    .sort((a, b) => (a.module_id || 0) - (b.module_id || 0));

  const weekModules = allModules.filter(a => hasWeekPattern(a.title));
  console.log(`   ${weekModules.length} modules with Week patterns\n`);

  const week1Module = weekModules.find(m => extractWeekNumber(m.title) === 1);
  if (!week1Module) {
    console.error('❌ No "Week 1" module found - cannot calculate plan dates');
    process.exit(1);
  }

  const week1StartDate = calculateWeek1StartDate(calendar.start_date);
  console.log(`   Week 1 starts: ${formatDateString(week1StartDate)} (Sunday of week containing ${calendar.start_date})`);

  const week0StartDate = addDaysToDate(week1StartDate.year, week1StartDate.month, week1StartDate.day, -7);
  console.log(`   Week 0 (pre-class): ${formatDateString(week0StartDate)}\n`);

  const updates = [];
  let modulesUpdatedCount = 0;
  let assignmentsUpdatedCount = 0;

  // Helper to check if item is actionable via `is_action` or a container (module/workgroup)
  const isActionableOrContainer = (item) => {
    return item.activity_type === 'module' || item.activity_type === 'workgroup' || item.is_action === true;
  };

  // -------------------------------------------------------------
  // 1. Process Pre-Week-1 & Non-Week Modules
  // -------------------------------------------------------------
  const preWeek1Modules = allModules.filter(m => {
    const moduleIndex = allModules.indexOf(m);
    const week1Index = allModules.indexOf(week1Module);
    return moduleIndex < week1Index || !hasWeekPattern(m.title);
  });

  if (preWeek1Modules.length > 0) {
    const week0Date = formatDateString(week0StartDate);

    preWeek1Modules.forEach(module => {
      if (idsToUpdate.has(module.id)) {
        updates.push({ id: module.id, plan_date: week0Date, is_action_sync: false });
        processedIds.add(module.id);
        modulesUpdatedCount++;
      }

      // Process direct items under non-week modules (only if actionable)
      const directItems = allActivities.filter(a => a.parent_activity_id === module.id);
      directItems.forEach(item => {
        if (idsToUpdate.has(item.id) && isActionableOrContainer(item)) {
          updates.push({ id: item.id, plan_date: week0Date });
          processedIds.add(item.id);
          assignmentsUpdatedCount++;
        }
      });
    });
  }

  // -------------------------------------------------------------
  // 2. Process Standard "Week X" Modules & Children
  // -------------------------------------------------------------
  for (const module of weekModules) {
    const weekNumber = extractWeekNumber(module.title);
    if (!weekNumber) continue;

    const weeksFromWeek1 = weekNumber - 1;
    const weekStartDate = calculateWeekStartDate(week1StartDate, weeksFromWeek1, holidays);
    const weekSundayDate = formatDateString(weekStartDate);

    if (idsToUpdate.has(module.id)) {
      updates.push({ id: module.id, plan_date: weekSundayDate, is_action_sync: false });
      processedIds.add(module.id);
      modulesUpdatedCount++;
    }

    const directChildren = allActivities.filter(a => a.parent_activity_id === module.id);

    for (const child of directChildren) {
      let planDate = null;

      if (child.activity_type === 'workgroup' && hasWorkgroupPattern(child.title)) {
        planDate = calculateWorkgroupPlanDate(weekStartDate, child.title, workDays);
      }

      if (!planDate) {
        const fridayDate = addDaysToDate(weekStartDate.year, weekStartDate.month, weekStartDate.day, 5);
        planDate = formatDateString(fridayDate);
      }

      // Only calculate and set plan_date if actionable or workgroup
      if (idsToUpdate.has(child.id) && isActionableOrContainer(child)) {
        updates.push({ id: child.id, plan_date: planDate });
        processedIds.add(child.id);
        assignmentsUpdatedCount++;
      }

      const subChildren = allActivities.filter(a => a.parent_activity_id === child.id);
      subChildren.forEach(subChild => {
        if (idsToUpdate.has(subChild.id) && isActionableOrContainer(subChild)) {
          updates.push({ id: subChild.id, plan_date: planDate });
          processedIds.add(subChild.id);
          assignmentsUpdatedCount++;
        }
      });
    }
  }

  // -------------------------------------------------------------
  // 3. Process Standalone "Participation Week X" Items
  // -------------------------------------------------------------
  const participationItems = allActivities.filter(a =>
    /participation\s+week\s+(\d+)/i.test(a.title) &&
    idsToUpdate.has(a.id) &&
    isActionableOrContainer(a)
  );

  participationItems.forEach(item => {
    if (processedIds.has(item.id)) return;

    const match = item.title.match(/participation\s+week\s+(\d+)/i);
    if (match) {
      const weekNum = parseInt(match[1]);
      const weekStartDate = calculateWeekStartDate(week1StartDate, weekNum - 1, holidays);
      const fridayDate = addDaysToDate(weekStartDate.year, weekStartDate.month, weekStartDate.day, 5);
      const planDate = formatDateString(fridayDate);

      updates.push({ id: item.id, plan_date: planDate });
      processedIds.add(item.id);
      assignmentsUpdatedCount++;
    }
  });

  // -------------------------------------------------------------
  // 4. Clear Non-Actionable or Unmatched Items
  // -------------------------------------------------------------
  const unprocessableItems = activitiesToUpdate.filter(a => !processedIds.has(a.id));

  if (unprocessableItems.length > 0) {
    console.log(`\n⚠️ Marking ${unprocessableItems.length} non-actionable or unprocessable items as complete:`);
    unprocessableItems.forEach(item => {
      console.log(`   - [ID: ${item.id}] "${item.title}" (${item.activity_type}, is_action: ${item.is_action})`);
      // Fulfills item_needs_processing: false without updating/overwriting plan_date
      updates.push({ id: item.id, plan_date: item.plan_date || null });
    });
  }

  // Bulk update all staged items in Supabase
  console.log(`\n💾 Bulk updating ${updates.length} activities (marking all as processed)...`);
  await bulkUpdateActivities(updates);

  return {
    modulesUpdated: modulesUpdatedCount,
    assignmentsUpdated: assignmentsUpdatedCount,
    unprocessedCount: unprocessableItems.length
  };
}
/**
 * Main execution
 */
async function main() {
  try {
    console.log(`🚀 Calculating Plan Dates for Course ${COURSE_ID}${INCREMENTAL ? ' (INCREMENTAL)' : ''}\n`);

    // Step 1: Get course with calendar
    console.log('🔍 Loading course and calendar...');
    const course = await getCourseWithCalendar(COURSE_ID);
    console.log(`✅ Course: ${course.course_name}`);
    console.log(`   School ID: ${course.school_id}`);

    // Step 2: Route to appropriate calculation strategy
    let stats;
    if (course.school_id === 2) {
      stats = await calculatePositionBased(course, INCREMENTAL);
    } else {
      stats = await calculateWeekPatternBased(course, INCREMENTAL);
    }

    // Step 3: Display summary
    console.log('\n' + '═'.repeat(80));
    console.log('📊 PLAN DATE CALCULATION SUMMARY');
    console.log('═'.repeat(80));
    console.log(`Course: ${course.course_name}`);
    console.log(`Strategy: School ID ${course.school_id} (${course.school_id === 2 ? 'Position-based' : 'Week-pattern'})`);
    console.log(`Mode: ${INCREMENTAL ? 'Incremental' : 'Full'}`);
    console.log(`Modules updated: ${stats.modulesUpdated}`);
    console.log(`Assignments updated: ${stats.assignmentsUpdated}`);
    console.log('═'.repeat(80));

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