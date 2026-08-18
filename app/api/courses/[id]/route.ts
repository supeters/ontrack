import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';


export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const courseId = parseInt(id);

    if (isNaN(courseId)) {
      return NextResponse.json({ error: 'Invalid course ID' }, { status: 400 });
    }

    const body = await request.json();
    const { class_days, work_days, exclusion_patterns } = body;

    // Build update object with only provided fields
    const updateData: any = {};
    if (class_days !== undefined) updateData.class_days = class_days;
    if (work_days !== undefined) updateData.work_days = work_days;
    if (exclusion_patterns !== undefined) updateData.exclusion_patterns = exclusion_patterns;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }
     const supabase = await getServerClient();


    const { data, error } = await supabase
      .from('courses')
      .update(updateData)
      .eq('id', courseId)
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('PATCH /api/courses/[id] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
