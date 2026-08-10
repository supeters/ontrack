import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';

// GET /api/kids - Get all kids for the current user
export async function GET(request: NextRequest) {
  try {
    const supabase = await getServerClient();

    // For now, get all kids (would filter by auth.uid() in production)
    const { data, error } = await supabase
      .from('kids')
      .select('id, name')
      .order('name');

    if (error) {
      console.error('Error fetching kids:', error);
      throw error;
    }

    return NextResponse.json(data || []);
  } catch (error: any) {
    console.error('API /api/kids GET error:', error);
    return NextResponse.json(
      { error: error.message || String(error) },
      { status: 500 }
    );
  }
}
