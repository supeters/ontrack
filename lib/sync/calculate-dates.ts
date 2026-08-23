import { getServiceRoleClient } from '@/lib/supabase/service';

export interface CalculateDatesParams {
  courseIds: number[];
  onProgress?: (message: string) => void;
}

/**
 * Calculate plan dates for course activities
 */
export async function calculatePlanDates(params: CalculateDatesParams): Promise<void> {
  const { courseIds, onProgress } = params;

  const log = (message: string) => {
    if (onProgress) {
      onProgress(message);
    }
  };


  const supabase = getServiceRoleClient();

  for (const courseId of courseIds) {
    try {
      log(`📅 Calculating plan dates for course ${courseId}...`);


      // Get course with calendar
      const { data: course, error: courseError } = await supabase
        .from('courses')
        .select('*, school_calendars!calendar_id(*)')
        .eq('id', courseId)
        .single();

      if (courseError) throw courseError;
      if (!course) throw new Error(`Course ${courseId} not found`);
      if (!course.calendar_id) throw new Error('Course has no calendar assigned');
      if (!course.class_days) throw new Error('Course has no class_days set');
      if (!course.school_id) throw new Error('Course has no school_id set');

      // Get holidays
      const { data: holidays, error: holError } = await supabase
        .from('holidays')
        .select('*')
        .eq('calendar_id', course.calendar_id);

      if (holError) throw holError;

      course.school_calendars.holidays = holidays || [];

      log(`   Course: ${course.course_name}`);
      log(`   School ID: ${course.school_id}`);
      log(`   Strategy: ${course.school_id === 2 ? 'Position-based' : 'Week-pattern'}`);

      // Route to appropriate calculation strategy
      let stats;
      if (course.school_id === 2) {
        stats = await calculatePositionBased(course, true, supabase, log);
      } else {
        stats = await calculateWeekPatternBased(course, true, supabase, log);
      }

      log(`   ✅ Modules: ${stats.modulesUpdated}, Assignments: ${stats.assignmentsUpdated}`);

      // Clear plan_dates from non-actionable items
      log(`   🧹 Clearing plan_dates from non-actionable items...`);
      const clearedCount = await clearNonActionablePlanDates(courseId, supabase);
      if (clearedCount > 0) {
        log(`   ✅ Cleared ${clearedCount} non-actionable items`);
      }

    } catch (error: any) {
      log(`   ❌ Failed: ${error.message}`);
      throw error;
    }
  }

  log(`✅ Plan date calculation complete!`);
}

/**
 * Helper functions
 */

function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function findFirstWeekday(startDate: string, weekday: number): Date {
  const date = parseLocalDate(startDate);
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

function getDayName(dayNum: number): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dayNum];
}

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

