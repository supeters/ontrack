import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/service';

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const kidId = searchParams.get('kidId');

    if (!kidId) {
      return NextResponse.json({ error: 'Missing kidId' }, { status: 400 });
    }

    const supabase = getServiceRoleClient();

    // Delete watch channel
    await supabase
      .from('google_watch_channels')
      .delete()
      .eq('kid_id', kidId);

    // Delete sync tokens
    await supabase
      .from('google_sync_tokens')
      .delete()
      .eq('kid_id', kidId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('API /api/auth/google/disconnect DELETE error:', error);
    return NextResponse.json(
      { error: error.message || String(error) },
      { status: 500 }
    );
  }
}