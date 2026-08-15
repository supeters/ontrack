import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';
import { spawn } from 'child_process';
import path from 'path';

// POST /api/moodle/calculate-plan-dates - Calculate plan dates for course activities with streaming output
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { courseIds } = body; // Array of course IDs

    if (!courseIds || !Array.isArray(courseIds) || courseIds.length === 0) {
      return NextResponse.json({ error: 'Missing courseIds array' }, { status: 400 });
    }

    const supabase = await getServerClient();

    // Verify all courses exist
    const { data: courses, error: coursesError } = await supabase
      .from('courses')
      .select('id, course_name')
      .in('id', courseIds);

    if (coursesError) throw coursesError;

    if (!courses || courses.length === 0) {
      return NextResponse.json({ error: 'No courses found' }, { status: 404 });
    }

    // Create a streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const planDatesScriptPath = path.join(process.cwd(), 'scripts', 'calculate-plan-dates.mjs');

        for (const course of courses) {
          const planMessage = `\n📅 Calculating plan dates: ${course.course_name} (ID: ${course.id})\n`;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ message: planMessage })}\n\n`));

          await new Promise<void>((resolve) => {
            const child = spawn('node', [planDatesScriptPath, '--course', course.id.toString()], {
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
                  message: `✅ Plan dates calculated\n`
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
          message: '\n🎉 All plan dates calculated!\n',
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
    console.error('Error calculating plan dates:', error);
    return NextResponse.json(
      { error: error.message || String(error) },
      { status: 500 }
    );
  }
}
