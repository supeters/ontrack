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
        stats = await calculatePositionBased(course, supabase, log);
      } else {
        stats = await calculateWeekPatternBased(course, supabase, log);
      }

      log(`   ✅ Modules: ${stats.modulesUpdated}, Assignments: ${stats.assignmentsUpdated}${'pinnedSkipped' in stats && stats.pinnedSkipped ? `, Pinned: ${stats.pinnedSkipped}` : ''}`);
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
async function calculatePositionBased(course: any, supabase: any, log: (msg: string) => void) {
  const calendar = course.school_calendars;
  const classDays = course.class_days.split('').map((d: string) => parseInt(d));
  const primaryClassDay = classDays[0];
  const workDay = course.work_days ? parseInt(course.work_days.charAt(course.work_days.length - 1)) : 5;

  const firstClassDay = findFirstWeekday(calendar.start_date, primaryClassDay);

  // Fetch ALL modules in position order to calculate the true sequential timeline
  const { data: modules, error: modulesError } = await supabase
    .from('activities')
    .select('id, title, position, lms_id, is_hidden, is_pinned, item_needs_processing')
    .eq('course_id', course.id)
    .eq('activity_type', 'module')
    .order('position');

  if (modulesError) throw modulesError;

  const updates = [];
  let stats = { modulesUpdated: 0, assignmentsUpdated: 0, hiddenSkipped: 0, pinnedSkipped: 0 };
  let visibleWeekNumber = 0;

  for (const module of modules) {
    // ----------------------------------------------------
    // POSITION 0: General Section (No plan date, no week increment)
    // ----------------------------------------------------
    if (module.position === 0) {
      if (module.item_needs_processing) {
        updates.push({ id: module.id, plan_date: null });
        stats.modulesUpdated++;
      }

      const { data: generalItems } = await supabase
        .from('activities')
        .select('id, is_pinned, item_needs_processing')
        .eq('parent_activity_id', module.id);

      if (generalItems && generalItems.length > 0) {
        generalItems.forEach((item: any) => {
          if (item.item_needs_processing) {
            updates.push({ id: item.id, plan_date: null });
            stats.assignmentsUpdated++;
          }
        });
      }
      continue;
    }

    // ----------------------------------------------------
    // PINNED OR HIDDEN MODULES: Skip week slot, force plan_date = null
    // ----------------------------------------------------
    if (module.is_pinned ) {
      if (module.is_pinned) stats.pinnedSkipped++;
      if (module.is_hidden) stats.hiddenSkipped++;

      // Set module plan_date to null ONLY if it needs processing
      if (module.item_needs_processing) {
        updates.push({ id: module.id, plan_date: null });
        stats.modulesUpdated++;
      }

      // Clear dates for child assignments of pinned/hidden modules
      const { data: childItems } = await supabase
        .from('activities')
        .select('id, item_needs_processing')
        .eq('parent_activity_id', module.id);

      if (childItems && childItems.length > 0) {
        childItems.forEach((item: any) => {
          if (item.item_needs_processing) {
            updates.push({ id: item.id, plan_date: null });
            stats.assignmentsUpdated++;
          }
        });
      }
      
      // DO NOT increment visibleWeekNumber! Next unpinned module gets this week.
      continue;
    }

    // ----------------------------------------------------
    // ACTIVE UNPINNED MODULES: Advance week & calculate dates
    // ----------------------------------------------------
    visibleWeekNumber++; // 1 for first active module, 2 for second, etc.

    const weekStart = new Date(firstClassDay);
    weekStart.setDate(weekStart.getDate() + (visibleWeekNumber - 1) * 7);

    const moduleDate = findNextWeekday(weekStart, primaryClassDay);
    const modulePlanDate = formatDateLocal(moduleDate);

    // Only queue update if item_needs_processing is true
    if (module.item_needs_processing) {
      updates.push({ id: module.id, plan_date: modulePlanDate });
      stats.modulesUpdated++;
    }

    // Process child assignments for active week
    const assignmentDate = findNextWeekday(weekStart, workDay);
    const assignmentPlanDate = formatDateLocal(assignmentDate);

    const { data: assignments } = await supabase
      .from('activities')
      .select('id, title, activity_type, is_pinned, item_needs_processing')
      .eq('parent_activity_id', module.id)
      .eq('is_action', true);

    if (assignments && assignments.length > 0) {
      assignments.forEach((a: any) => {
        // If an individual assignment is pinned inside an active module, ignore/clear it
        if (a.is_pinned) {
          if (a.item_needs_processing) {
            updates.push({ id: a.id, plan_date: null });
            stats.assignmentsUpdated++;
          }
        } else if (a.item_needs_processing) {
          updates.push({ id: a.id, plan_date: assignmentPlanDate });
          stats.assignmentsUpdated++;
        }
      });
    }
  }

  // Execute database batch updates only for collected items
  await bulkUpdateActivities(updates, supabase);

  return stats;
}

/**
 * School ID = 1: Week-pattern-based calculation
 */
async function calculateWeekPatternBased(course: any, supabase: any, log: (msg: string) => void) {
  const calendar = course.school_calendars;

  const { data: allActivities, error: allActivitiesError } = await supabase
    .from('activities')
    .select('*')
    .eq('course_id', course.id);

  if (allActivitiesError) throw allActivitiesError;

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

    const weekStartDate = addDaysToDate(
      week1StartDate.year,
      week1StartDate.month,
      week1StartDate.day,
      weeksFromWeek1 * 7
    );
    const weekSundayDate = formatDateString(weekStartDate);

    if (!module.is_pinned && module.item_needs_processing) {
      updates.push({ id: module.id, plan_date: weekSundayDate, is_action_sync: false });
      modulesUpdatedCount++;
    }

    // Process children
    const directChildren = allActivities.filter((a: any) =>
      a.parent_activity_id === module.id && a.is_action === true
    );
    for (const child of directChildren) {
      if (!child.is_pinned && child.item_needs_processing) {
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