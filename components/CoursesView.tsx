'use client';

import { useState, useEffect } from 'react';
import { Book, ChevronRight } from 'lucide-react';
import CourseModuleView from './CourseModuleView';

interface CoursesViewProps {
  kidId: number;
  selectedCourse?: any;
  selectedDate: Date;
}

export default function CoursesView({ kidId, selectedCourse, selectedDate }: CoursesViewProps) {
  if (selectedCourse) {
    return <CourseModuleView course={selectedCourse} kidId={kidId} selectedDate={selectedDate} />;
  }

  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center text-stone-400">
        <Book className="h-16 mb-4 mx-auto w-16" />
        <p className="font-medium text-lg text-stone-600">Select a course to get started</p>
        <p className="text-sm text-stone-500">Choose a course from the sidebar to view your work</p>
      </div>
    </div>
  );
}
