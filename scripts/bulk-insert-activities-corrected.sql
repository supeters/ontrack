-- Bulk insert activities for Unit 1: Kinematics with Calculus
-- Based on Unit 1 Pacing Guide with correct dates
-- All activities are assignments with is_action_override = true
-- Sub-types: presentation, video, quiz, test, lab, practice, discussion, virtual_activity
-- Course ID: 74, Kid ID: 1, Module ID: 26798

INSERT INTO activities (
  kid_id,
  course_id,
  title,
  activity_type,
  sub_type,
  parent_activity_id,
  module_id,
  position,
  plan_date,
  end_time,
  is_action_override,
  is_completed,
  is_deleted,
  is_hidden,
  created_at,
  updated_at
) VALUES
  -- Prior to 8/31 activities
  (1, 74, 'Presentation: Kinematics with Calculus', 'assignment', 'presentation', 26798, 26798, 0, '2026-08-31', NULL, true, false, false, false, NOW(), NOW()),
  (1, 74, 'Overview: Course Information', 'assignment', 'presentation', 26798, 26798, 1, '2026-08-31', NULL, true, false, false, false, NOW(), NOW()),
  (1, 74, 'Video Lab: Measurement*', 'assignment', 'lab', 26798, 26798, 2, '2026-08-31', '2026-09-02T23:59:59', true, false, false, false, NOW(), NOW()),
  (1, 74, 'Presentation: Calculus for Physics', 'assignment', 'presentation', 26798, 26798, 3, '2026-08-31', NULL, true, false, false, false, NOW(), NOW()),
  (1, 74, 'Practice Problems: Calculus for Physics', 'assignment', 'practice', 26798, 26798, 4, '2026-08-31', NULL, true, false, false, false, NOW(), NOW()),

  -- Monday 8/31
  (1, 74, 'Live Session #1', 'assignment', 'discussion', 26798, 26798, 5, '2026-08-31', NULL, true, false, false, false, NOW(), NOW()),
  (1, 74, 'Presentation: Vectors and Scalars', 'assignment', 'presentation', 26798, 26798, 6, '2026-08-31', NULL, true, false, false, false, NOW(), NOW()),
  (1, 74, 'Virtual Activity: Working with Vectors', 'assignment', 'virtual_activity', 26798, 26798, 7, '2026-08-31', NULL, true, false, false, false, NOW(), NOW()),

  -- Tuesday 9/1
  (1, 74, 'Presentation: Unit Vectors and Vector Math', 'assignment', 'presentation', 26798, 26798, 8, '2026-09-01', NULL, true, false, false, false, NOW(), NOW()),
  (1, 74, 'Practice Problems: Vectors', 'assignment', 'practice', 26798, 26798, 9, '2026-09-01', NULL, true, false, false, false, NOW(), NOW()),

  -- Wednesday 9/2
  (1, 74, 'Presentation: Motion Studies', 'assignment', 'presentation', 26798, 26798, 10, '2026-09-02', NULL, true, false, false, false, NOW(), NOW()),
  (1, 74, 'Video Lab: Motion Studies', 'assignment', 'video', 26798, 26798, 11, '2026-09-02', NULL, true, false, false, false, NOW(), NOW()),

  -- Thursday 9/3
  (1, 74, 'Practice Problems: Motion Studies', 'assignment', 'practice', 26798, 26798, 12, '2026-09-03', NULL, true, false, false, false, NOW(), NOW()),

  -- Friday 9/4
  (1, 74, 'Presentation: Graphical Analysis of Motion', 'assignment', 'presentation', 26798, 26798, 13, '2026-09-04', NULL, true, false, false, false, NOW(), NOW()),

  -- Monday 9/7 - Labor Day Holiday
  (1, 74, 'Labor Day Holiday', 'assignment', 'presentation', 26798, 26798, 14, '2026-09-07', NULL, true, false, false, false, NOW(), NOW()),

  -- Tuesday 9/8
  (1, 74, 'Virtual Activity: Motion Graphs', 'assignment', 'virtual_activity', 26798, 26798, 15, '2026-09-08', NULL, true, false, false, false, NOW(), NOW()),

  -- Wednesday 9/8
  (1, 74, 'Practice Problems: Motion Graphs', 'assignment', 'practice', 26798, 26798, 16, '2026-09-08', NULL, true, false, false, false, NOW(), NOW()),

  -- Thursday 9/9
  (1, 74, 'Presentation: Extremes and Inflections', 'assignment', 'presentation', 26798, 26798, 17, '2026-09-09', NULL, true, false, false, false, NOW(), NOW()),

  -- Thursday 9/10
  (1, 74, 'Practice Problems: Extremes and Inflections', 'assignment', 'practice', 26798, 26798, 18, '2026-09-10', NULL, true, false, false, false, NOW(), NOW()),

  -- Friday 9/11
  (1, 74, 'Quiz: #1', 'assignment', 'quiz', 26798, 26798, 19, '2026-09-11', '2026-09-15T23:59:59', true, false, false, false, NOW(), NOW()),

  -- Monday 9/14
  (1, 74, 'Live Session #2', 'assignment', 'discussion', 26798, 26798, 20, '2026-09-14', NULL, true, false, false, false, NOW(), NOW()),
  (1, 74, 'Presentation: Constant Acceleration Kinematics', 'assignment', 'presentation', 26798, 26798, 21, '2026-09-14', NULL, true, false, false, false, NOW(), NOW()),
  (1, 74, 'Demonstration: Kinematics on the Moon', 'assignment', 'video', 26798, 26798, 22, '2026-09-14', NULL, true, false, false, false, NOW(), NOW()),

  -- Tuesday 9/15
  (1, 74, 'Practice Problems: Kinematics', 'assignment', 'practice', 26798, 26798, 23, '2026-09-15', NULL, true, false, false, false, NOW(), NOW()),
  (1, 74, 'Challenge Problems: Kinematics', 'assignment', 'practice', 26798, 26798, 24, '2026-09-15', NULL, true, false, false, false, NOW(), NOW()),

  -- Wednesday 9/16
  (1, 74, 'Presentation: Error Analysis', 'assignment', 'presentation', 26798, 26798, 25, '2026-09-16', NULL, true, false, false, false, NOW(), NOW()),

  -- Thursday 9/17
  (1, 74, 'Lab Activity: Kinematics *', 'assignment', 'lab', 26798, 26798, 26, '2026-09-17', '2026-09-21T23:59:59', true, false, false, false, NOW(), NOW()),

  -- Friday 9/18
  (1, 74, 'Presentation: Projectiles', 'assignment', 'presentation', 26798, 26798, 27, '2026-09-18', NULL, true, false, false, false, NOW(), NOW()),

  -- Monday 9/21
  (1, 74, 'Virtual Activity: Projectiles', 'assignment', 'virtual_activity', 26798, 26798, 28, '2026-09-21', NULL, true, false, false, false, NOW(), NOW()),
  (1, 74, 'Practice Problems: Projectiles', 'assignment', 'practice', 26798, 26798, 29, '2026-09-21', NULL, true, false, false, false, NOW(), NOW()),

  -- Tuesday 9/22
  (1, 74, 'Quiz: #2', 'assignment', 'quiz', 26798, 26798, 30, '2026-09-22', '2026-09-24T23:59:59', true, false, false, false, NOW(), NOW()),

  -- Wednesday 9/23
  (1, 74, 'Presentation: Uniform Circular Motion', 'assignment', 'presentation', 26798, 26798, 31, '2026-09-23', NULL, true, false, false, false, NOW(), NOW()),
  (1, 74, 'Practice Problems: Uniform Circular Motion', 'assignment', 'practice', 26798, 26798, 32, '2026-09-23', NULL, true, false, false, false, NOW(), NOW()),

  -- Thursday 9/24
  (1, 74, 'Review: Unit 1C Mechanics', 'assignment', 'presentation', 26798, 26798, 33, '2026-09-24', NULL, true, false, false, false, NOW(), NOW()),

  -- Friday 9/25
  (1, 74, 'Test: Unit 1C Mechanics', 'assignment', 'test', 26798, 26798, 34, '2026-09-25', '2026-09-29T23:59:59', true, false, false, false, NOW(), NOW());

-- Check the results
SELECT
  id,
  title,
  activity_type,
  sub_type,
  position,
  plan_date,
  end_time
FROM activities
WHERE module_id = 26798
  AND is_deleted = false
ORDER BY position;
