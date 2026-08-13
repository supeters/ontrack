import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI();

export async function POST(req: Request) {
  const { prompt, availableCourses, referenceDate } = await req.json();

  const systemPrompt = `
    You are a natural language parser for student schedules.
    Reference Date: ${referenceDate} (Use this to resolve shorthand dates like "Aug 20th" or "next Tuesday" into YYYY-MM-DD format in the correct year).
    Available Courses: ${JSON.stringify(availableCourses.map((c: any) => ({ id: c.id, name: c.course_name || c.name })))}

    RULES:
    1. Match course names flexibly (e.g., "Ap Latin" or "Latin" maps to the AP Latin course ID). If unsure, output null.
    2. Convert time into 24-hour HH:MM format (e.g., "2:30pm" -> "14:30").
    3. Determine "activityType": default to "event" for open houses, meetings, or games; "assignment" or "task" for homework.
    4. Set "isActionable": false for passive informational events/open houses, true for student tasks/assignments.

    Respond ONLY in this JSON structure:
    {
      "title": "Open House - AP Latin",
      "courseId": number or null,
      "activityType": "event",
      "estimatedMinutes": number or null,
      "planDate": "YYYY-MM-DD",
      "startTime": "HH:MM",
      "isActionable": boolean,
      "isRecurring": false,
      "recurDays": [],
      "endDate": null
    }
  `;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ]
    });

    const parsedData = JSON.parse(completion.choices[0].message.content || '{}');
    return NextResponse.json(parsedData);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to parse activity text' }, { status: 500 });
  }
}