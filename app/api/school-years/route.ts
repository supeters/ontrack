import { NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';

// GET /api/school-years - Get all school years with current flag
export async function GET() {
  try {
    const supabase = await getServerClient();

    const { data, error } = await supabase
      .from('school_years')
      .select('*')
      .order('name', { ascending: false });

    if (error) {
      console.error('Error fetching school years:', error);
      throw error;
    }

    return NextResponse.json(data || []);
  } catch (error: any) {
    console.error('API /api/school-years GET error:', error);
    return NextResponse.json(
      { error: error.message || String(error) },
      { status: 500 }
    );
  }
}
