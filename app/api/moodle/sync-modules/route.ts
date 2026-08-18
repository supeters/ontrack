import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';
import { spawn } from 'child_process';
import path from 'path';

// POST /api/moodle/sync-modules - Sync course modules with streaming output
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { courseIds, mode = 'incremental' } = body; // Array of course IDs to sync, mode: incremental or all

    if (!courseIds || !Array.isArray(courseIds) || courseIds.length === 0) {
      return NextResponse.json({ error: 'Missing courseIds array' }, { status: 400 });
    }

    if (!['incremental', 'all'].includes(mode)) {
      return NextResponse.json({ error: 'Invalid mode. Must be incremental or all' }, { status: 400 });
    }

    const supabase = await getServerClient();

    // Verify all courses exist and have lms_course_id
    const { data: courses, error: coursesError } = await supabase
      .from('courses')
      .select('id, course_name, lms_course_id')
      .in('id', courseIds);

    if (coursesError) throw coursesError;

    if (!courses || courses.length === 0) {
      return NextResponse.json({ error: 'No courses found' }, { status: 404 });
    }

    const missingLmsId = courses.filter(c => !c.lms_course_id);
    if (missingLmsId.length > 0) {
      return NextResponse.json({
        error: `Courses missing lms_course_id: ${missingLmsId.map(c => c.course_name).join(', ')}`
      }, { status: 400 });
    }

    // Create a streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const syncScriptPath = path.join(process.cwd(), 'scripts', 'sync-course-modules.mjs');
        const planDatesScriptPath = path.join(process.cwd(), 'scripts', 'calculate-plan-dates-v2.mjs');
        for (const course of courses) {
          // Step 1: Sync modules from Moodle
          const syncMessage = `\n📚 Syncing modules: ${course.course_name} (ID: ${course.id})\n`;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ message: syncMessage })}\n\n`));

          await new Promise<void>((resolve) => {
            const child = spawn('node', [syncScriptPath, '--course', course.id.toString(), '--mode', mode], {
              cwd: process.cwd()
            });

            child.stdout.on('data', (data) => {
              const output = data.toString();
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ message: output })}\n\n`));
            });

            child.stderr.on('data', (data) => {
              const output = data.toString();
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: output })}\n\n`));
            });

            child.on('close', (code) => {
              if (code === 0) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                  message: `✅ Module sync completed\n`
                })}\n\n`));
              } else {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                  error: `❌ Module sync failed (exit code ${code})\n`
                })}\n\n`));
              }
              resolve();
            });
          });

          // Step 2: Calculate plan dates
          const planMessage = `\n📅 Calculating plan dates: ${course.course_name}\n`;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ message: planMessage })}\n\n`));

          await new Promise<void>((resolve) => {
            const args = [planDatesScriptPath, '--course', course.id.toString()];
                if (mode === 'incremental') {
                  args.push('--incremental');
                }
                const child = spawn('node', args, {
              cwd: process.cwd()
            });

            child.stdout.on('data', (data) => {
              const output = data.toString();
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ message: output })}\n\n`));
            });

            child.stderr.on('data', (data) => {
              const output = data.toString();
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: output })}\n\n`));
            });

            child.on('close', (code) => {
              if (code === 0) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                  message: `✅ Plan dates calculated\n\n`
                })}\n\n`));
              } else {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                  error: `❌ Plan dates failed (exit code ${code})\n`
                })}\n\n`));
              }
              resolve();
            });
          });
        }

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          message: '\n🎉 All courses synced and plan dates calculated!\n',
          done: true
        })}\n\n`));
        controller.close();
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
    console.error('Error syncing modules:', error);
    return NextResponse.json(
      { error: error.message || String(error) },
      { status: 500 }
    );
  }
}
