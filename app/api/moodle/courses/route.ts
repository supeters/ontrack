import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';

// GET /api/moodle/courses?kidId=xxx - Get Moodle-synced courses for a specific kid
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const kidId = searchParams.get('kidId');

    if (!kidId) {
      return NextResponse.json({ error: 'Missing kidId' }, { status: 400 });
    }

    const supabase = await getServerClient();

    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .eq('source_type', 'moodle')
      .eq('kid_id', parseInt(kidId))
      .order('course_name');

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error: any) {
    console.error('Error fetching Moodle courses:', error);
    return NextResponse.json(
      { error: error.message || String(error) },
      { status: 500 }
    );
  }
}
