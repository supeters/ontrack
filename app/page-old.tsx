'use client';

import { useState, useEffect } from 'react';
import AgendaView from '@/components/AgendaView';
import PlannerView from '@/components/PlannerView';
import CoursesView from '@/components/CoursesView';
import { Calendar, LayoutGrid, User, Book } from 'lucide-react';

export default function Home() {
  const [kidId, setKidId] = useState(1);
  const [kids, setKids] = useState<any[]>([]);
  const [activeView, setActiveView] = useState<'agenda' | 'planner' | 'courses'>('agenda');

  useEffect(() => {
    loadKids();
  }, []);

  const loadKids = async () => {
    try {
      const response = await fetch('/api/kids');
      const data = await response.json();
      setKids(data);
      if (data.length > 0 && !kidId) {
        setKidId(data[0].id);
      }
    } catch (error) {
      console.error('Error loading kids:', error);
    }
  };

  return (
    <main className="h-screen flex flex-col">
      {/* Navigation Tabs */}
      <div className="bg-white border-b">
        <div className="flex items-center justify-between">
          <div className="flex">
            <button
              onClick={() => setActiveView('agenda')}
              className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors ${
                activeView === 'agenda'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Calendar className="w-4 h-4" />
              Agenda
            </button>
            <button
              onClick={() => setActiveView('planner')}
              className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors ${
                activeView === 'planner'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              Planner
            </button>
            <button
              onClick={() => setActiveView('courses')}
              className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors ${
                activeView === 'courses'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Book className="w-4 h-4" />
              Courses
            </button>
          </div>

          {/* Kid Selector */}
          {kids.length > 0 && (
            <div className="flex items-center gap-2 px-6">
              <User className="w-4 h-4 text-gray-600" />
              <select
                value={kidId}
                onChange={(e) => setKidId(parseInt(e.target.value))}
                className="border rounded px-3 py-1.5 text-sm"
              >
                {kids.map((kid) => (
                  <option key={kid.id} value={kid.id}>
                    {kid.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* View Content */}
      <div className="flex-1 overflow-hidden">
        {activeView === 'agenda' && <AgendaView kidId={kidId} />}
        {activeView === 'planner' && <PlannerView kidId={kidId} />}
        {activeView === 'courses' && <CoursesView kidId={kidId} />}
      </div>
    </main>
  );
}
