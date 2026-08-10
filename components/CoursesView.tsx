'use client';

import { useState, useEffect } from 'react';
import { Book, ChevronRight } from 'lucide-react';
import CourseModuleView from './CourseModuleView';

interface CoursesViewProps {
  kidId: number;
  selectedCourse?: any;
}

export default function CoursesView({ kidId, selectedCourse }: CoursesViewProps) {
  if (selectedCourse) {
    return <CourseModuleView course={selectedCourse} kidId={kidId} />;
  }

  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center text-stone-400">
        <Book className="w-16 h-16 mx-auto mb-4" />
        <p className="text-lg font-medium text-stone-600">Select a course to get started</p>
        <p className="text-sm text-stone-500">Choose a course from the sidebar to view your work</p>
      </div>
    </div>
  );
}
