cat > "c:/Users/Susan/source/repos/ontrack-next/docs/TIME_TRACKING_AND_INSIGHTS.md" << 'EOF'
# Time Tracking & Productivity Insights for OnTrack

## Current Time Tracking Data Available

OnTrack already captures:
- `estimated_minutes` - How long assignment should take (from LMS or manual)
- `start_time` - When student started working
- `end_time` - When student finished working
- `minutes_worked` - Accumulated work time (can be across multiple sessions)
- `actual_minutes` - Final time spent
- `completed_at` - When marked complete
- `is_completed` - Completion status
- `plan_date` - When student planned to work on it
- `planning_bucket` - Task prioritization bucket

---

## Time Tracking Features to Add

### **1. Study Timer / Pomodoro Timer** ⭐ (Highest priority)

**What it is:**
- Built-in timer when working on assignments
- Tracks start/stop automatically
- Pomodoro technique (25 min work, 5 min break)
- Updates `start_time`, `end_time`, `minutes_worked` in real-time

**UI:**
```
┌─────────────────────────────────┐
│ Math Homework - Chapter 5        │
│                                  │
│         ⏱️ 23:45                 │
│      [Pomodoro 1 of 2]          │
│                                  │
│  [⏸️ Pause]    [✓ Complete]     │
└─────────────────────────────────┘

Break time! Take 5 minutes
└─────────────────────────────────┘
```

**Database changes:**
```sql
-- Track individual work sessions
CREATE TABLE work_sessions (
  id SERIAL PRIMARY KEY,
  activity_id INTEGER REFERENCES activities(id),
  kid_id INTEGER REFERENCES kids(id),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  minutes_worked INTEGER,
  session_type TEXT, -- 'pomodoro', 'regular', 'break'
  interruptions INTEGER DEFAULT 0,
  focus_score INTEGER, -- 1-10 self-reported
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Implementation:**
- `components/StudyTimer.tsx` - Timer UI
- `hooks/useStudyTimer.ts` - Timer logic
- `app/api/sessions/start/route.ts` - Start session
- `app/api/sessions/end/route.ts` - End session

---

### **2. Time Estimation Accuracy Tracker** ⭐⭐

**What it does:**
- Compares `estimated_minutes` vs `actual_minutes`
- Shows how accurate estimates are
- Learns patterns (e.g., "Math always takes 2x longer")

**Insights:**
```
📊 Your Estimation Accuracy

Overall: 73% accurate (you usually underestimate by 27%)

By Subject:
- Math: 150% (takes 1.5x longer than estimated)
- History: 85% (pretty accurate!)
- Science: 120% (takes 20% longer)

By Assignment Type:
- Essays: 200% (takes 2x longer - build in more time!)
- Quizzes: 90% (good estimates)
- Reading: 110%
```

**SQL Query:**
```sql
SELECT 
  c.name as course_name,
  a.activity_type,
  AVG(a.estimated_minutes) as avg_estimated,
  AVG(a.actual_minutes) as avg_actual,
  AVG(a.actual_minutes::float / NULLIF(a.estimated_minutes, 0)) as accuracy_ratio,
  COUNT(*) as total_completed
FROM activities a
JOIN courses c ON a.course_id = c.id
WHERE a.is_completed = true
  AND a.kid_id = $1
  AND a.actual_minutes IS NOT NULL
  AND a.estimated_minutes > 0
GROUP BY c.name, a.activity_type
ORDER BY total_completed DESC;
```

---

### **3. Daily/Weekly Time Analytics** ⭐⭐

**What it shows:**
- How much time studied each day
- Peak productivity hours
- Time per course/subject
- Comparison to goals

**Dashboard:**
```
📈 This Week's Study Time

Total: 18.5 hours (Goal: 20 hours)

By Day:
Mon ████████░░ 2.5 hrs
Tue ██████████ 3.0 hrs
Wed ████░░░░░░ 1.5 hrs (low!)
Thu ██████████ 3.0 hrs
Fri ████████░░ 2.5 hrs
Sat ██████████ 3.5 hrs
Sun ████████░░ 2.5 hrs

