import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';

// GET /api/schools - Get all schools
export async function GET() {
  try {
    const supabase = await getServerClient();

    const { data, error } = await supabase
      .from('schools')
      .select('*')
      .order('name');

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('API /api/schools GET error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// POST /api/schools - Create or update school
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { schoolId, name, district, address, phone, website } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'School name is required' },
        { status: 400 }
      );
    }

    const supabase = await getServerClient();
    const user = await supabase.auth.getUser();

    if (!user.data.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (schoolId) {
      // Update existing school
      const { data, error } = await supabase
        .from('schools')
        .update({
          name,
          district: district || null,
          address: address || null,
          phone: phone || null,
          website: website || null,
        })
        .eq('id', schoolId)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json(data);
    } else {
      // Create new school
      const { data, error } = await supabase
        .from('schools')
        .insert({
          name,
          district: district || null,
          address: address || null,
          phone: phone || null,
          website: website || null,
          created_by_user_id: user.data.user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json(data);
    }
  } catch (error) {
    console.error('API /api/schools POST error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// DELETE /api/schools?id=xxx
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    const supabase = await getServerClient();

    const { error } = await supabase
      .from('schools')
      .delete()
      .eq('id', parseInt(id));

    if (error) throw error;

    return NextResponse.json({ message: 'School deleted' });
  } catch (error) {
    console.error('API /api/schools DELETE error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
