DECLARE
  v_target_date DATE;
  v_today_activities JSONB;
  v_overdue_activities JSONB;
  v_scheduled_classes JSONB;
  v_next_module_activities JSONB;
  v_completed_activities JSONB;
BEGIN
  -- Cast p_date safely
  v_target_date := p_date::DATE;

  -- 1. Get actionable activities for selected date
  SELECT COALESCE(jsonb_agg(
    to_jsonb(a.*) || jsonb_build_object(
      'course_name', c.course_name,
      'module_title', m.title
    ) ORDER BY COALESCE(a.position, 999999), a.plan_date, a.title
  ), '[]'::jsonb)
  INTO v_today_activities
  FROM public.activities a
  LEFT JOIN public.courses c ON a.course_id = c.id
  LEFT JOIN public.school_calendars sc ON sc.id = c.calendar_id
  LEFT JOIN public.activities m ON a.module_id = m.id
  WHERE a.kid_id = p_kid_id
    AND a.plan_date = v_target_date
    AND a.is_action = true
    AND a.is_deleted = false
    AND a.is_hidden = false
    AND a.is_completed = false
    AND (sc.start_date IS NULL OR sc.start_date <= v_target_date)
    AND (sc.end_date IS NULL OR sc.end_date >= v_target_date);

  -- 2. Get overdue actionable activities (before target date, uncompleted)
  SELECT COALESCE(jsonb_agg(
    to_jsonb(a.*) || jsonb_build_object(
      'course_name', c.course_name,
      'module_title', m.title
    ) ORDER BY COALESCE(a.position, 999999), a.plan_date, a.title
  ), '[]'::jsonb)
  INTO v_overdue_activities
  FROM public.activities a
  LEFT JOIN public.courses c ON a.course_id = c.id
 LEFT JOIN public.activities m ON a.module_id = m.id
  LEFT JOIN public.school_calendars sc ON sc.id = c.calendar_id
  WHERE a.kid_id = p_kid_id
    AND a.plan_date < CURRENT_DATE
    AND a.is_completed = false
    AND a.is_action = true
    AND a.is_deleted = false
    AND (sc.start_date IS NULL OR sc.start_date <= v_target_date)
    AND (sc.end_date IS NULL OR sc.end_date >= v_target_date)
    AND a.is_hidden = false
    AND a.activity_type NOT IN ('module', 'workgroup');


  -- 3. Get scheduled classes for the current week
  WITH week_bounds AS (
    SELECT
    
      (v_target_date - (EXTRACT(DOW FROM v_target_date)::int * INTERVAL '1 day'))::date AS week_start,
      (v_target_date + ((6 - EXTRACT(DOW FROM v_target_date)::int) * INTERVAL '1 day'))::date AS week_end
  