Peak Hours: 3pm-5pm (45% of study time)

By Course:
Math      ████████ 6 hrs
History   ██████ 4.5 hrs
Science   ████████ 6 hrs
English   ████ 2 hrs
```

**Implementation:**
```typescript
// lib/analytics/time-insights.ts
export async function getWeeklyTimeBreakdown(kidId: number, weekStart: Date) {
  const sessions = await supabase
    .from('work_sessions')
    .select(`
      *,
      activities(course_id, activity_type),
      courses(name)
    `)
    .eq('kid_id', kidId)
    .gte('start_time', weekStart)
    .order('start_time');
  
  return {
    totalMinutes: sessions.reduce((sum, s) => sum + s.minutes_worked, 0),
    byDay: groupByDay(sessions),
    byCourse: groupByCourse(sessions),
    peakHours: findPeakHours(sessions)
  };
}
```

---

### **4. Productivity Score & Trends** ⭐⭐⭐

**What it calculates:**
- On-time completion rate
- Procrastination index (how often tasks are moved)
- Focus consistency (regular study vs cramming)
- Time efficiency (actual vs estimated)

**Score Card:**
```
🎯 Nathan's Productivity Score: 78/100

✅ Strengths:
- On-time completion: 85% (↑ 5% from last month)
- Study consistency: Daily streak of 12 days
- Time efficiency: Math 90% accurate

⚠️ Areas to Improve:
- Procrastination: Science assignments moved 3x on average
- Weekend planning: Only 40% completion on Sundays
- Late-night cramming: 25% of work done after 9pm

📊 Trend: Improving! +8 points from last month
```

**Calculation:**
```typescript
interface ProductivityScore {
  overall: number; // 0-100
  breakdown: {
    onTimeRate: number;
    consistency: number;
    efficiency: number;
    planning: number;
  };
  trends: {
    weekOverWeek: number;
    monthOverMonth: number;
  };
}

export async function calculateProductivityScore(
  kidId: number, 
  period: 'week' | 'month'
): Promise<ProductivityScore> {
  // On-time rate (40% of score)
  const completionStats = await getCompletionStats(kidId, period);
  const onTimeRate = completionStats.onTime / completionStats.total;
  
  // Consistency (30% of score) 
  const studyDays = await getStudyDaysCount(kidId, period);
  const totalDays = period === 'week' ? 7 : 30;
  const consistency = studyDays / totalDays;
  
  // Efficiency (20% of score)
  const efficiency = await getTimeEstimationAccuracy(kidId, period);
  
  // Planning (10% of score)
  const planningScore = await getPlanningScore(kidId, period);
  
  const overall = 
    (onTimeRate * 40) + 
    (consistency * 30) + 
    (efficiency * 20) + 
    (planningScore * 10);
  
  return {
    overall: Math.round(overall),
    breakdown: { onTimeRate, consistency, efficiency, planning: planningScore },
    trends: await getTrends(kidId)
  };
}
```

---

### **5. Focus Mode & Distraction Tracking** ⭐⭐⭐

**What it does:**
- "Focus Mode" button that minimizes distractions
- Tracks interruptions (student marks "got distracted")
- Records focus score after each session

**UI:**
```
┌─────────────────────────────────┐
│ 🎯 FOCUS MODE ACTIVE            │
│                                  │
│ Math Homework                    │
│ ⏱️ 15:23 / 30:00               │
│                                  │
│ [😐 Got Distracted]             │
│                                  │
│ Distractions: 2                  │
└─────────────────────────────────┘

[After session]
How focused were you? 
😫 1  😐 2  🙂 3  😊 4  🎯 5
```

**Analytics:**
```
🧠 Focus Insights

Average Focus Score: 3.8/5

Best Focus Times:
- Morning (9-11am): 4.5/5
- Afternoon (2-4pm): 4.0/5

Worst Focus Times:
- Late evening (8-10pm): 2.5/5

