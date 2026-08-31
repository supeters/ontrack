CREATE OR REPLACE FUNCTION public.get_agenda_data(
  p_kid_id INTEGER,
  p_date TEXT,
  p_academic_year TEXT DEFAULT NULL,
  p_current_date TEXT DEFAULT NULL
)
RETURNS TABLE (
  today_activities JSONB,
  overdue_activities JSONB,
  scheduled_classes JSONB,
  completed_activities JSONB
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_target_date DATE;
  v_current_date DATE;
  v_today_activities JSONB;
  v_overdue_activities JSONB;
  v_scheduled_classes JSONB;
  v_completed_activities JSONB;
BEGIN
  -- Cast p_date safely
  v_target_date := p_date::DATE;

  -- Use provided current date or fall back to server's CURRENT_DATE
  v_current_date := COALESCE(p_current_date::DATE, CURRENT_DATE);

  -- 1. Get actionable activities for selected date
  SELECT COALESCE(jsonb_agg(
    to_jsonb(a.*) || jsonb_build_object(
      'course_name', c.course_name,
      'module_title', m.title,
      'child_tasks', child_tasks.tasks,
      'child_task_count', child_tasks.total_count,
      'child_completed_count', child_tasks.completed_count
    ) ORDER BY COALESCE(a.position, 999999), a.plan_date, a.title
  ), '[]'::jsonb)
  INTO v_today_activities
  FROM public.activities a
  LEFT JOIN public.courses c ON a.course_id = c.id
  LEFT JOIN public.school_calendars sc ON c.calendar_id = sc.id
  LEFT JOIN public.activities m ON a.module_id = m.id
  LEFT JOIN LATERAL (
    SELECT
      COALESCE(jsonb_agg(to_jsonb(child.*) ORDER BY child.position, child.title), '[]'::jsonb) AS tasks,
      COUNT(*) AS total_count,
      COUNT(*) FILTER (WHERE child.is_completed = true) AS completed_count
    FROM public.activities child
    WHERE child.parent_activity_id = a.id
      AND child.activity_type = 'task'
      AND child.is_deleted = false
  ) child_tasks ON true
  WHERE a.kid_id = p_kid_id
    AND a.plan_date = v_target_date
    AND a.is_action = true
    AND a.is_deleted = false
    AND a.is_hidden = false
    AND a.is_completed = false
    AND (p_academic_year IS NULL OR sc.school_year_name = p_academic_year OR a.course_id IS NULL);

  -- 2. Get overdue actionable activities (before target date, uncompleted)
  SELECT COALESCE(jsonb_agg(
    to_jsonb(a.*) || jsonb_build_object(
      'course_name', c.course_name,
      'module_title', m.title,
      'child_tasks', child_tasks.tasks,
      'child_task_count', child_tasks.total_count,
      'child_completed_count', child_tasks.completed_count
    ) ORDER BY COALESCE(a.position, 999999), a.plan_date, a.title
  ), '[]'::jsonb)
  INTO v_overdue_activities
  FROM public.activities a
  LEFT JOIN public.courses c ON a.course_id = c.id
  LEFT JOIN public.school_calendars S ON S.id = C.Calendar_id
  LEFT JOIN public.activities m ON a.module_id = m.id
  LEFT JOIN LATERAL (
    SELECT
      COALESCE(jsonb_agg(to_jsonb(child.*) ORDER BY child.position, child.title), '[]'::jsonb) AS tasks,
      COUNT(*) AS total_count,
      COUNT(*) FILTER (WHERE child.is_completed = true) AS completed_count
    FROM public.activities child
    WHERE child.parent_activity_id = a.id
      AND child.activity_type = 'task'
      AND child.is_deleted = false
  ) child_tasks ON true
  WHERE a.kid_id = p_kid_id
    AND a.plan_date < v_current_date
    AND a.plan_date != v_target_date  -- Exclude items that match the viewed date (prevents duplicates)
    AND a.is_completed = false
    AND a.is_action = true
    AND a.is_deleted = false
    AND a.is_hidden = false
    AND (p_academic_year IS NULL OR S.school_year_name = p_academic_year OR a.course_id IS NULL);


  -- 3. Get scheduled classes for the current week
  WITH week_bounds AS (
    SELECT
    
      (v_target_date - (EXTRACT(DOW FROM v_target_date)::int * INTERVAL '1 day'))::date AS week_start,
      (v_target_date + ((6 - EXTRACT(DOW FROM v_target_date)::int) * INTERVAL '1 day'))::date AS week_end
  
  )
  SELECT COALESCE(jsonb_agg(
    to_jsonb(a.*) || jsonb_build_object('course_name', c.course_name)
    ORDER BY a.plan_date, a.start_time
  ), '[]'::jsonb)
  INTO v_scheduled_classes
  FROM public.activities a
  CROSS JOIN week_bounds wb
  LEFT JOIN public.courses c ON a.course_id = c.id
  LEFT JOIN public.school_calendars sc ON c.calendar_id = sc.id
  WHERE a.kid_id = p_kid_id
    AND a.plan_date BETWEEN wb.week_start AND wb.week_end
    AND a.start_time IS NOT NULL and a.activity_type not in ('class', 'event')
    AND a.is_deleted = false
    AND a.is_hidden = false
    AND (p_academic_year IS NULL OR sc.school_year_name = p_academic_year OR a.course_id IS NULL);

  -- 4. Completed activities for target date (plan_date = target, regardless of when completed)
  SELECT COALESCE(jsonb_agg(
    to_jsonb(a.*) || jsonb_build_object(
      'course_name', c.course_name,
      'module_title', m.title,
      'child_tasks', child_tasks.tasks,
      'child_task_count', child_tasks.total_count,
      'child_completed_count', child_tasks.completed_count
    ) ORDER BY c.course_name, COALESCE(m.title, ''), a.plan_date, a.title
  ), '[]'::jsonb)
  INTO v_completed_activities
  FROM public.activities a
  LEFT JOIN public.courses c ON a.course_id = c.id
  LEFT JOIN public.school_calendars sc ON c.calendar_id = sc.id
  LEFT JOIN public.activities m ON a.module_id = m.id
  LEFT JOIN LATERAL (
    SELECT
      COALESCE(jsonb_agg(to_jsonb(child.*) ORDER BY child.position, child.title), '[]'::jsonb) AS tasks,
      COUNT(*) AS total_count,
      COUNT(*) FILTER (WHERE child.is_completed = true) AS completed_count
    FROM public.activities child
    WHERE child.parent_activity_id = a.id
      AND child.activity_type = 'task'
      AND child.is_deleted = false
  ) child_tasks ON true
  WHERE a.kid_id = p_kid_id
    AND a.plan_date = v_target_date
    AND a.is_completed = true
    AND a.is_action = true
    AND a.is_deleted = false
    AND a.is_hidden = false
    AND a.activity_type NOT IN ('module', 'workgroup')
    AND (p_academic_year IS NULL OR sc.school_year_name = p_academic_year OR a.course_id IS NULL);

  -- Return explicitly named columns
  RETURN QUERY SELECT
    v_today_activities,
    v_overdue_activities,
    v_scheduled_classes,
    v_completed_activities;
END;
$$;
