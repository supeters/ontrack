-- Migration: Auto-populate school_id from calendar_id using a trigger
-- This ensures school_id is always in sync with the school_calendars.school_id

-- Step 1: Drop dependent views and policies first (if they exist)
DROP VIEW IF EXISTS public.courses_current CASCADE;
DROP VIEW IF EXISTS public.courses_display CASCADE;

-- Step 2: Drop existing trigger and function if they exist
DROP TRIGGER IF EXISTS trigger_sync_course_school_id ON public.courses;
DROP FUNCTION IF EXISTS public.sync_course_school_id();

-- Step 3: Create trigger function to auto-populate school_id
CREATE FUNCTION public.sync_course_school_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.calendar_id IS NOT NULL THEN
    SELECT school_id INTO NEW.school_id
    FROM public.school_calendars
    WHERE id = NEW.calendar_id;
  ELSE
    NEW.school_id := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Create trigger to run on INSERT and UPDATE
CREATE TRIGGER trigger_sync_course_school_id
  BEFORE INSERT OR UPDATE OF calendar_id
  ON public.courses
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_course_school_id();

-- Step 5: Update existing rows to populate school_id from calendar_id
UPDATE public.courses c
SET school_id = sc.school_id
FROM public.school_calendars sc
WHERE c.calendar_id = sc.id
  AND (c.school_id IS NULL OR c.school_id != sc.school_id);

COMMENT ON COLUMN public.courses.school_id IS
  'Automatically populated from school_calendars.school_id via calendar_id. Managed by trigger - do not set manually.';