Typical Distractions: 3 per hour
Improvement: -1 distraction from last week!

💡 Tip: Schedule hard tasks in morning when focus is highest
```

---

### **6. Course Workload Heatmap** ⭐⭐

**What it shows:**
- Visual calendar showing workload density
- Color-coded by time spent
- Identifies heavy weeks vs light weeks

**Visual:**
```
October Workload Calendar

    Mon   Tue   Wed   Thu   Fri   Sat   Sun
     1🟢   2🟡   3🟢   4🔴   5🟡   6🟢   7🟢
     8🟡   9🔴  10🟢  11🟡  12🟢  13🟢  14🔴
    15🟢  16🟡  17🟡  18🔴  19🟢  20🟢  21🟡

🟢 Light (<2 hrs)  🟡 Medium (2-4 hrs)  🔴 Heavy (4+ hrs)

Heavy Days Coming:
- Oct 9: 5.5 hrs (Midterms)
- Oct 14: 4.5 hrs (Multiple deadlines)
- Oct 18: 6 hrs (Projects due)

💡 Consider redistributing tasks from Oct 9 to Oct 8
```

---

### **7. Study Streaks & Habits** ⭐⭐

**What it tracks:**
- Consecutive days studied
- Longest streak
- Daily study time consistency
- Habit formation

**Display:**
```
🔥 Current Streak: 12 Days!

Your longest streak: 18 days (Sep 1-18)

Study Habit:
Mon-Fri: ████████░░ 85% consistent
Weekends: ██████░░░░ 60% consistent

🎯 Goal: Study every weekday for a month
Progress: 12/20 days ▓▓▓▓▓▓░░░░

Badges Earned:
🏆 Week Warrior (7-day streak)
⭐ Consistency King (10-day streak)
🔥 On Fire (15-day streak) - Coming soon!
```

---

### **8. Parent Dashboard Insights** ⭐⭐⭐

**What parents see:**
- Total study time per child
- Productivity trends
- Time per subject
- Alerts for concerning patterns

**Parent View:**
```
👨‍👩‍👧 Family Study Overview

Nathan (7th Grade)
  This week: 18.5 hrs
  Productivity: 78/100 (↑ 8)
  Focus score: 3.8/5
  ✅ On track

Hadasa (9th Grade)  
  This week: 22 hrs
  Productivity: 85/100 (↑ 2)
  Focus score: 4.2/5
  ✅ Doing great!

Kezia (11th Grade)
  This week: 12 hrs (↓ from 20)
  Productivity: 65/100 (↓ 15)
  Focus score: 2.9/5
  ⚠️ Check in needed

Alerts:
- Kezia: Study time dropped 40% this week
- Nathan: 3 assignments moved to last minute
- Hadasa: Maintaining excellent habits! 🎉
```

---

## Implementation Priority

### **Phase 1: Foundation** (2-3 weeks)
1. **Study Timer Component** - Basic timer for activities
2. **Work Sessions Table** - Track individual study sessions
3. **Basic Time Analytics** - Daily/weekly charts

### **Phase 2: Insights** (3-4 weeks)
4. **Productivity Score** - Calculate and display
5. **Time Estimation Accuracy** - Show over/under estimates
6. **Course Workload Heatmap** - Visual calendar

### **Phase 3: Advanced** (4-6 weeks)
7. **Focus Mode** - Distraction tracking
8. **Study Streaks** - Gamification
9. **Parent Dashboard** - Family insights
10. **AI Recommendations** - Integrate AI with time data

---

## Technical Architecture

### **New Components:**
```
components/
  ├── StudyTimer.tsx - Pomodoro timer UI
  ├── TimeAnalyticsDashboard.tsx - Charts and insights
  ├── ProductivityScoreCard.tsx - Score display
  ├── FocusMode.tsx - Focus session UI
  └── WorkloadHeatmap.tsx - Calendar heatmap
