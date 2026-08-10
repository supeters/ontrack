import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';

// DELETE /api/activities/recurring/delete?parentId=123 - Delete all recurring activities in a group
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const parentId = searchParams.get('parentId');

  if (!parentId) {
    return NextResponse.json({ error: 'Missing parentId' }, { status: 400 });
  }

  try {
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

    // Soft delete all activities in the group
    const { error: deleteError } = await supabase
      .from('activities')
      .update({
        is_deleted: true,
        updated_at: new Date().toISOString()
      })
      .in('id', activityIds);

    if (deleteError) {
      console.error('Error deleting recurring group:', deleteError);
      throw deleteError;
    }

    return NextResponse.json({
      success: true,
      deleted: activityIds.length,
      activityIds
    });
  } catch (error: any) {
    console.error('API /api/activities/recurring/delete DELETE error:', error);
    return NextResponse.json(
      { error: error.message || String(error) },
      { status: 500 }
    );
  }
}