async function bulkUpdateActivities(updates: any[], supabase: any) {
  if (updates.length === 0) return;

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

async function clearNonActionablePlanDates(courseId: number, supabase: any): Promise<number> {
  // Find all non-module activities with plan_date set but is_action = false
  // Modules always keep their plan_dates for navigation purposes
  const { data: nonActionableWithDates } = await supabase
    .from('activities')
    .select('id')
    .eq('course_id', courseId)
    .neq('activity_type', 'module')
    .eq('is_action', false)
    .not('plan_date', 'is', null);

  if (!nonActionableWithDates || nonActionableWithDates.length === 0) {
    return 0;
  }

  // Clear their plan_dates
  for (const activity of nonActionableWithDates) {
    await supabase
      .from('activities')
      .update({ plan_date: null })
      .eq('id', activity.id);
  }

  return nonActionableWithDates.length;
}

/**
 * School ID = 2: Position-based calculation
 */
async function calculatePositionBased(course: any, incremental: boolean, supabase: any, log: (msg: string) => void) {
  const calendar = course.school_calendars;
  const classDays = course.class_days.split('').map((d: string) => parseInt(d));
  const primaryClassDay = classDays[0];
  const workDay = course.work_days ? parseInt(course.work_days.charAt(course.work_days.length - 1)) : 5;

  const firstClassDay = findFirstWeekday(calendar.start_date, primaryClassDay);

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

  const updates = [];
  let stats = { modulesUpdated: 0, assignmentsUpdated: 0 };

  for (const module of modules) {
    if (module.position === 0) {
      const generalPlanDate = formatDateLocal(parseLocalDate(calendar.start_date));
      updates.push({ id: module.id, plan_date: generalPlanDate });
      stats.modulesUpdated++;

      let itemQuery = supabase
        .from('activities')
        .select('id, title, activity_type')
        .eq('parent_activity_id', module.id);

      if (incremental) {
        itemQuery = itemQuery.eq('item_needs_processing', true);
      }

      const { data: generalItems } = await itemQuery;

      if (generalItems && generalItems.length > 0) {
        generalItems.forEach((item: any) => {
          updates.push({ id: item.id, plan_date: null });
        });
        stats.assignmentsUpdated += generalItems.length;
      }
      continue;
    }

    const weekNumber = module.position;
    const weekStart = new Date(firstClassDay);
    weekStart.setDate(weekStart.getDate() + (weekNumber - 1) * 7);

    const moduleDate = findNextWeekday(weekStart, primaryClassDay);
    const modulePlanDate = formatDateLocal(moduleDate);

    updates.push({ id: module.id, plan_date: modulePlanDate });
    stats.modulesUpdated++;

    const assignmentDate = findNextWeekday(weekStart, workDay);
    const assignmentPlanDate = formatDateLocal(assignmentDate);

    let assignmentQuery = supabase
      .from('activities')
      .select('id, title, activity_type')
      .eq('parent_activity_id', module.id)
      .eq('is_action', true);

    if (incremental) {
      assignmentQuery = assignmentQuery.eq('item_needs_processing', true);
    }

    const { data: assignments } = await assignmentQuery;

    if (assignments && assignments.length > 0) {
      assignments.forEach((a: any) => {
        updates.push({ id: a.id, plan_date: assignmentPlanDate });
      });
      stats.assignmentsUpdated += assignments.length;
    }
  }

  await bulkUpdateActivities(updates, supabase);

  return stats;
}

/**
 * School ID = 1: Week-pattern-based calculation
 * (Simplified version - full implementation would include all workgroup pattern logic)
 */
async function calculateWeekPatternBased(course: any, incremental: boolean, supabase: any, log: (msg: string) => void) {
  const calendar = course.school_calendars;
  const holidays = calendar.holidays || [];

  const { data: allActivities, error: allActivitiesError } = await supabase
    .from('activities')
    .select('*')
    .eq('course_id', course.id);

  if (allActivitiesError) throw allActivitiesError;

  const activitiesToUpdate = incremental
    ? allActivities.filter((a: any) => a.item_needs_processing === true)
    : allActivities;

  const idsToUpdate = new Set(activitiesToUpdate.map((a: any) => a.id));

  const allModules = allActivities
    .filter((a: any) => a.activity_type === 'module')
    .sort((a: any, b: any) => (a.module_id || 0) - (b.module_id || 0));

  const weekModules = allModules.filter((a: any) => /week\s+\d+/i.test(a.title));

  const week1Module = weekModules.find((m: any) => {
    const match = m.title.match(/week\s+(\d+)/i);
    return match && parseInt(match[1]) === 1;
  });

  if (!week1Module) {
    throw new Error('No "Week 1" module found');
  }

  // Calculate week 1 start date
  const [year, month, day] = calendar.start_date.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const dayOfWeek = date.getDay();
  const daysBack = dayOfWeek === 0 ? 0 : dayOfWeek;
  const sundayDay = day - daysBack;
  const week1StartDate = addDaysToDate(year, month, sundayDay, 0);

  const updates = [];
  let modulesUpdatedCount = 0;
  let assignmentsUpdatedCount = 0;

  // Process week modules
  for (const module of weekModules) {
    const match = module.title.match(/week\s+(\d+)/i);
    if (!match) continue;

    const weekNumber = parseInt(match[1]);
    const weeksFromWeek1 = weekNumber - 1;

    // Calculate week start (simplified - not accounting for holidays)
    const weekStartDate = addDaysToDate(
      week1StartDate.year,
      week1StartDate.month,
      week1StartDate.day,
      weeksFromWeek1 * 7
    );
    const weekSundayDate = formatDateString(weekStartDate);

    if (idsToUpdate.has(module.id)) {
      updates.push({ id: module.id, plan_date: weekSundayDate, is_action_sync: false });
      modulesUpdatedCount++;
    }

    // Process children (simplified - defaulting to Friday)
    // Only process actionable items (is_action = true)
    const directChildren = allActivities.filter((a: any) =>
      a.parent_activity_id === module.id && a.is_action === true
    );
    for (const child of directChildren) {
      if (idsToUpdate.has(child.id)) {
        const fridayDate = addDaysToDate(weekStartDate.year, weekStartDate.month, weekStartDate.day, 5);
        const planDate = formatDateString(fridayDate);
        updates.push({ id: child.id, plan_date: planDate });
        assignmentsUpdatedCount++;
      }
    }
  }

  await bulkUpdateActivities(updates, supabase);

  return {
    modulesUpdated: modulesUpdatedCount,
    assignmentsUpdated: assignmentsUpdatedCount
  };
}