```

### **New API Routes:**
```
app/api/
  ├── sessions/
  │   ├── start/route.ts - Begin work session
  │   ├── end/route.ts - End work session
  │   └── track-distraction/route.ts
  ├── analytics/
  │   ├── productivity-score/route.ts
  │   ├── time-breakdown/route.ts
  │   └── focus-insights/route.ts
```

### **New Database Tables:**
```sql
-- Work sessions (individual study periods)
CREATE TABLE work_sessions (
  id SERIAL PRIMARY KEY,
  activity_id INTEGER REFERENCES activities(id),
  kid_id INTEGER REFERENCES kids(id),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  minutes_worked INTEGER,
  session_type TEXT,
  interruptions INTEGER DEFAULT 0,
  focus_score INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Study goals
CREATE TABLE study_goals (
  id SERIAL PRIMARY KEY,
  kid_id INTEGER REFERENCES kids(id),
  goal_type TEXT, -- 'daily_minutes', 'weekly_minutes', 'streak'
  target_value INTEGER,
  current_value INTEGER DEFAULT 0,
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Productivity snapshots (for trending)
CREATE TABLE productivity_snapshots (
  id SERIAL PRIMARY KEY,
  kid_id INTEGER REFERENCES kids(id),
  snapshot_date DATE NOT NULL,
  overall_score INTEGER,
  on_time_rate NUMERIC,
  consistency_score NUMERIC,
  efficiency_score NUMERIC,
  total_minutes INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Data Flow Examples

### **Starting a Study Session:**
```
1. Student clicks "Start Timer" on assignment
   ↓
2. POST /api/sessions/start
   - Creates work_session record
   - Sets start_time
   - Updates activity.start_time if first session
   ↓
3. Timer runs in UI (useStudyTimer hook)
   ↓
4. Student clicks "Pause" or "Complete"
   ↓
5. POST /api/sessions/end
   - Updates work_session.end_time
   - Calculates minutes_worked
   - Updates activity.minutes_worked (cumulative)
   - If complete: sets activity.actual_minutes
```

### **Viewing Analytics:**
```
1. Student visits /analytics or /dashboard
   ↓
2. GET /api/analytics/productivity-score
   - Queries activities, work_sessions
   - Calculates scores
   - Returns breakdown
   ↓
3. GET /api/analytics/time-breakdown?period=week
   - Queries work_sessions for date range
   - Groups by day, course, time-of-day
   - Returns chart data
   ↓
4. UI displays charts, scores, insights
```

---

## Integration with AI

Once time tracking is in place, AI can:
- Predict how long assignments will take based on history
- Suggest optimal study times based on focus patterns
- Identify burnout risk (too many long sessions)
- Recommend breaks based on session data
- Generate personalized productivity tips

**Example AI Prompt:**
```
Based on this student's time tracking data:
- Average focus score: 3.2/5
- Best focus time: 9-11am (4.5/5 avg)
- Worst focus time: 8-10pm (2.1/5 avg)
- Current schedule: Studying Math at 9pm

Generate a short recommendation for better timing.
```

**AI Response:**
"📊 Your focus is 2x better in the morning! Try doing Math homework at 9am instead of 9pm - you'll finish faster and retain more."

---

## Metrics to Track

### **For Students:**
- Total study time (daily, weekly, monthly)
- Time per course
- On-time completion rate
- Productivity score trend
- Focus score average
- Estimation accuracy
- Longest study streak

### **For Parents:**
- Each child's total time
- Productivity scores
- Alerts for concerning patterns
- Comparison across children (private)

### **For Product:**
- Average study time per user
- Timer usage rate
- Productivity score distribution
- Feature engagement

---

## MVP Recommendation

**Start with:**
1. Basic Study Timer (no Pomodoro yet)
2. Work Sessions table
3. Simple time analytics (daily/weekly totals)
4. Estimation accuracy tracker

**Why:**
- Immediate utility (students can track time)
- Builds data foundation for future insights
- Low complexity, high value
- Can iterate based on usage

**Cost:**
- No external services needed
- Pure database queries
- ~1-2 weeks development

Would you like me to start implementing the Study Timer component as a proof of concept?
EOF