# What is On Track?

## Overview

**On Track** is a student assignment planner and schedule management system that helps students stay organized across multiple Learning Management Systems (LMS) platforms.

## Core Problem It Solves

Students using multiple LMS platforms (Canvas, Moodle, Google Classroom) struggle with:
- Assignments scattered across different systems
- No unified view of what's due when
- Manual calendar management is time-consuming
- Parents have limited visibility into student workload
- No automatic scheduling based on course patterns

## What On Track Does

### 1. **Unified Assignment Dashboard**
- Syncs assignments from Canvas, Moodle
- Shows all assignments in one place
- Organizes by course, date, or priority
- Tracks completion status

### 2. **Intelligent Plan Date Calculation**
- Automatically calculates when students should work on assignments
- Two strategies:
  - **Position-based** (Moodle/school_id=2): Uses module position and class days
  - **Week-pattern** (Canvas): Uses "Week N" module titles and calendar
- Respects school calendars and holidays
- Preserves manual date changes (via `item_needs_processing` flag)

### 3. **Agenda View**
- Daily view of what to work on
- Shows activities for selected date
- Displays overdue items
- Module navigation (click date → go to module)

### 4. **Grade Tracking**
- Syncs grades from Canvas/Moodle
- Shows assignment scores
- Tracks grade updates
- (Future: GPA calculator)

### 5. **Multi-Student Support**
- Parents can manage multiple kids
- Family relationships allow shared access
- Each student has independent schedule
- Row Level Security (RLS) ensures data privacy

### 6. **Calendar Integration**
- Google Calendar sync
- ICS feed generation for external calendars
- Displays school events alongside assignments

## Key Data Model

### Students (kids)
- Belongs to user (parent)
- Can have multiple courses
- Has activities (assignments, modules)

### Courses
- Linked to school calendar
- Contains modules and assignments
- Syncs from LMS (Canvas/Moodle)
- Has class_days (which days course meets)

### Activities
- Type: module, assignment, page, quiz, discussion
- Has plan_date (when to work on it)
- Can be actionable (`is_action = true`) or reference material
- Tracks completion, time spent, grades

### School Calendars
- Defines school year start/end
- Contains holidays
- Used for plan date calculation

## User Workflows

### For Students:
1. Log in and see today's agenda
2. Click on assignment to view details
3. Mark assignments complete as you work
4. View upcoming deadlines
5. Track grades across all courses

### For Parents:
1. Log in and select which child to view
2. See all assignments and due dates
3. Monitor completion status
4. View grades and progress
5. Manage course setup and LMS connections

### For Sync (Background):
1. User triggers course sync
2. System fetches data from Canvas/Moodle API
3. Upserts modules and assignments to database
4. Marks changed items with `item_needs_processing = true`
5. Calculate plan dates runs (only updates changed items)
6. Clears `item_needs_processing` flag

## Key Technical Features

### Current:
- ✅ Canvas LMS sync
- ✅ Moodle LMS sync
- ✅ Plan date auto-calculation
- ✅ Multi-tenancy with RLS
- ✅ Family relationships
- ✅ Google Calendar integration
- ✅ PWA support
- ✅ Manual plan date overrides preserved
- ✅ Actionable vs non-actionable items

### In Progress:
- Activities table RLS policy (needs deployment)
- Module plan date navigation

### Planned:
- Google Classroom integration
- AI-powered study recommendations
- Email notifications
- Push notifications
- Subscription/payment system
- Enhanced grade analytics

## Data Flow

### LMS Sync Flow:
```
Canvas/Moodle API
  ↓
lib/sync/sync-canvas.ts or sync-moodle.ts
  ↓
safe_sync_upsert_activity_v2 SQL function
  ↓
activities table (with item_needs_processing = true)
  ↓
lib/sync/calculate-dates.ts
  ↓
Updates plan_date for changed items
  ↓
Sets item_needs_processing = false
```

### Viewing Agenda:
```
User selects date
  ↓
get_agenda_data SQL function
  ↓
Filters by:
  - kid_id
  - plan_date
  - is_action = true
  - is_deleted = false
  - School calendar (only current year courses)
  ↓
Returns today's activities + overdue items
```

## User Roles

### Authenticated Users:
- Can have `user_id` in `kids` table (students)
- Can have entries in `family_relationships` (parents)
- Access controlled via RLS policies

### Parents:
- Manage their own kids (`kids.user_id = auth.uid()`)
- Can access children's data via `family_relationships`
- Manage LMS accounts and course setup

### Students:
- View their own activities and courses
- Mark assignments complete
- Track their own progress

## Security Model

### Row Level Security (RLS):
- All tables have RLS policies
- `kids` table: Users can only see their own kids + family relationships
- `courses` table: Scoped to user's kids
- `activities` table: (needs policy) Scoped via courses → kids → user
- `lms_accounts`: Scoped to user's kids
- Service role bypasses RLS (for sync operations)
- Anon key respects RLS (for frontend)

## Future Vision

### Short Term (3 months):
- Google Classroom integration
- Email notifications
- Subscription system
- Marketing website

### Medium Term (6-12 months):
- AI study recommendations
- Native mobile apps
- Advanced grade analytics
- Referral program

### Long Term (12+ months):
- School district partnerships
- SSO for schools
- Teacher collaboration features
- Advanced AI features

## Target Users

### Primary: Homeschool Families
- Need organization across multiple platforms
- Want parental visibility
- Smaller compliance requirements
- Faster sales cycle

### Secondary: Small Private Schools
- Similar needs to homeschool
- May have teacher oversight
- Looking for better tools than LMS native

### Tertiary: Public Schools (Later)
- Requires SOC 2 compliance
- Longer sales cycles
- Larger scale potential

## Current Status

**Stage:** Functional MVP with solid technical foundation

**What Works:**
- Multi-student support with family relationships
- Canvas and Moodle sync
- Plan date calculation
- Agenda view
- Grade tracking
- Calendar integration

**What's Needed for Launch:**
- Subscription/payment system
- Legal docs (ToS, Privacy Policy)
- COPPA compliance
- Marketing website
- Customer support infrastructure

**Technical Debt:**
- Need to add activities RLS policy
- Need comprehensive test coverage
- Need error monitoring (Sentry)
- Need better TypeScript types

---

**Last Updated:** August 22, 2026
