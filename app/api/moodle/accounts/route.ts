import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';

// GET /api/moodle/accounts?kidId=xxx - Get Moodle accounts for a specific kid
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const kidId = searchParams.get('kidId');

    if (!kidId) {
      return NextResponse.json({ error: 'Missing kidId' }, { status: 400 });
    }

    const supabase = await getServerClient();

    const { data, error } = await supabase
      .from('lms_accounts')
      .select('*')
      .eq('lms_type', 'moodle')
      .eq('kid_id', parseInt(kidId))
      .order('name');

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error: any) {
    console.error('Error fetching Moodle accounts:', error);
    return NextResponse.json(
      { error: error.message || String(error) },
      { status: 500 }
    );
  }
}

// POST /api/moodle/accounts - Add or update Moodle account
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, kidId, name, lmsUrl, username, password, apiToken, isActive } = body;

    if (!kidId || !name || !lmsUrl) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const supabase = await getServerClient();

    if (id) {
      // Update existing account
      const updateData: any = {
        name,
        lms_url: lmsUrl,
        is_active: isActive ?? true,
      };

      if (username) updateData.lms_user_name = username;
      if (password) {
        // TODO: Implement proper password encryption
        updateData.encrypted_password = Buffer.from(password).toString('base64');
      }
      if (apiToken !== undefined) updateData.api_token = apiToken || null;

      const { data, error } = await supabase
        .from('lms_accounts')
        .update(updateData)
        .eq('id', id)
        .eq('kid_id', kidId)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json(data);
    } else {
      // Create new account
      const insertData: any = {
        kid_id: kidId,
        lms_type: 'moodle',
        name,
        lms_url: lmsUrl,
        is_active: isActive ?? true,
        api_token: apiToken || null,
      };

      if (username) insertData.lms_user_name = username;
      if (password) {
        // TODO: Implement proper password encryption
        insertData.encrypted_password = Buffer.from(password).toString('base64');
      }

      const { data, error } = await supabase
        .from('lms_accounts')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json(data);
    }
  } catch (error: any) {
    console.error('Error saving Moodle account:', error);
    return NextResponse.json(
      { error: error.message || String(error) },
      { status: 500 }
    );
  }
}

// DELETE /api/moodle/accounts?id=xxx&kidId=xxx
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const kidId = searchParams.get('kidId');

    if (!id || !kidId) {
      return NextResponse.json({ error: 'Missing id or kidId' }, { status: 400 });
    }

    const supabase = await getServerClient();

    const { error } = await supabase
      .from('lms_accounts')
      .delete()
      .eq('id', parseInt(id))
      .eq('kid_id', parseInt(kidId));

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting Moodle account:', error);
    return NextResponse.json(
      { error: error.message || String(error) },
      { status: 500 }
    );
  }
}
