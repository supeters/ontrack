'use client';

import { Calendar, CheckSquare, Clock, BarChart3, Zap, Users } from 'lucide-react';

interface LandingPageProps {
  onGetStarted: () => void;
}

export default function LandingPage({ onGetStarted }: LandingPageProps) {
  const features = [
    {
      icon: Calendar,
      title: 'Intelligent Work Scheduling',
      description: 'Automatically suggests when to work on assignments based on your class schedule. Classes on T/Th? Day 1 work scheduled for Monday, Day 2 for Wednesday, end-of-week for Friday.',
    },
    {
      icon: CheckSquare,
      title: 'LMS Sync',
      description: 'Sync with Canvas and Moodle. All your assignments in one place, automatically imported and scheduled.',
    },
    {
      icon: Clock,
      title: 'Time Tracking',
      description: 'Track how long you actually spend on assignments. Build better time estimates.',
    },
    {
      icon: BarChart3,
      title: 'Progress Insights',
      description: 'See your completion rates, upcoming deadlines, and workload at a glance.',
    },
    {
      icon: Zap,
      title: 'Quick Capture',
      description: 'Add tasks and assignments on the go with natural language. Just type what you need to do.',
    },
    {
      icon: Users,
      title: 'Family Dashboard',
      description: 'Parents can monitor multiple kids. Students manage their own work.',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50">
      {/* Header */}
      <header className="container mx-auto px-4 py-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-orange-600">OnTrack</span>
          </div>
          <button
            onClick={onGetStarted}
            className="text-gray-700 hover:text-orange-600 font-medium px-6 py-2 rounded-lg hover:bg-white/50 transition-all"
          >
            Sign In
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-6xl font-bold text-gray-900 mb-6">
            Stay <span className="text-orange-600">On Track</span>
          </h1>
          <p className="text-2xl text-gray-700 mb-8">
            The student planner that actually helps you get things done
          </p>
          <p className="text-lg text-gray-600 mb-12 max-w-2xl mx-auto">
            The only student planner that intelligently schedules your work based on when your classes meet.
            Sync Canvas and Moodle, get smart suggestions, track your time, and never miss a deadline.
          </p>
          <button
            onClick={onGetStarted}
            className="bg-orange-600 hover:bg-orange-700 text-white font-semibold text-lg px-12 py-4 rounded-lg shadow-lg transition-all transform hover:scale-105"
          >
            Get Started Free
          </button>
          <p className="text-sm text-gray-500 mt-4">
            First 3 families get free access for this year
          </p>
        </div>

        {/* Features Grid */}
        <div className="mt-24 grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={index}
                className="bg-white rounded-xl p-8 shadow-md hover:shadow-xl transition-shadow"
              >
                <div className="bg-orange-100 w-14 h-14 rounded-lg flex items-center justify-center mb-4">
                  <Icon className="h-7 w-7 text-orange-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  {feature.title}
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* How It Works Section */}
        <div className="mt-24 max-w-4xl mx-auto">
          <h2 className="text-4xl font-bold text-center text-gray-900 mb-12">
            How It Works
          </h2>
          <div className="space-y-8">
            <div className="flex items-start gap-6">
              <div className="bg-orange-600 text-white font-bold text-xl w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0">
                1
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Connect Your School Accounts
                </h3>
                <p className="text-gray-600">
                  Sync Canvas and Moodle, or manually add courses. Tell OnTrack when your classes meet (like M/W/F or T/Th).
                </p>
              </div>
            </div>
            <div className="flex items-start gap-6">
              <div className="bg-orange-600 text-white font-bold text-xl w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0">
                2
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Get Smart Suggestions
                </h3>
                <p className="text-gray-600">
                  OnTrack automatically schedules work sessions based on your class meeting days. Day 1 assignments? You'll work on them the day before class.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-6">
              <div className="bg-orange-600 text-white font-bold text-xl w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0">
                3
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Track & Complete
                </h3>
                <p className="text-gray-600">
                  Start work chunks, track your time, and check things off as you go.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Final CTA */}
        <div className="mt-24 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">
            Ready to get organized?
          </h2>
          <button
            onClick={onGetStarted}
            className="bg-orange-600 hover:bg-orange-700 text-white font-semibold text-lg px-12 py-4 rounded-lg shadow-lg transition-all transform hover:scale-105"
          >
            Sign Up Now
          </button>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white mt-24">
        <div className="container mx-auto px-4 py-8 text-center text-gray-600">
          <p>&copy; 2026 OnTrack. Stay on top of your schoolwork.</p>
        </div>
      </footer>
    </div>
  );
}
