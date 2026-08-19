'use client';

import React, { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  DragStartEvent,
  DragEndEvent,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';

// Types
export interface AgendaItem {
  id: string;
  title: string;
  course_id: number;
  course_name: string;
  due_date: string; // YYYY-MM-DD
}

export interface Course {
  id: number;
  name: string;
}

interface AgendaSwimlaneProps {
  dates: string[]; // e.g., ['2026-05-04', '2026-05-05', '2026-05-06']
  courses: Course[];
  initialItems: AgendaItem[];
  onDateChange: (itemId: string, newDate: string) => Promise<void>;
}

// Main Swimlane Component
export default function AgendaSwimlane({
  dates,
  courses,
  initialItems,
  onDateChange,
}: AgendaSwimlaneProps) {
  const [items, setItems] = useState<AgendaItem[]>(initialItems);
  const [activeItem, setActiveItem] = useState<AgendaItem | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 }, // Prevents accidental drag when clicking
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const item = items.find((i) => i.id === event.active.id);
    if (item) setActiveItem(item);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveItem(null);

    if (!over) return;

    // Target drop cell format: `${course_id}__${date}`
    const [targetCourseIdStr, targetDate] = String(over.id).split('__');
    const targetCourseId = parseInt(targetCourseIdStr, 10);

    const item = items.find((i) => i.id === active.id);
    if (!item) return;

    // GUARDRAIL: Strict checks against moving across courses or dropping on same date
    if (item.course_id !== targetCourseId || item.due_date === targetDate) {
      return;
    }

    // Optimistic state update
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, due_date: targetDate } : i))
    );

    // Persist via API callback
    try {
      await onDateChange(item.id, targetDate);
    } catch (error) {
      console.error('Failed to update due date:', error);
      // Revert optimistic update on error
      setItems(initialItems);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="bg-white border overflow-x-auto rounded-lg shadow-sm">
        <div className="min-w-[800px]">
          {/* Header Row: Dates */}
          <div className="bg-gray-100 border-b font-semibold grid grid-cols-[200px_repeat(auto-fit,minmax(150px,1fr))] text-gray-700">
            <div className="border-r p-3">Course</div>
            {dates.map((date) => (
              <div key={date} className="border-r last:border-r-0 p-3 text-center">
                {date}
              </div>
            ))}
          </div>

          {/* Swimlane Rows: One row per course */}
          {courses.map((course) => (
            <div
              key={course.id}
              className="border-b grid grid-cols-[200px_repeat(auto-fit,minmax(150px,1fr))] last:border-b-0 min-h-[100px]"
            >
              {/* Left Header Column */}
              <div className="bg-gray-50 border-r flex font-medium items-center p-3 text-gray-800">
                {course.name}
              </div>

              {/* Date Cells */}
              {dates.map((date) => {
                const cellItems = items.filter(
                  (i) => i.course_id === course.id && i.due_date === date
                );

                return (
                  <DroppableCell
                    key={`${course.id}__${date}`}
                    id={`${course.id}__${date}`}
                    courseId={course.id}
                    activeItem={activeItem}
                  >
                    {cellItems.map((item) => (
                      <DraggableCard key={item.id} item={item} />
                    ))}
                  </DroppableCell>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Drag Overlay for Smooth Visual Representation */}
      <DragOverlay>
        {activeItem ? <CardContent item={activeItem} isDragging /> : null}
      </DragOverlay>
    </DndContext>
  );
}

// Droppable Cell Wrapper
function DroppableCell({
  id,
  courseId,
  activeItem,
  children,
}: {
  id: string;
  courseId: number;
  activeItem: AgendaItem | null;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  // Visually dim rows that belong to other courses during a drag operation
  const isValidTarget = !activeItem || activeItem.course_id === courseId;

  return (
    <div
      ref={setNodeRef}
      className={`p-2 border-r last:border-r-0 transition-colors ${
        !isValidTarget
          ? 'bg-gray-100 opacity-40'
          : isOver
          ? 'bg-blue-50 border-blue-300'
          : 'bg-white'
      }`}
    >
      {children}
    </div>
  );
}

// Draggable Card Wrapper
function DraggableCard({ item }: { item: AgendaItem }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: item.id,
    });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        className="bg-blue-50/50 border-2 border-blue-400 border-dashed h-12 my-1 rounded-md"
      />
    );
  }

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <CardContent item={item} />
    </div>
  );
}

// Card View Component
function CardContent({
  item,
  isDragging,
}: {
  item: AgendaItem;
  isDragging?: boolean;
}) {
  return (
    <div
      className={`p-2 my-1 rounded border text-sm bg-white shadow-sm cursor-grab active:cursor-grabbing transition-shadow ${
        isDragging
          ? 'shadow-lg border-blue-500 scale-105'
          : 'hover:border-gray-400'
      }`}
    >
      <p className="font-medium text-gray-800">{item.title}</p>
    </div>
  );
}

