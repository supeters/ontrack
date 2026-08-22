import { NextRequest, NextResponse } from 'next/server';
import { syncCourses } from '@/lib/sync/orchestrator';

/**
 * Unified Course Sync API
 *
 * POST /api/sync-courses
 *
 * Body:
 *   - kid_id: number (optional) - Sync all courses for this kid
 *   - course_id: number (optional) - Sync just this single course
 *   - course_ids: number[] (optional) - Sync specific courses
 *   - calculate_dates: boolean (default: true) - Whether to calculate plan dates after sync
 *   - school_year: string (optional) - Filter courses by school year
 *
 * Returns: Server-Sent Events stream with progress updates
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { kid_id, course_id, course_ids, school_year, calculate_dates = true } = body;

    if (!kid_id && !course_id && !course_ids) {
      return NextResponse.json(
        { error: 'Must provide kid_id, course_id, or course_ids' },
        { status: 400 }
      );
    }

    // Create streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendMessage = (message: string, data?: any) => {
          const payload: any = { message };
          if (data) {
            Object.assign(payload, data);
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        };

        try {
          // Call the sync orchestrator with progress callback
          const result = await syncCourses({
            kid_id,
            course_id,
            course_ids,
            school_year,
            calculate_dates,
            onProgress: (message, data) => {
              sendMessage(message, data);
            }
          });

          // Send final result
          sendMessage('', {
            type: 'done',
            succeeded: result.succeeded,
            failed: result.failed,
            total: result.total
          });

        } catch (error: any) {
          sendMessage(`Fatal error: ${error.message}`, { type: 'error' });
          console.error('Sync error:', error);
        } finally {
          controller.close();
        }
      }
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error: any) {
    console.error('API /api/sync-courses POST error:', error);
    return NextResponse.json(
      { error: error.message || String(error) },
      { status: 500 }
    );
  }
}
