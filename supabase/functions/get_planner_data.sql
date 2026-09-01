-- Function: Get all data needed for the Planner view
-- Replaces multiple queries in PlannerView.jsx
-- Uses actual schema: public.activities, public.courses, public.school_calendars

CREATE OR REPLACE FUNCTION public.get_planner_data(
  p_kid_id INTEGER,
  p_start_date TEXT,  -- Format: 'YYYY-MM-DD'
  p_end_date TEXT     -- Format: 'YYYY-MM-DD'
)
RETURNS TABLE (
  activities JSONB,
  courses JSONB,
  calendar_events JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_activities JSONB;
  v_courses JSONB;
  v_calendar_events JSONB;
BEGIN
  -- Get all activities in the date range (not deleted, not hidden)
  -- Include actual_time_worked which is the sum of work_chunks.minutes_worked
  SELECT jsonb_agg(
    to_jsonb(a.*) || jsonb_build_object(
      'actual_time_worked', COALESCE(work_time.total_minutes, 0)
    ) ORDER BY a.plan_date, a.start_time
  )
  INTO v_activities
  FROM public.activities a
  LEFT JOIN LATERAL (
    SELECT SUM(wc.minutes_worked) AS total_minutes
    FROM public.activity_work_chunks wc
    WHERE wc.activity_id = a.id
      AND wc.kid_id = p_kid_id
  ) work_time ON true
  WHERE a.kid_id = p_kid_id
    AND a.plan_date BETWEEN p_start_date::DATE AND p_end_date::DATE
    AND a.is_deleted = false
    AND a.is_hidden = false;

  -- Get courses that have activities in the date range
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
      'course_code', c.course_code,
      'source_type', c.source_type,
      'school_id', c.school_id,
      'school_nickname', s.nickname,
      'school_name', s.name
    ) ORDER BY c.course_name
  )
  INTO v_courses
  FROM public.courses c
  LEFT JOIN public.schools s ON c.school_id = s.id
  WHERE c.kid_id = p_kid_id
    AND c.is_active = true
    AND EXISTS (
      SELECT 1 FROM public.activities a
      WHERE a.course_id = c.id
        AND a.plan_date BETWEEN p_start_date::DATE AND p_end_date::DATE
        AND a.is_deleted = false
        AND a.is_hidden = false
    );

  -- Get calendar data from school_calendars (terms with start/end dates)
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', sc.id,
      'school_id', sc.school_id,
      'school_year_name', sc.school_year_name,
      'term_name', sc.term_name,
      'start_date', sc.start_date,
      'end_date', sc.end_date
    ) ORDER BY sc.start_date
  )
  INTO v_calendar_events
  FROM public.school_calendars sc
  WHERE sc.start_date <= p_end_date::DATE
    AND sc.end_date >= p_start_date::DATE;

  -- Return all data
  RETURN QUERY SELECT
    COALESCE(v_activities, '[]'::jsonb),
    COALESCE(v_courses, '[]'::jsonb),
    COALESCE(v_calendar_events, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_planner_data(INTEGER, TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.get_planner_data IS
'Get all planner data for a kid within a date range. Returns activities, courses, and calendar events. Used by PlannerView.';
