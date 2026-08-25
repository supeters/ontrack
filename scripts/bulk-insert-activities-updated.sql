-- Bulk insert activities for Unit 1: Kinematics with Calculus
-- Based on Unit 1 Pacing Guide with correct dates
-- Course ID: 74, Kid ID: 1, Module ID: 26686

INSERT INTO activities (
  kid_id,
  course_id,
  title,
  activity_type,
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
  (1, 74, 'Presentation: Kinematics with Calculus', 'page', 26686, 26686, 0, '2026-08-31', NULL, true, false, false, false, NOW(), NOW()),
  (1, 74, 'Overview: Course Information', 'page', 26686, 26686, 1, '2026-08-31', NULL, true, false, false, false, NOW(), NOW()),
  (1, 74, 'Video Lab: Measurement*', 'video', 26686, 26686, 2, '2026-08-31', '2026-09-02T23:59:59', true, false, false, false, NOW(), NOW()),
  (1, 74, 'Presentation: Calculus for Physics', 'page', 26686, 26686, 3, '2026-08-31', NULL, true, false, false, false, NOW(), NOW()),
  (1, 74, 'Practice Problems: Calculus for Physics', 'assignment', 26686, 26686, 4, '2026-08-31', NULL, true, false, false, false, NOW(), NOW()),

  -- Monday 8/31
  (1, 74, 'Live Session #1', 'discussion', 26686, 26686, 5, '2026-08-31', NULL, true, false, false, false, NOW(), NOW()),
  (1, 74, 'Presentation: Vectors and Scalars', 'page', 26686, 26686, 6, '2026-08-31', NULL, true, false, false, false, NOW(), NOW()),
  (1, 74, 'Virtual Activity: Working with Vectors', 'assignment', 26686, 26686, 7, '2026-08-31', NULL, true, false, false, false, NOW(), NOW()),

  -- Tuesday 9/1
  (1, 74, 'Presentation: Unit Vectors and Vector Math', 'page', 26686, 26686, 8, '2026-09-01', NULL, true, false, false, false, NOW(), NOW()),
  (1, 74, 'Practice Problems: Vectors', 'assignment', 26686, 26686, 9, '2026-09-01', NULL, true, false, false, false, NOW(), NOW()),

  -- Wednesday 9/2
  (1, 74, 'Presentation: Motion Studies', 'page', 26686, 26686, 10, '2026-09-02', NULL, true, false, false, false, NOW(), NOW()),
  (1, 74, 'Video Lab: Motion Studies', 'video', 26686, 26686, 11, '2026-09-02', NULL, true, false, false, false, NOW(), NOW()),

  -- Thursday 9/3
  (1, 74, 'Practice Problems: Motion Studies', 'assignment', 26686, 26686, 12, '2026-09-03', NULL, true, false, false, false, NOW(), NOW()),

  -- Friday 9/4
  (1, 74, 'Presentation: Graphical Analysis of Motion', 'page', 26686, 26686, 13, '2026-09-04', NULL, true, false, false, false, NOW(), NOW()),

  -- Monday 9/7 - Labor Day Holiday
  (1, 74, 'Labor Day Holiday', 'page', 26686, 26686, 14, '2026-09-07', NULL, true, false, false, false, NOW(), NOW()),

  -- Tuesday 9/8
  (1, 74, 'Virtual Activity: Motion Graphs', 'assignment', 26686, 26686, 15, '2026-09-08', NULL, true, false, false, false, NOW(), NOW()),

  -- Wednesday 9/8
  (1, 74, 'Practice Problems: Motion Graphs', 'assignment', 26686, 26686, 16, '2026-09-08', NULL, true, false, false, false, NOW(), NOW()),

  -- Thursday 9/9
  (1, 74, 'Presentation: Extremes and Inflections', 'page', 26686, 26686, 17, '2026-09-09', NULL, true, false, false, false, NOW(), NOW()),

  -- Thursday 9/10
  (1, 74, 'Practice Problems: Extremes and Inflections', 'assignment', 26686, 26686, 18, '2026-09-10', NULL, true, false, false, false, NOW(), NOW()),

  -- Friday 9/11
  (1, 74, 'Quiz: #1', 'quiz', 26686, 26686, 19, '2026-09-11', '2026-09-15T23:59:59', true, false, false, false, NOW(), NOW()),

  -- Monday 9/14
  (1, 74, 'Live Session #2', 'discussion', 26686, 26686, 20, '2026-09-14', NULL, true, false, false, false, NOW(), NOW()),
  (1, 74, 'Presentation: Constant Acceleration Kinematics', 'page', 26686, 26686, 21, '2026-09-14', NULL, true, false, false, false, NOW(), NOW()),
  (1, 74, 'Demonstration: Kinematics on the Moon', 'video', 26686, 26686, 22, '2026-09-14', NULL, true, false, false, false, NOW(), NOW()),

  -- Tuesday 9/15
  (1, 74, 'Practice Problems: Kinematics', 'assignment', 26686, 26686, 23, '2026-09-15', NULL, true, false, false, false, NOW(), NOW()),
  (1, 74, 'Challenge Problems: Kinematics', 'assignment', 26686, 26686, 24, '2026-09-15', NULL, true, false, false, false, NOW(), NOW()),

  -- Wednesday 9/16
  (1, 74, 'Presentation: Error Analysis', 'page', 26686, 26686, 25, '2026-09-16', NULL, true, false, false, false, NOW(), NOW()),

  -- Thursday 9/17
  (1, 74, 'Lab Activity: Kinematics *', 'assignment', 26686, 26686, 26, '2026-09-17', '2026-09-21T23:59:59', true, false, false, false, NOW(), NOW()),

  -- Friday 9/18
  (1, 74, 'Presentation: Projectiles', 'page', 26686, 26686, 27, '2026-09-18', NULL, true, false, false, false, NOW(), NOW()),

  -- Monday 9/21
  (1, 74, 'Virtual Activity: Projectiles', 'assignment', 26686, 26686, 28, '2026-09-21', NULL, true, false, false, false, NOW(), NOW()),
  (1, 74, 'Practice Problems: Projectiles', 'assignment', 26686, 26686, 29, '2026-09-21', NULL, true, false, false, false, NOW(), NOW()),

  -- Tuesday 9/22
  (1, 74, 'Quiz: #2', 'quiz', 26686, 26686, 30, '2026-09-22', '2026-09-24T23:59:59', true, false, false, false, NOW(), NOW()),

  -- Wednesday 9/23
  (1, 74, 'Presentation: Uniform Circular Motion', 'page', 26686, 26686, 31, '2026-09-23', NULL, true, false, false, false, NOW(), NOW()),
  (1, 74, 'Practice Problems: Uniform Circular Motion', 'assignment', 26686, 26686, 32, '2026-09-23', NULL, true, false, false, false, NOW(), NOW()),

  -- Thursday 9/24
  (1, 74, 'Review: Unit 1C Mechanics', 'page', 26686, 26686, 33, '2026-09-24', NULL, true, false, false, false, NOW(), NOW()),

  -- Friday 9/25
  (1, 74, 'Test: Unit 1C Mechanics', 'quiz', 26686, 26686, 34, '2026-09-25', '2026-09-29T23:59:59', true, false, false, false, NOW(), NOW());

-- Check the results
SELECT
  id,
  title,
  activity_type,
  position,
  plan_date,
  end_time
FROM activities
WHERE module_id = 26686
  AND is_deleted = false
ORDER BY position;
