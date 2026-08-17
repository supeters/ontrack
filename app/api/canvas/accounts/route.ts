import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';

/**
 * GET /api/canvas/accounts
 * Fetch Canvas LMS accounts for a kid
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const kidId = searchParams.get('kidId');

  if (!kidId) {
    return NextResponse.json({ error: 'Missing kidId' }, { status: 400 });
  }

  try {
    const supabase = await getServerClient();

    const { data, error } = await supabase
      .from('lms_accounts')
      .select('*')
      .eq('kid_id', parseInt(kidId))
      .eq('lms_type', 'canvas')
      .order('name');

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error: any) {
    console.error('Canvas accounts error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch Canvas accounts' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/canvas/accounts
 * Create or update a Canvas LMS account
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, kidId, name, lmsUrl, apiToken, isActive } = body;

    if (!kidId || !name || !lmsUrl) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const supabase = await getServerClient();

    if (id) {
      // Update existing account
      const { data, error } = await supabase
        .from('lms_accounts')
        .update({
          name,
          lms_url: lmsUrl,
          api_token: apiToken || null,
          is_active: isActive ?? true,
        })
        .eq('id', id)
        .eq('kid_id', kidId)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json(data);
    } else {
      // Create new account
      const { data, error } = await supabase
        .from('lms_accounts')
        .insert({
          kid_id: kidId,
          lms_type: 'canvas',
          name,
          lms_url: lmsUrl,
          api_token: apiToken || null,
          is_active: isActive ?? true,
        })
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json(data);
    }
  } catch (error: any) {
    console.error('Canvas account save error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to save Canvas account' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/canvas/accounts
 * Delete a Canvas LMS account
 */
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const kidId = searchParams.get('kidId');

  if (!id || !kidId) {
    return NextResponse.json(
      { error: 'Missing id or kidId' },
      { status: 400 }
    );
  }

  try {
    const supabase = await getServerClient();

    const { error } = await supabase
      .from('lms_accounts')
      .delete()
      .eq('id', parseInt(id))
      .eq('kid_id', parseInt(kidId));

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Canvas account delete error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete Canvas account' },
      { status: 500 }
    );
  }
}
