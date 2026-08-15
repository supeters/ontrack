'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import { formatDateLocal, formatTimestampLocal } from '@/lib/datetime';

interface ActiveWork {
  activity: any;
  startTime: Date;
  kidId: number;
}

interface ActiveWorkContextType {
  activeWork: ActiveWork | null;
  startWork: (activity: any, kidId: number) => Promise<void>;
  pauseWork: (onComplete?: () => void) => Promise<void>;
  completeWork: (onComplete?: () => void) => Promise<void>;
  elapsedMinutes: () => number;
  restoreActiveWork: (kidId: number) => Promise<void>;
}

const ActiveWorkContext = createContext<ActiveWorkContextType | undefined>(undefined);

export function ActiveWorkProvider({ children }: { children: ReactNode }) {
  const [activeWork, setActiveWork] = useState<ActiveWork | null>(null);

  const restoreActiveWork = async (kidId: number) => {
    if (activeWork || !kidId) return;

    try {
      const response = await fetch(`/api/activities?kid_id=${kidId}`);
      const activities = await response.json();

      // Find actionable activity with start_time set and not completed
      // Exclude events/classes which have start_time but aren't "work sessions"
      const workingActivity = activities.find((a: any) =>
        a.start_time &&
        !a.is_completed &&
        a.is_action &&
        a.activity_type !== 'event' &&
        a.activity_type !== 'class'
      );

      if (workingActivity) {
        setActiveWork({
          activity: workingActivity,
          startTime: new Date(workingActivity.start_time),
          kidId: kidId,
        });
      }
    } catch (error) {
      console.error('Error restoring active work:', error);
    }
  };

  const elapsedMinutes = () => {
    if (!activeWork) return 0;
    return Math.round((new Date().getTime() - activeWork.startTime.getTime()) / 60000);
  };

  const startWork = async (activity: any, kidId: number) => {
    try {
      await fetch('/api/activities', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activityId: activity.id,
          updates: {
            start_time: formatTimestampLocal(new Date()),
          },
        }),
      });

      setActiveWork({ activity, startTime: new Date(), kidId });
    } catch (error) {
      console.error('Error starting work:', error);
    }
  };

  const pauseWork = async (onComplete?: () => void) => {
    if (!activeWork) return;

    const elapsed = elapsedMinutes();

    try {
      // Create a sub-task for this work session
      await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kidId: activeWork.kidId,
          courseId: activeWork.activity.course_id,
          title: `Work session - ${new Date().toLocaleTimeString()}`,
          description: '',
          activityType: 'task',
          planDate: formatDateLocal(new Date()),
          estimatedMinutes: elapsed,
          actualMinutes: elapsed,
          isActionable: false,
          parentActivityId: activeWork.activity.id,
          isCompleted: true,
          completedAt: formatTimestampLocal(new Date()),
        }),
      });

      // Clear start_time on parent activity
      await fetch('/api/activities', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activityId: activeWork.activity.id,
          updates: {
            start_time: null,
          },
        }),
      });

      setActiveWork(null);
      if (onComplete) onComplete();
    } catch (error) {
      console.error('Error pausing work:', error);
    }
  };

  const completeWork = async (onComplete?: () => void) => {
    if (!activeWork) return;

    const elapsed = elapsedMinutes();
    const currentActualMinutes = activeWork.activity.actual_minutes || 0;

    try {
      await fetch('/api/activities', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activityId: activeWork.activity.id,
          updates: {
            is_completed: true,
            completed_at: formatTimestampLocal(new Date()),
            actual_minutes: currentActualMinutes + elapsed,
            start_time: null,
          },
        }),
      });

      setActiveWork(null);
      if (onComplete) onComplete();
    } catch (error) {
      console.error('Error completing work:', error);
    }
  };

  return (
    <ActiveWorkContext.Provider value={{ activeWork, startWork, pauseWork, completeWork, elapsedMinutes, restoreActiveWork }}>
      {children}
    </ActiveWorkContext.Provider>
  );
}

export function useActiveWork() {
  const context = useContext(ActiveWorkContext);
  if (!context) {
    throw new Error('useActiveWork must be used within ActiveWorkProvider');
  }
  return context;
}
