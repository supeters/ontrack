import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';

// GET /api/work-chunks - Fetch work chunks by activity
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const activityId = searchParams.get('activity_id');
    const isActive = searchParams.get('is_active');

    if (!activityId) {
      return NextResponse.json(
        { error: 'activity_id is required' },
        { status: 400 }
      );
    }

    const supabase = await getServerClient();
    let query = supabase
      .from('activity_work_chunks')
      .select('*')
      .eq('activity_id', parseInt(activityId))
      .order('created_at', { ascending: false });

    if (isActive !== null && isActive !== undefined) {
      query = query.eq('is_active', isActive === 'true');
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching work chunks:', error);
      throw error;
    }

    return NextResponse.json({ chunks: data || [] });
  } catch (error: any) {
    console.error('API /api/work-chunks GET error:', error);
    return NextResponse.json(
      { error: error.message || String(error) },
      { status: 500 }
    );
  }
}

// POST /api/work-chunks - Create a new work chunk
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { activity_id, kid_id, start_time, is_active, is_manual, minutes_worked } = body;

    if (!activity_id || !kid_id) {
      return NextResponse.json(
        { error: 'activity_id and kid_id are required' },
        { status: 400 }
      );
    }

    const supabase = await getServerClient();
    const { data, error } = await supabase
      .from('activity_work_chunks')
      .insert({
        activity_id,
        kid_id,
        start_time: start_time || null,
        end_time: null,
        is_active: is_active ?? true,
        is_manual: is_manual ?? false,
        minutes_worked: minutes_worked || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating work chunk:', error);
      throw error;
    }

    return NextResponse.json({ chunk: data });
  } catch (error: any) {
    console.error('API /api/work-chunks POST error:', error);
    return NextResponse.json(
      { error: error.message || String(error) },
      { status: 500 }
    );
  }
}

// PATCH /api/work-chunks - Update a work chunk
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { chunkId, updates } = body;

    if (!chunkId || typeof chunkId !== 'number') {
      return NextResponse.json(
        { error: 'Valid chunkId is required' },
        { status: 400 }
      );
    }

    const supabase = await getServerClient();
    const { data, error } = await supabase
      .from('activity_work_chunks')
      .update(updates)
      .eq('id', chunkId)
      .select()
      .single();

    if (error) {
      console.error('Error updating work chunk:', error);
      throw error;
    }

    return NextResponse.json({ chunk: data });
  } catch (error: any) {
    console.error('API /api/work-chunks PATCH error:', error);
    return NextResponse.json(
      { error: error.message || String(error) },
      { status: 500 }
    );
  }
}
