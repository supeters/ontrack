DECLARE
  v_day_of_week INT;
 
  v_today_activities JSONB;
  v_overdue_activities JSONB;
  v_scheduled_classes JSONB;
 
  v_next_module_activities JSONB;
  v_completed_activities JSONB;
  v_target_date DATE;
BEGIN
  -- Cast p_date safely
  v_target_date := p_date::DATE;

  -- Get day of week (0=Sunday, 1=Monday, etc.)
  v_day_of_week := EXTRACT(DOW FROM v_target_date);

  
  -- 2. Get actionable activities for selected date
  SELECT jsonb_agg(
    to_jsonb(a.*) || jsonb_build_object(
      'course_name', c.course_name,
      'module_title', m.title
    ) ORDER BY COALESCE(a.position, 999999), a.plan_date, a.title
  )
  INTO v_today_activities
  FROM public.activities a
  LEFT JOIN public.courses c ON a.course_id = c.id
  LEFT JOIN public.activities m ON a.module_id = m.id
  WHERE a.kid_id = p_kid_id
    AND (a.plan_date = v_target_date or a.start_time is not null)
    AND a.is_action = true
    AND a.is_deleted = false
    AND a.is_hidden = false
    and a.is_completed = false;

  -- 3. Get overdue actionable activities (before current date, not completed)
  SELECT jsonb_agg(
    to_jsonb(a.*) || jsonb_build_object(
      'course_name', c.course_name,
      'module_title', m.title
    ) ORDER BY COALESCE(a.position, 999999), a.plan_date, a.title
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
  WITH week_bounds AS (
    SELECT
        date_trunc('week', v_target_date)::date AS week_start,
        (date_trunc('week', v_target_date) + interval '6 days')::date AS week_end
),
weekly_activities AS (
    SELECT 
        a.*,
        c.course_name
    FROM public.activities a
    CROSS JOIN week_bounds wb
    LEFT JOIN public.courses c ON a.course_id = c.id
    WHERE a.kid_id = p_kid_id
      AND a.plan_date BETWEEN wb.week_start AND wb.week_end
      AND a.start_time IS NOT NULL
      AND a.is_deleted = false
      AND a.is_hidden = false
)
SELECT jsonb_agg(
    to_jsonb(a.*) || jsonb_build_object('course_name', a.course_name)
)
INTO v_scheduled_classes
FROM weekly_activities a;

  -- 6. Find the activites from next 10 days

SELECT jsonb_agg(
    to_jsonb(a.*) ||
    jsonb_build_object(
      'course_name', c.course_name,
      'module_title', m.title
    )
    ORDER BY c.course_name, coalesce(m.title, ''), a.plan_date, a.title
)
INTO v_next_module_activities
  FROM public.activities a
  LEFT JOIN public.courses c ON a.course_id = c.id
  LEFT JOIN public.activities m ON a.module_id = m.id
  WHERE a.kid_id = p_kid_id
    AND a.plan_date > v_target_date and a.plan_date <= v_target_date + 7
    AND a.is_completed = false
    AND (a.is_action = true or a.activity_type in ('class', 'event'))
    AND a.is_deleted = false
    AND a.is_hidden = false
    AND a.activity_type NOT IN ('module', 'workgroup');

  -- 7. Completed activities today
  SELECT jsonb_agg(
    to_jsonb(a.*) || jsonb_build_object(
      'course_name', c.course_name,
      'module_title', m.title
    ) ORDER BY c.course_name, coalesce(m.title, ''), a.plan_date, a.title
  )
  INTO v_completed_activities
  FROM public.activities a
  LEFT JOIN public.courses c ON a.course_id = c.id
  LEFT JOIN public.activities m ON a.module_id = m.id
  WHERE a.kid_id = p_kid_id
    AND a.completed_at::DATE = v_target_date
    AND a.is_completed = true
    AND a.is_action = true
    AND a.is_deleted = false
    AND a.is_hidden = false
    AND a.activity_type NOT IN ('module', 'workgroup');

  -- Return all data in a single row
  RETURN QUERY SELECT
    
    COALESCE(v_today_activities, '[]'::jsonb),
    COALESCE(v_overdue_activities, '[]'::jsonb),
    COALESCE(v_scheduled_classes, '[]'::jsonb),
    
    COALESCE(v_next_module_activities, '[]'::jsonb),
    COALESCE(v_completed_activities, '[]'::jsonb);
END;