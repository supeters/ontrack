import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';

// GET /api/activities - Fetch activities by query params
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const parentId = searchParams.get('parent_id');
    const kidId = searchParams.get('kid_id');
    const courseId = searchParams.get('course_id');

    const supabase = await getServerClient();
    let query = supabase
      .from('activities')
      .select('*')
      .eq('is_deleted', false);

    if (parentId) {
      query = query.eq('parent_activity_id', parentId);
    }
    if (kidId) {
      query = query.eq('kid_id', kidId);
    }
    if (courseId) {
      query = query.eq('course_id', courseId);
    }

    const { data, error } = await query.order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching activities:', error);
      throw error;
    }

    return NextResponse.json(data || []);
  } catch (error: any) {
    console.error('API /api/activities GET error:', error);
    return NextResponse.json(
      { error: error.message || String(error) },
      { status: 500 }
    );
  }
}

// PATCH /api/activities - Update an activity
// PATCH /api/activities - Update an activity
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { activityId, updates } = body;

    if (!activityId || !updates) {
      return NextResponse.json(
        { error: 'Missing activityId or updates' },
        { status: 400 }
      );
    }

    const supabase = await getServerClient();

    // Map payload explicitly for safety
    const payload: Record<string, any> = {
      description: updates.description,
      course_id: updates.course_id,
      plan_date: updates.plan_date,
      start_time: updates.start_time,
      end_time: updates.end_time,
      estimated_minutes: updates.estimated_minutes,
      actual_minutes: updates.actual_minutes,
      is_completed: updates.is_completed,
      completed_at: updates.completed_at,
      is_action_override: updates.is_action_override,
      daily_checklist: updates.daily_checklist, // 👈 Explicitly saved
      position: updates.position,
      updated_at: new Date().toISOString(),
    };

    // Remove undefined values to prevent overwriting existing data with nulls
    Object.keys(payload).forEach((key) => {
      if (payload[key] === undefined) {
        delete payload[key];
      }
    });

    const { data, error } = await supabase
      .from('activities')
      .update(payload)
      .eq('id', activityId)
      .select()
      .single();

    if (error) {
      console.error('Error updating activity:', error);
      throw error;
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('API /api/activities PATCH error:', error);
    return NextResponse.json(
      { error: error.message || String(error) },
      { status: 500 }
    );
  }
}

// POST /api/activities - Create a new activity
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      kidId,
      courseId,
      title,
      description,
      activityType,
      planDate,
      estimatedMinutes,
      startTime,
      endTime,
      isActionable,
      parentActivityId,
      resourceUrl,
      position,
    } = body;

    if (!kidId || !title || !activityType) {
      return NextResponse.json(
        { error: 'Missing required fields: kidId, title, activityType' },
        { status: 400 }
      );
    }

    const supabase = await getServerClient();

    // Direct insert for now (could create a PostgreSQL function for this too)
    // Note: is_action is a GENERATED column, use is_action_override instead
    // Default to true if not specified
    const isActionValue = isActionable !== undefined ? isActionable : true;

    const { data, error } = await supabase
      .from('activities')
      .insert({
        kid_id: kidId,
        course_id: courseId,
        title,
        description,
        activity_type: activityType,
        plan_date: planDate,
        estimated_minutes: estimatedMinutes,
        start_time: startTime,
        end_time: endTime,
        parent_activity_id: parentActivityId,
        is_action_override: isActionValue,
        is_completed: false,
        is_deleted: false,
        is_hidden: false,
        resource_url: resourceUrl,
        position: position || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating activity:', error);
      throw error;
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('API /api/activities POST error:', error);
    return NextResponse.json(
      { error: error.message || String(error) },
      { status: 500 }
    );
  }
}

// DELETE /api/activities?id=123 - Soft delete an activity
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  try {
    const supabase = await getServerClient();

    // Soft delete by setting is_deleted = true
    const { error } = await supabase
      .from('activities')
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('Error deleting activity:', error);
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('API /api/activities DELETE error:', error);
    return NextResponse.json(
      { error: error.message || String(error) },
      { status: 500 }
    );
  }
}
