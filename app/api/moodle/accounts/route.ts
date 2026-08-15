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
      .order('created_at', { ascending: false });

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

// POST /api/moodle/accounts - Add new Moodle account
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { kid_id, moodle_url, username, password } = body;

    if (!kid_id || !moodle_url || !username || !password) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // TODO: Implement password encryption
    const encryptedPassword = Buffer.from(password).toString('base64'); // Temporary simple encoding

    const supabase = await getServerClient();

    // Insert account
    const { data: account, error: insertError } = await supabase
      .from('lms_accounts')
      .insert({
        kid_id,
        lms_type: 'moodle',
        lms_url: moodle_url,
        lms_user_name: username,
        encrypted_password: encryptedPassword,
        name: `Moodle - ${username}`,
        is_active: false,
        api_token: null
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Test connection immediately
    // TODO: Implement actual Moodle token generation

    return NextResponse.json({ success: true, account });
  } catch (error: any) {
    console.error('Error adding Moodle account:', error);
    return NextResponse.json(
      { error: error.message || String(error) },
      { status: 500 }
    );
  }
}

// DELETE /api/moodle/accounts?id=xxx
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    const supabase = await getServerClient();

    const { error } = await supabase
      .from('lms_accounts')
      .delete()
      .eq('id', parseInt(id));

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
