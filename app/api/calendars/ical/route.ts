import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';

// Helper to safely extract integer IDs from simple or composite keys (e.g. "4" or "4:1")
function parseId(rawId: string | null): number | null {
  if (!rawId) return null;
  const parsed = parseInt(rawId.split(':')[0], 10);
  return isNaN(parsed) ? null : parsed;
}

// GET /api/calendars/ical?kidId=xxx - Retrieve all connected iCal feeds for a student
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawKidId = searchParams.get('kidId');
    const kidId = parseId(rawKidId);

    if (!kidId) {
      return NextResponse.json(
        { error: 'Missing or invalid required query parameter: kidId' },
        { status: 400 }
      );
    }

    const supabase = await getServerClient();

    const { data: feeds, error } = await supabase
      .from('calendar_feeds')
      .select('*')
      .eq('kid_id', kidId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error from calendar_feeds GET:', error);
      throw error;
    }

    return NextResponse.json({ feeds: feeds || [] });
  } catch (error: any) {
    console.error('API /api/calendars/ical GET error:', error);
    return NextResponse.json(
      { error: error.message || String(error) },
      { status: 500 }
    );
  }
}

// POST /api/calendars/ical - Add a new iCal feed for a student
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { kidId: rawKidId, name, url } = body;
    const kidId = parseId(String(rawKidId));

    if (!kidId || !name || !url) {
      return NextResponse.json(
        { error: 'Missing or invalid required fields: kidId, name, url' },
        { status: 400 }
      );
    }

    const supabase = await getServerClient();

    const { data: newFeed, error } = await supabase
      .from('calendar_feeds')
      .insert({
        kid_id: kidId,
        name,
        url,
      })
      .select()
      .single();

    if (error) {
      console.error('Error from calendar_feeds POST:', error);
      throw error;
    }

    return NextResponse.json({ feed: newFeed }, { status: 201 });
  } catch (error: any) {
    console.error('API /api/calendars/ical POST error:', error);
    return NextResponse.json(
      { error: error.message || String(error) },
      { status: 500 }
    );
  }
}

// DELETE /api/calendars/ical?feedId=xxx - Remove an existing iCal feed
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawFeedId = searchParams.get('feedId');
    const feedId = parseId(rawFeedId);

    if (!feedId) {
      return NextResponse.json(
        { error: 'Missing or invalid required query parameter: feedId' },
        { status: 400 }
      );
    }

    const supabase = await getServerClient();

    const { error } = await supabase
      .from('calendar_feeds')
      .delete()
      .eq('id', feedId);

    if (error) {
      console.error('Error from calendar_feeds DELETE:', error);
      throw error;
    }

    return NextResponse.json({ message: 'iCal feed deleted successfully' });
  } catch (error: any) {
    console.error('API /api/calendars/ical DELETE error:', error);
    return NextResponse.json(
      { error: error.message || String(error) },
      { status: 500 }
    );
  }
}