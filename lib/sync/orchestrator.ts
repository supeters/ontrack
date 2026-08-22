import { getServiceRoleClient } from '@/lib/supabase/service';
import { syncCanvasCourse } from './sync-canvas';
import { syncMoodleCourse } from './sync-moodle';
import { calculatePlanDates } from './calculate-dates';

export interface SyncParams {
  kid_id?: number;
  course_id?: number;
  course_ids?: number[];
  school_year?: string;
  calculate_dates?: boolean;
  onProgress?: (message: string, data?: any) => void;
}

export interface SyncResult {
  succeeded: number;
  failed: number;
  total: number;
  errors: string[];
}

export async function syncCourses(params: SyncParams): Promise<SyncResult> {
  const { kid_id, course_id, course_ids, school_year, calculate_dates = true, onProgress } = params;

  const log = (message: string, data?: any) => {
    if (onProgress) {
      onProgress(message, data);
    }
  };

  if (!kid_id && !course_id && !course_ids) {
    throw new Error('Must provide kid_id, course_id, or course_ids');
  }

  const supabase = getServiceRoleClient();

  // Determine which courses to sync
  let coursesToSync: any[] = [];

  if (course_id) {
    // Single course
    let query = supabase
      .from('courses')
      .select(`
        id,
        course_name,
        school_id,
        lms_course_id,
        source_type,
        kid_id,
        calendar_id,
        school_calendars!inner (
          school_year_name
        )
      `)
      .eq('id', course_id);

    if (school_year) {
      query = query.eq('school_calendars.school_year_name', school_year);
    }

    const { data, error } = await query.maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('Course not found');
    coursesToSync = [data];

  } else if (course_ids && Array.isArray(course_ids)) {
    // Multiple specific courses
    let query = supabase
      .from('courses')
      .select(`
        id,
        course_name,
        school_id,
        lms_course_id,
        source_type,
        kid_id,
        calendar_id,
        school_calendars!inner (
          school_year_name
        )
      `)
      .in('id', course_ids);

    if (school_year) {
      query = query.eq('school_calendars.school_year_name', school_year);
    }

    const { data, error } = await query;

    if (error) throw error;
    coursesToSync = data || [];

  } else if (kid_id) {
    // All courses for a kid with LMS mappings
    let query = supabase
      .from('courses')
      .select(`
        id,
        course_name,
        school_id,
        lms_course_id,
        source_type,
        kid_id,
        calendar_id,
        school_calendars!inner (
          school_year_name
        )
      `)
      .eq('kid_id', kid_id)
      .not('lms_course_id', 'is', null);

    if (school_year) {
      query = query.eq('school_calendars.school_year_name', school_year);
    }

    const { data, error } = await query;

    if (error) throw error;
    coursesToSync = data || [];
  }

  if (coursesToSync.length === 0) {
    throw new Error('No courses found to sync');
  }

  log(`🚀 Starting sync for ${coursesToSync.length} course(s)
`);

  let succeeded = 0;
  let failed = 0;
  const errors: string[] = [];

  // Group courses by LMS type
  const canvasCourses = coursesToSync.filter(c => c.school_id === 1 || c.source_type === 'canvas');
  const moodleCourses = coursesToSync.filter(c => c.school_id === 2 || c.source_type === 'moodle');

  // Sync Canvas courses
  if (canvasCourses.length > 0) {
    log(`\n📘 Canvas Courses (${canvasCourses.length})\n`);

    for (const course of canvasCourses) {
      try {
        log(course.course_name, { type: 'start', courseId: course.id });

        await syncCanvasCourse({
          courseId: course.id,
          
          onProgress: (msg) => log(msg)
        });

        if (calculate_dates) {
          log(`\n📅 Calculating plan dates for ${course.course_name}...\n`);
          await calculatePlanDates({
            courseIds: [course.id],
            
            onProgress: (msg) => log(msg)
          });
        }

        log(`✅ ${course.course_name} synced`, { type: 'complete', courseId: course.id });
        succeeded++;

      } catch (error: any) {
        log(`❌ ${course.course_name} failed: ${error.message}`, { type: 'error', courseId: course.id });
        errors.push(`${course.course_name}: ${error.message}`);
        failed++;
      }
    }
  }

  // Sync Moodle courses
  if (moodleCourses.length > 0) {
    log(`\n📗 Moodle Courses (${moodleCourses.length})\n`);

    for (const course of moodleCourses) {
      try {
        log(course.course_name, { type: 'start', courseId: course.id });

        await syncMoodleCourse({
          courseId: course.id,
          
          onProgress: (msg) => log(msg)
        });

        if (calculate_dates) {
          log(`\n📅 Calculating plan dates for ${course.course_name}...\n`);
          await calculatePlanDates({
            courseIds: [course.id],
            
            onProgress: (msg) => log(msg)
          });
        }

        log(`✅ ${course.course_name} synced`, { type: 'complete', courseId: course.id });
        succeeded++;

      } catch (error: any) {
        log(`❌ ${course.course_name} failed: ${error.message}`, { type: 'error', courseId: course.id });
        errors.push(`${course.course_name}: ${error.message}`);
        failed++;
      }
    }
  }

  // Final summary
  log(`\n${'═'.repeat(60)}\n`);
  log(`📊 SYNC SUMMARY\n`);
  log(`${'═'.repeat(60)}\n`);
  log(`Total: ${coursesToSync.length}\n`);
  log(`✅ Succeeded: ${succeeded}\n`);
  log(`❌ Failed: ${failed}\n`);

  if (errors.length > 0) {
    log(`\nErrors:\n`);
    errors.forEach(err => log(`  - ${err}\n`));
  }

  log(`${'═'.repeat(60)}\n`);
  log(`\n🎉 Sync complete!\n`);

  return {
    succeeded,
    failed,
    total: coursesToSync.length,
    errors
  };
}
