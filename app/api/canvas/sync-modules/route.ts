import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';
import { spawn } from 'child_process';
import path from 'path';

/**
 * POST /api/canvas/sync-modules
 * Sync Canvas modules for selected courses with streaming output
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { courseIds, courseId, mode, syncType } = body;

    // Accept either courseIds (array) or courseId (single)
    const coursesToSync = courseIds || (courseId ? [courseId] : []);

    if (!Array.isArray(coursesToSync) || coursesToSync.length === 0) {
      return NextResponse.json({ error: 'Missing or invalid courseIds/courseId' }, { status: 400 });
    }

    // Accept either mode or syncType, map 'full' to 'all'
    const syncMode = mode || syncType || 'incremental';
    const finalMode = syncMode === 'full' ? 'all' : syncMode;

    if (!['incremental', 'all'].includes(finalMode)) {
      return NextResponse.json({ error: 'Invalid mode. Must be incremental, all, or full' }, { status: 400 });
    }

    const supabase = await getServerClient();

    // Get course details
    const { data: courses, error: coursesError } = await supabase
      .from('courses')
      .select('id, course_name, lms_course_id')
      .in('id', coursesToSync);

    if (coursesError) throw coursesError;

    // Create a streaming response
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        try {
          for (const course of courses || []) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'start', course: course.course_name })}\n\n`));

            // Spawn the sync script
            const syncScriptPath = path.join(process.cwd(), 'scripts', 'sync-canvas-bulk.mjs');
            const child = spawn('node', [syncScriptPath, '--course', course.id.toString(), '--mode', finalMode], {
              cwd: process.cwd()
            });

            // Stream output
            await new Promise<void>((resolve, reject) => {
              child.stdout?.on('data', (data) => {
                const lines = data.toString().split('\n').filter((l: string) => l.trim());
                lines.forEach((line: string) => {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'log', message: line })}\n\n`));
                });
              });

              child.stderr?.on('data', (data) => {
                const lines = data.toString().split('\n').filter((l: string) => l.trim());
                lines.forEach((line: string) => {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: line })}\n\n`));
                });
              });

              child.on('close', (code) => {
                if (code === 0) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'complete', course: course.course_name })}\n\n`));
                  resolve();
                } else {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: `Process exited with code ${code}` })}\n\n`));
                  reject(new Error(`Process exited with code ${code}`));
                }
              });

              child.on('error', (error) => {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`));
                reject(error);
              });
            });
          }

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
        } catch (error: any) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`));
        } finally {
          controller.close();
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    console.error('Canvas sync-modules error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to sync Canvas modules' },
      { status: 500 }
    );
  }
}
