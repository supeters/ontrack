import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';

// GET /api/courses/[id]/modules?kidId=xxx
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { searchParams } = new URL(request.url);
  const kidId = searchParams.get('kidId');
  const { id: courseId } = await params;

  if (!kidId || !courseId) {
    return NextResponse.json(
      { error: 'Missing kidId or courseId' },
      { status: 400 }
    );
  }

  try {
    const supabase = await getServerClient();

    // Call PostgreSQL function
    const { data, error } = await supabase.rpc('get_course_modules', {
      p_kid_id: parseInt(kidId),
      p_course_id: parseInt(courseId),
    });

    if (error) {
      console.error('Error from get_course_modules:', error);
      throw error;
    }

    // The function returns JSONB, so extract the actual array
    // Supabase wraps it as: [{ get_course_modules: [...] }]
    const modules = Array.isArray(data) && data.length > 0 && data[0]?.get_course_modules
      ? data[0].get_course_modules
      : data || [];

    return NextResponse.json(modules);
  } catch (error: any) {
    console.error('API /api/courses/[id]/modules GET error:', error);
    return NextResponse.json(
      { error: error.message || String(error) },
      { status: 500 }
    );
  }
}