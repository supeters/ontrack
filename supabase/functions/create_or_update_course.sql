-- Function: Create or update a course
-- All business logic for course creation/update

CREATE OR REPLACE FUNCTION public.create_or_update_course(
  p_kid_id INTEGER,
  p_course_name TEXT,
  p_course_id INTEGER DEFAULT NULL,  -- NULL for create, ID for update
  p_subject TEXT DEFAULT NULL,
  p_teacher TEXT DEFAULT NULL,
  p_course_webpage TEXT DEFAULT NULL,
  p_meeting_link TEXT DEFAULT NULL,
  p_course_code TEXT DEFAULT NULL,
  p_calendar_id INTEGER DEFAULT NULL,
  p_work_days TEXT DEFAULT NULL,     -- e.g., "135" for Mon/Wed/Fri
  p_class_days TEXT DEFAULT NULL,    -- e.g., "24" for Tue/Thu
  p_is_active BOOLEAN DEFAULT true
)
RETURNS TABLE (
  course_id INTEGER,
  course_name TEXT,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_course_id INTEGER;
  v_action TEXT;
BEGIN
  -- Validate required fields
  IF p_course_name IS NULL OR p_course_name = '' THEN
    RAISE EXCEPTION 'Course name is required';
  END IF;

  IF p_kid_id IS NULL THEN
    RAISE EXCEPTION 'Kid ID is required';
  END IF;

  -- Check if updating or creating
  IF p_course_id IS NOT NULL THEN
    -- UPDATE existing course
    UPDATE public.courses
    SET
      course_name = p_course_name,
      subject = p_subject,
      teacher = p_teacher,
      course_webpage = p_course_webpage,
      meeting_link = p_meeting_link,
      course_code = p_course_code,
      calendar_id = p_calendar_id,
      work_days = p_work_days,
      class_days = p_class_days,
      is_active = p_is_active,
      updated_at = NOW()
    WHERE id = p_course_id
      AND kid_id = p_kid_id;  -- Security: only update own courses

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Course not found or access denied';
    END IF;

    v_course_id := p_course_id;
    v_action := 'updated';
  ELSE
    -- INSERT new course
    INSERT INTO public.courses (
      kid_id,
      course_name,
      subject,
      teacher,
      course_webpage,
      meeting_link,
      course_code,
      calendar_id,
      work_days,
      class_days,
      is_active,
      created_at,
      updated_at
    ) VALUES (
      p_kid_id,
      p_course_name,
      p_subject,
      p_teacher,
      p_course_webpage,
      p_meeting_link,
      p_course_code,
      p_calendar_id,
      p_work_days,
      p_class_days,
      p_is_active,
      NOW(),
      NOW()
    )
    RETURNING id INTO v_course_id;

    v_action := 'created';
  END IF;

  -- Return result
  RETURN QUERY SELECT
    v_course_id,
    p_course_name,
    'Course ' || v_action || ' successfully';
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_or_update_course TO authenticated;

COMMENT ON FUNCTION public.create_or_update_course IS
'Create or update a course with all business logic handled in SQL. Used by CourseSetupModal.';
