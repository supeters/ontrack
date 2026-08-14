import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: Request) {
  try {
    const { prompt, availableCourses, referenceDate } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const systemInstruction = `
      You are an expert natural language parser for student and homeschool activity schedules.
      Reference Date: ${referenceDate || new Date().toISOString().split('T')[0]} (Use this to resolve relative dates like "Aug 28th", "tomorrow", or "next Tuesday" into YYYY-MM-DD format in the correct year).
      
      Available Courses: ${JSON.stringify(
        (availableCourses || []).map((c: any) => ({
          id: c.id,
          name: c.course_name || c.name,
        }))
      )}

      CRITICAL PARSING RULES:
      1. COURSE MATCHING & TITLE CLEANUP:
         - Flexible match prompt strings against "Available Courses" (e.g., "AP Latin", "Latin", or "Ap Latin" should match the AP Latin course ID).
         - Set "courseId" to the matched course ID (or null if none match).
         - STRIP OUT the matched course name and associated prepositions from "title". For example, "Open house event for AP Latin" MUST become "Open House Event".

      2. DURATION & TIMES:
         - Convert start times into 24-hour HH:MM format (e.g., "6pm to 7pm" -> startTime: "18:00").
         - Calculate "estimatedMinutes" from time ranges (e.g., "6pm to 7pm" = 60 minutes).

      3. ACTIVITY TYPE CLASSIFICATION:
         - "event": open houses, meetings, orientations, games, practices, parties.
         - "class": recurring live classes or lectures.
         - "assignment": homework, quizzes, tests, essays, projects.
         - "task": general actionable to-dos.

      4. ACTIONABLE STATUS:
         - Set "isActionable" to false for "event" or "class".
         - Set "isActionable" to true for "assignment" or "task".
    `;

    const model = genAI.getGenerativeModel({
      model: 'gemini-3.5-flash',
      systemInstruction,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            title: { type: SchemaType.STRING },
            courseId: { type: SchemaType.INTEGER, nullable: true },
            activityType: { type: SchemaType.STRING },
            estimatedMinutes: { type: SchemaType.INTEGER, nullable: true },
            planDate: { type: SchemaType.STRING },
            startTime: { type: SchemaType.STRING, nullable: true },
            isActionable: { type: SchemaType.BOOLEAN },
            isRecurring: { type: SchemaType.BOOLEAN },
            recurDays: {
              type: SchemaType.ARRAY,
              items: { type: SchemaType.INTEGER },
            },
            endDate: { type: SchemaType.STRING, nullable: true },
          },
          required: [
            'title',
            'activityType',
            'planDate',
            'isActionable',
            'isRecurring',
          ],
        },
      },
    });

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const parsedData = JSON.parse(text || '{}');

    return NextResponse.json(parsedData);
  } catch (error) {
    console.error('Gemini parsing error:', error);
    return NextResponse.json(
      { error: 'Failed to parse natural language intent' },
      { status: 500 }
    );
  }
}