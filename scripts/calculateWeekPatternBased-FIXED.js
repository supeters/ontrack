/**
 * School ID = 1: Week-pattern-based calculation
 *
 * FIXED VERSION - addresses incremental mode bug
 *
 * Problem: In incremental mode, the script fails with "No Week 1 module found"
 * because it queries only activities with item_needs_processing = true, which means
 * modules might not be in the results even though they exist in the database.
 *
 * Solution: Always load ALL activities to establish the Week module structure,
 * but only UPDATE activities that have item_needs_processing = true in incremental mode.
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

  // FIXED: Always get ALL activities to establish the Week module structure
  const { data: allActivities, error: allActivitiesError } = await supabase
    .from('activities')
    .select('*')
    .eq('course_id', course.id);

  if (allActivitiesError) throw allActivitiesError;

  console.log(`Found ${allActivities?.length || 0} total activities`);

  // FIXED: In incremental mode, filter to items that need processing
  const activitiesToUpdate = incremental
    ? allActivities.filter(a => a.item_needs_processing === true)
    : allActivities;

  console.log(`   ${activitiesToUpdate.length} activities to update${incremental ? ' (incremental)' : ''}`);

  // FIXED: Get all modules sorted by module_id - use ALL activities for structure
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

  // FIXED: Create a Set of IDs that need updating for efficient lookup
  const idsToUpdate = new Set(activitiesToUpdate.map(a => a.id));

  const updates = [];
  let processed = 0;

  // Process pre-Week-1 modules
  const preWeek1Modules = allModules.filter(m => {
    const moduleIndex = allModules.indexOf(m);
    const week1Index = allModules.indexOf(week1Module);
    return moduleIndex < week1Index;
  });

  if (preWeek1Modules.length > 0) {
    console.log(`   📦 Processing ${preWeek1Modules.length} pre-Week-1 modules → Week 0`);
    const week0Date = formatDateString(week0StartDate);

    preWeek1Modules.forEach(module => {
      // FIXED: Only add to updates if this item needs processing
      if (idsToUpdate.has(module.id)) {
        updates.push({ id: module.id, plan_date: week0Date, is_action_sync: false });
        console.log(`      📅 ${module.title} → ${week0Date} (non-actionable)`);
        processed++;
      }
    });
  }

  // Process Week modules
  for (const module of weekModules) {
    const weekNumber = extractWeekNumber(module.title);
    if (!weekNumber) continue;

    console.log(`\n   Processing: ${module.title} (Week ${weekNumber})`);

    const weeksFromWeek1 = weekNumber - 1;
    const weekStartDate = calculateWeekStartDate(week1StartDate, weeksFromWeek1, holidays);
    const weekSundayDate = formatDateString(weekStartDate);

    // FIXED: Only add to updates if this module needs processing
    if (idsToUpdate.has(module.id)) {
      updates.push({ id: module.id, plan_date: weekSundayDate, is_action_sync: false });
      console.log(`      📅 Module → ${weekSundayDate} (non-actionable)`);
      processed++;
    }

    // FIXED: Find workgroups for this module - use ALL activities to find structure
    const workgroups = allActivities.filter(a =>
      a.activity_type === 'workgroup' &&
      a.parent_activity_id === module.id &&
      hasWorkgroupPattern(a.title)
    );

    console.log(`      Found ${workgroups.length} workgroups`);

    for (const workgroup of workgroups) {
      const planDate = calculateWorkgroupPlanDate(weekStartDate, workgroup.title, workDays);

      if (planDate) {
        // FIXED: Only update workgroup if it needs processing
        if (idsToUpdate.has(workgroup.id)) {
          console.log(`      📅 ${workgroup.title} → ${planDate}`);
          updates.push({ id: workgroup.id, plan_date: planDate });
          processed++;
        }

        // FIXED: Find children - use ALL activities to find structure
        const children = allActivities.filter(a => a.parent_activity_id === workgroup.id);
        children.forEach(child => {
          // FIXED: Only update child if it needs processing
          if (idsToUpdate.has(child.id)) {
            updates.push({ id: child.id, plan_date: planDate });
            processed++;
          }
        });
      }
    }
  }

  // Bulk update all activities
  console.log(`\n💾 Bulk updating ${updates.length} activities...`);
  await bulkUpdateActivities(updates);

  return { modulesUpdated: weekModules.length, assignmentsUpdated: processed - weekModules.length };
}
