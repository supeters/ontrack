'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

interface SessionReflectionModalProps {
  activityTitle: string;
  minutesWorked: number;
  onComplete: (reflection: { mood?: string; notes?: string }) => void;
  onSkip: () => void;
}

const MOODS = [
  { value: 'struggled', emoji: '😫', label: 'Struggled', color: 'bg-red-100 border-red-300 hover:bg-red-200' },
  { value: 'okay', emoji: '😐', label: 'Okay', color: 'bg-yellow-100 border-yellow-300 hover:bg-yellow-200' },
  { value: 'good', emoji: '🙂', label: 'Good', color: 'bg-blue-100 border-blue-300 hover:bg-blue-200' },
  { value: 'great', emoji: '😊', label: 'Great', color: 'bg-green-100 border-green-300 hover:bg-green-200' },
  { value: 'focused', emoji: '🎯', label: 'Focused', color: 'bg-purple-100 border-purple-300 hover:bg-purple-200' },
];

export default function SessionReflectionModal({
  activityTitle,
  minutesWorked,
  onComplete,
  onSkip,
}: SessionReflectionModalProps) {
  const { theme } = useTheme();
  const [mood, setMood] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  const c = theme?.colors || {
    bg: 'bg-[#f4efe6]',
    cardBg: 'bg-[#fcfaf7]',
    text: 'text-[#3d3122]',
    moduleText: 'text-[#3d3122]',
    mutedText: 'text-[#7d6c59]',
    divider: 'border-[#e0d5c3]',
    checkboxChecked: 'bg-[#8c5a2b]',
  };

  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const handleSave = () => {
    onComplete({ mood: mood || undefined, notes: notes.trim() || undefined });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className={`w-full max-w-md ${c.cardBg} rounded-xl shadow-xl border ${c.divider} overflow-hidden`}>
        {/* Header */}
        <div className={`px-5 py-4 border-b ${c.divider} flex items-center justify-between`}>
          <div>
            <h3 className={`text-lg font-bold ${c.moduleText}`}>🎉 Session Complete!</h3>
            <p className={`text-sm ${c.mutedText} mt-0.5`}>{activityTitle}</p>
          </div>
          <button
            onClick={onSkip}
            className={`${c.mutedText} hover:opacity-70 transition-opacity`}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5">
          {/* Time Summary */}
          <div className={`text-center py-3 rounded-lg bg-gradient-to-r from-purple-50 to-blue-50 border ${c.divider}`}>
            <div className="text-3xl font-bold text-purple-600">⏱️ {formatTime(minutesWorked)}</div>
            <div className={`text-xs ${c.mutedText} mt-1`}>Time worked</div>
          </div>

          {/* Mood Selector */}
          <div>
            <label className={`block font-semibold mb-3 text-sm ${c.moduleText}`}>
              How did it go? (optional)
            </label>
            <div className="grid grid-cols-5 gap-2">
              {MOODS.map((moodOption) => (
                <button
                  key={moodOption.value}
                  onClick={() => setMood(moodOption.value)}
                  className={`
                    flex flex-col items-center gap-1.5 py-3 px-2 rounded-lg border-2 transition-all
                    ${mood === moodOption.value 
                      ? `${moodOption.color} ring-2 ring-offset-1 ring-current scale-105` 
                      : `${c.cardBg} border-gray-200 hover:border-gray-300`
                    }
                  `}
                >
                  <span className="text-2xl">{moodOption.emoji}</span>
                  <span className="text-[10px] font-medium text-gray-700">{moodOption.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className={`block font-semibold mb-2 text-sm ${c.moduleText}`}>
              Any thoughts? (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="How did it go? What did you learn? Anything tough? 💭"
              rows={3}
              className={`
                w-full px-3 py-2 rounded-lg border ${c.divider} ${c.cardBg}
                focus:outline-none focus:ring-2 focus:ring-purple-400
                text-sm ${c.text} placeholder-gray-400
              `}
            />
          </div>
        </div>

        {/* Actions */}
        <div className={`px-5 py-4 border-t ${c.divider} flex gap-3`}>
          <button
            onClick={onSkip}
            className={`
              flex-1 px-4 py-2.5 rounded-lg border ${c.divider}
              font-medium text-sm ${c.mutedText} hover:bg-gray-50 transition-colors
            `}
          >
            Skip
          </button>
          <button
            onClick={handleSave}
            className={`
              flex-1 px-4 py-2.5 rounded-lg ${c.checkboxChecked}
              text-white font-semibold text-sm hover:opacity-90 transition-opacity
            `}
          >
            {mood || notes ? 'Save & Continue' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
