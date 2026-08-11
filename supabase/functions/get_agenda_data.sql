-- Function: Get all data needed for the Agenda view in a single call
-- Simplified version: returns courses with scheduled_today flag + activities
-- Frontend handles grouping

CREATE OR REPLACE FUNCTION public.get_agenda_data(
  p_kid_id INTEGER,
  p_date TEXT  -- Format: 'YYYY-MM-DD'
)
RETURNS TABLE (
  courses JSONB,              -- All courses with scheduled_today flag
  today_activities JSONB,     -- Actionable activities planned for p_date
  overdue_activities JSONB,   -- Actionable activities before today, not completed
  scheduled_classes JSONB,    -- Events/classes with start_time for p_date
  current_module_activities JSONB, -- Actionable tasks in the latest module before today
  next_module_activities JSONB     -- Actionable tasks in the next module after today
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_day_of_week INT;
  v_courses JSONB;
  v_today_activities JSONB;
  v_overdue_activities JSONB;
  v_scheduled_classes JSONB;
  v_current_module_activities JSONB;
  v_next_module_activities JSONB;
BEGIN
  -- Get day of week (0=Sunday, 1=Monday, etc.)
  v_day_of_week := EXTRACT(DOW FROM p_date::DATE);

  -- 1. Get all active courses with scheduled_today flag
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', c.id,
      'course_name', c.course_name,
      'subject', c.subject,
      'work_days', c.work_days,
      'class_days', c.class_days,
      'meeting_link', c.meeting_link,
      'course_webpage', c.course_webpage,
      'teacher', c.teacher,
      'scheduled_today', CASE
        WHEN c.work_days IS NOT NULL
          AND c.work_days LIKE '%' || v_day_of_week::TEXT || '%'
        THEN true
        ELSE false
      END
    )
  )
  INTO v_courses
  FROM public.courses c
  WHERE c.kid_id = p_kid_id
    AND c.is_active = true;

  -- 2. Get actionable activities for selected date
  SELECT jsonb_agg(
    to_jsonb(a.*) || jsonb_build_object(
      'course_name', c.course_name,
      'module_title', m.title
    ) ORDER BY c.course_name, coalesce(m.title, ''), a.plan_date, a.title
  )
  INTO v_today_activities
  FROM public.activities a
  LEFT JOIN public.courses c ON a.course_id = c.id
  LEFT JOIN public.activities m ON a.module_id = m.id
  WHERE a.kid_id = p_kid_id
    AND a.plan_date = p_date::DATE
    AND a.is_action = true
    AND a.is_deleted = false
    AND a.is_hidden = false
    AND a.activity_type NOT IN ('module', 'workgroup');

  -- 3. Get overdue actionable activities (before p_date, not completed)
  SELECT jsonb_agg(
    to_jsonb(a.*) || jsonb_build_object(
      'course_name', c.course_name,
      'module_title', m.title
    ) ORDER BY c.course_name, coalesce(m.title, ''), a.plan_date, a.title
  )
  INTO v_overdue_activities
  FROM public.activities a
  LEFT JOIN public.courses c ON a.course_id = c.id
  LEFT JOIN public.activities m ON a.module_id = m.id
  WHERE a.kid_id = p_kid_id
    AND a.plan_date < CURRENT_DATE
    AND a.is_completed = false
    AND a.is_action = true
    AND a.is_deleted = false
    AND a.is_hidden = false
    AND a.activity_type NOT IN ('module', 'workgroup');

  -- 4. Get scheduled classes (events/classes with start_time)
  SELECT jsonb_agg(to_jsonb(a.*))
  INTO v_scheduled_classes
  FROM public.activities a
  WHERE a.kid_id = p_kid_id
    AND a.plan_date = p_date::DATE
    AND a.activity_type IN ('event', 'class')
    AND a.start_time IS NOT NULL
    AND a.is_deleted = false
    AND a.is_hidden = false;

  -- Find the latest module before today
  WITH latest_module AS (
    SELECT id AS module_id
    FROM public.activities
    WHERE kid_id = p_kid_id
      AND activity_type = 'module'
      AND plan_date < p_date::DATE
    ORDER BY plan_date DESC
    LIMIT 1
  )
  SELECT jsonb_agg(
    to_jsonb(a.*) || jsonb_build_object(
      'course_name', c.course_name,
      'module_title', m.title
    ) ORDER BY c.course_name, coalesce(m.title, ''), a.plan_date, a.title
  )
  INTO v_current_module_activities
  FROM public.activities a
  LEFT JOIN public.courses c ON a.course_id = c.id
  LEFT JOIN public.activities m ON a.module_id = m.id
  WHERE a.module_id = (SELECT module_id FROM latest_module)
    AND a.is_action = true
    AND a.is_deleted = false
    AND a.is_hidden = false
    AND a.activity_type NOT IN ('module', 'workgroup');

  -- Find the earliest module after today
  WITH next_module AS (
    SELECT id AS module_id
    FROM public.activities
    WHERE kid_id = p_kid_id
      AND activity_type = 'module'
      AND plan_date > p_date::DATE
    ORDER BY plan_date ASC
    LIMIT 1
  )
  SELECT jsonb_agg(
    to_jsonb(a.*) || jsonb_build_object(
      'course_name', c.course_name,
      'module_title', m.title
    ) ORDER BY c.course_name, coalesce(m.title, ''), a.plan_date, a.title
  )
  INTO v_next_module_activities
  FROM public.activities a
  LEFT JOIN public.courses c ON a.course_id = c.id
  LEFT JOIN public.activities m ON a.module_id = m.id
  WHERE a.module_id = (SELECT module_id FROM next_module)
    AND a.is_action = true
    AND a.is_deleted = false
    AND a.is_hidden = false
    AND a.activity_type NOT IN ('module', 'workgroup');

  -- Return all data in a single row
  RETURN QUERY SELECT
    COALESCE(v_courses, '[]'::jsonb),
    COALESCE(v_today_activities, '[]'::jsonb),
    COALESCE(v_overdue_activities, '[]'::jsonb),
    COALESCE(v_scheduled_classes, '[]'::jsonb),
    COALESCE(v_current_module_activities, '[]'::jsonb),
    COALESCE(v_next_module_activities, '[]'::jsonb);
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_agenda_data(INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_agenda_data(INTEGER, TEXT) TO anon;

COMMENT ON FUNCTION public.get_agenda_data IS
'Get all agenda data for a kid on a specific date. Returns courses, activities (today + overdue), scheduled classes, and course work data pre-grouped. Replaces multiple queries in AgendaView.jsx.';
