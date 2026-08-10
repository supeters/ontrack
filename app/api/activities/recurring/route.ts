import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';
import { createLocalTimestamp, formatTimestampLocal } from '@/lib/datetime';

// POST /api/activities/recurring - Create recurring activities
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      kidId,
      courseId,
      title,
      description,
      activityType,
      estimatedMinutes,
      startDate,
      endDate,
      startTime, // Optional time like "07:00" for scheduling
      recurDays, // String like "0246" for Sun, Tue, Thu, Sat
      recurUntil,
      respectHolidays,
      isActionable,
    } = body;

    if (!kidId || !title || !activityType || !recurDays) {
      return NextResponse.json(
        { error: 'Missing required fields: kidId, title, activityType, recurDays' },
        { status: 400 }
      );
    }

    const supabase = await getServerClient();

    // Parse recurDays string into array of day numbers
    const daysOfWeek = recurDays.split('').map((d: string) => parseInt(d));

    if (daysOfWeek.length === 0) {
      return NextResponse.json(
        { error: 'At least one day must be selected for recurring activities' },
        { status: 400 }
      );
    }

    // Determine date range
    // Use local time by appending T12:00:00 to avoid timezone shift
    const start = startDate ? new Date(startDate + 'T12:00:00') : new Date();
    const end = recurUntil ? new Date(recurUntil + 'T12:00:00') : (endDate ? new Date(endDate + 'T12:00:00') : null);

    if (!end) {
      return NextResponse.json(
        { error: 'End date is required for recurring activities' },
        { status: 400 }
      );
    }

    // Get holidays if respectHolidays is true and courseId is provided
    let holidays: Date[] = [];
    if (respectHolidays && courseId) {
      const { data: course } = await supabase
        .from('courses')
        .select('calendar_id')
        .eq('id', courseId)
        .single();

      if (course?.calendar_id) {
        const { data: holidayData } = await supabase
          .from('holidays')
          .select('start_date, end_date')
          .eq('calendar_id', course.calendar_id);

        if (holidayData) {
          // Build list of all holiday dates (including date ranges)
          holidayData.forEach((holiday: any) => {
            const holidayStart = new Date(holiday.start_date);
            const holidayEnd = holiday.end_date ? new Date(holiday.end_date) : holidayStart;

            // Add all dates in the range
            let currentDate = new Date(holidayStart);
            while (currentDate <= holidayEnd) {
              holidays.push(new Date(currentDate));
              currentDate.setDate(currentDate.getDate() + 1);
            }
          });
        }
      }
    }

    // Helper function to check if a date is a holiday
    const isHoliday = (date: Date): boolean => {
      return holidays.some(holiday =>
        holiday.getFullYear() === date.getFullYear() &&
        holiday.getMonth() === date.getMonth() &&
        holiday.getDate() === date.getDate()
      );
    };

    // Generate activities for each matching day
    // Note: is_action is a GENERATED column, use is_action_override instead
    // Default to true if not specified
    const isActionValue = isActionable !== undefined ? isActionable : true;

    const activitiesToCreate = [];
    let currentDate = new Date(start);

    while (currentDate <= end) {
      const dayOfWeek = currentDate.getDay();

      // Check if this day matches one of the selected days
      if (daysOfWeek.includes(dayOfWeek)) {
        // Skip if it's a holiday and we're respecting holidays
        if (!respectHolidays || !isHoliday(currentDate)) {
          // Format plan_date as YYYY-MM-DD
          const planDateStr = currentDate.toISOString().split('T')[0];

          // If startTime is provided, create timestamp for that time on this date
          let startTimeISO = null;
          let endTimeISO = null;
          if (startTime) {
            // Use utility function to create local timestamp
            startTimeISO = createLocalTimestamp(planDateStr, startTime);

            // Calculate end time if estimated minutes provided
            if (estimatedMinutes) {
              // Parse the time components
              const [hours, minutes] = startTime.split(':').map(Number);
              const [year, month, day] = planDateStr.split('-').map(Number);

              // Create Date in local timezone
              const startDate = new Date(year, month - 1, day, hours, minutes, 0);
              const endDate = new Date(startDate.getTime() + estimatedMinutes * 60000);

              // Format end time using utility function
              endTimeISO = formatTimestampLocal(endDate);
            }
          }

          activitiesToCreate.push({
            kid_id: kidId,
            course_id: courseId,
            title,
            description,
            activity_type: activityType,
            plan_date: planDateStr,
            estimated_minutes: estimatedMinutes,
            start_time: startTimeISO,
            end_time: endTimeISO,
            is_action_override: isActionValue,
            is_completed: false,
            is_deleted: false,
            is_hidden: false,
          });
        }
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    if (activitiesToCreate.length === 0) {
      return NextResponse.json(
        { error: 'No activities to create. Check your date range and selected days.' },
        { status: 400 }
      );
    }

    // Create the first activity as the parent
    const parentActivity = activitiesToCreate[0];
    const { data: parent, error: parentError } = await supabase
      .from('activities')
      .insert(parentActivity)
      .select()
      .single();

    if (parentError) {
      console.error('Error creating parent activity:', parentError);
      throw parentError;
    }

    // Link all remaining activities to the parent
    const childActivities = activitiesToCreate.slice(1).map(activity => ({
      ...activity,
      parent_activity_id: parent.id
    }));

    let allActivities = [parent];

    if (childActivities.length > 0) {
      const { data: children, error: childrenError } = await supabase
        .from('activities')
        .insert(childActivities)
        .select();

      if (childrenError) {
        console.error('Error creating child activities:', childrenError);
        throw childrenError;
      }

      allActivities = [parent, ...children];
    }

    return NextResponse.json({
      success: true,
      count: allActivities.length,
      parentId: parent.id,
      activities: allActivities
    });
  } catch (error: any) {
    console.error('API /api/activities/recurring POST error:', error);
    return NextResponse.json(
      { error: error.message || String(error) },
      { status: 500 }
    );
  }
}
