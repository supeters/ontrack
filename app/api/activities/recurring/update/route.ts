import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';

// PATCH /api/activities/recurring/update - Update all recurring activities in a group
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { parentId, updates } = body;

    if (!parentId || !updates) {
      return NextResponse.json(
        { error: 'Missing parentId or updates' },
        { status: 400 }
      );
    }

    const supabase = await getServerClient();

    // Get all activities in this recurring group (parent + children)
    const { data: activities, error: fetchError } = await supabase
      .from('activities')
      .select('id')
      .or(`id.eq.${parentId},parent_activity_id.eq.${parentId}`);

    if (fetchError) {
      console.error('Error fetching recurring group:', fetchError);
      throw fetchError;
    }

    if (!activities || activities.length === 0) {
      return NextResponse.json(
        { error: 'No activities found in recurring group' },
        { status: 404 }
      );
    }

    const activityIds = activities.map(a => a.id);

    // Build update object (only non-date fields should be updated across all)
    const updateFields: any = {
      updated_at: new Date().toISOString()
    };

    // Allow updating these fields across all recurring activities
    const allowedFields = ['title', 'description', 'estimated_minutes', 'activity_type', 'is_action_override'];

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        updateFields[field] = updates[field];
      }
    }

    // Update all activities in the group
    const { error: updateError } = await supabase
      .from('activities')
      .update(updateFields)
      .in('id', activityIds);

    if (updateError) {
      console.error('Error updating recurring group:', updateError);
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      updated: activityIds.length,
      activityIds
    });
  } catch (error: any) {
    console.error('API /api/activities/recurring/update PATCH error:', error);
    return NextResponse.json(
      { error: error.message || String(error) },
      { status: 500 }
    );
  }
}
