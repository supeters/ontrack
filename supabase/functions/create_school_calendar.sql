-- Function: Create a school calendar with terms and holidays
-- All business logic for calendar creation

CREATE OR REPLACE FUNCTION public.create_school_calendar(
  p_school_name TEXT,
  p_school_year_name TEXT,      -- e.g., "2024-2025"
  p_start_date DATE,
  p_end_date DATE,
  p_term_name TEXT DEFAULT 'Full Year' -- e.g., "Fall", "Spring", default "Full Year"
)
RETURNS TABLE (
  calendar_id INTEGER,
  school_name TEXT,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_calendar_id INTEGER;
  v_school_id INTEGER;
BEGIN
  -- Validate required fields
  IF p_school_name IS NULL OR p_school_name = '' THEN
    RAISE EXCEPTION 'School name is required';
  END IF;

  IF p_school_year_name IS NULL OR p_school_year_name = '' THEN
    RAISE EXCEPTION 'School year name is required';
  END IF;

  IF p_start_date IS NULL THEN
    RAISE EXCEPTION 'Start date is required';
  END IF;

  IF p_end_date IS NULL THEN
    RAISE EXCEPTION 'End date is required';
  END IF;

  IF p_end_date < p_start_date THEN
    RAISE EXCEPTION 'End date must be after start date';
  END IF;

  -- Get school by name (should already exist, created via /api/schools)
  SELECT id INTO v_school_id
  FROM public.schools
  WHERE name = p_school_name
  LIMIT 1;

  IF v_school_id IS NULL THEN
    RAISE EXCEPTION 'School not found. Please create the school first in Settings > Schools tab.';
  END IF;

  -- Get or create school year
  INSERT INTO public.school_years (name, is_current)
  VALUES (p_school_year_name, false)
  ON CONFLICT (name) DO NOTHING;

  -- Insert new calendar
  INSERT INTO public.school_calendars (
    school_id,
    school_year_name,
    term_name,
    start_date,
    end_date,
    created_at,
    updated_at
  ) VALUES (
    v_school_id,
    p_school_year_name,
    p_term_name,
    p_start_date,
    p_end_date,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_calendar_id;

  -- Return result
  RETURN QUERY SELECT
    v_calendar_id,
    p_school_name,
    'Calendar created successfully';
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_school_calendar TO authenticated;

COMMENT ON FUNCTION public.create_school_calendar IS
'Create a school calendar with term dates. Holidays can be added separately via calendar_holidays table.';


-- Function: Get all calendars
CREATE OR REPLACE FUNCTION public.get_school_calendars()
RETURNS TABLE (
  calendars JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_calendars JSONB;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', sc.id,
      'school_id', sc.school_id,
      'school_name', s.name,
      'school_year_name', sc.school_year_name,
      'term_name', sc.term_name,
      'start_date', sc.start_date,
      'end_date', sc.end_date
    ) ORDER BY sc.start_date DESC
  )
  INTO v_calendars
  FROM public.school_calendars sc
  LEFT JOIN public.schools s ON sc.school_id = s.id;

  RETURN QUERY SELECT COALESCE(v_calendars, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_school_calendars TO authenticated;

COMMENT ON FUNCTION public.get_school_calendars IS
'Get all school calendars for selection in CourseSetupModal.';
