-- Safe Bulk Grade Upsert Function
-- Efficiently processes multiple grade/submission upserts in a single call
-- Handles grades and teacher comments from Canvas and Moodle
--
-- Usage:
--   SELECT * FROM safe_bulk_grade_upsert(
--     grade_records => '[...]'::jsonb
--   );
--
-- Returns: lms_assignment_id, grade_id, was_inserted, was_updated, error_message

CREATE OR REPLACE FUNCTION safe_bulk_grade_upsert(
  grade_records jsonb
)
RETURNS TABLE (
  lms_assignment_id text,
  grade_id integer,
  was_inserted boolean,
  was_updated boolean,
  error_message text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  record jsonb;
  record_assignment_id text;
  record_kid_id integer;
  existing_grade_id integer;
  result_grade_id integer;
  result_inserted boolean;
  result_updated boolean;
BEGIN
  -- Process each record in the array
  FOR record IN SELECT jsonb_array_elements(grade_records)
  LOOP
    BEGIN
      -- Extract key fields
      record_assignment_id := record->>'lms_assignment_id';
      record_kid_id := (record->>'kid_id')::integer;

      -- Check if grade exists
      SELECT id INTO existing_grade_id
      FROM activity_grades
      WHERE lms_assignment_id = record_assignment_id
        AND kid_id = record_kid_id;

      IF existing_grade_id IS NOT NULL THEN
        -- Update existing grade
        UPDATE activity_grades
        SET
          course_id = (record->>'course_id')::integer,
          lms_source = record->>'lms_source',
          submitted_at = (record->>'submitted_at')::timestamptz,
          submission_type = record->>'submission_type',
          workflow_state = record->>'workflow_state',
          submission_url = record->>'submission_url',
          score = (record->>'score')::numeric,
          grade = record->>'grade',
          graded_at = (record->>'graded_at')::timestamptz,
          late = (record->>'late')::boolean,
          missing = (record->>'missing')::boolean,
          needs_grading = (record->>'needs_grading')::boolean,
          submission_comments = (record->'submission_comments')::jsonb,
          rubric_assessment = (record->'rubric_assessment')::jsonb,
          lms_submission_id = record->>'lms_submission_id',
          lms_grade_data = (record->'lms_grade_data')::jsonb,
          last_sync_date = (record->>'last_sync_date')::timestamptz,
          updated_at = now()
        WHERE id = existing_grade_id;

        result_grade_id := existing_grade_id;
        result_inserted := false;
        result_updated := true;

      ELSE
        -- Insert new grade
        INSERT INTO activity_grades (
          lms_assignment_id,
          kid_id,
          course_id,
          lms_source,
          submitted_at,
          submission_type,
          workflow_state,
          submission_url,
          score,
          grade,
          graded_at,
          late,
          missing,
          needs_grading,
          submission_comments,
          rubric_assessment,
          lms_submission_id,
          lms_grade_data,
          last_sync_date
        ) VALUES (
          record_assignment_id,
          record_kid_id,
          (record->>'course_id')::integer,
          record->>'lms_source',
          (record->>'submitted_at')::timestamptz,
          record->>'submission_type',
          record->>'workflow_state',
          record->>'submission_url',
          (record->>'score')::numeric,
          record->>'grade',
          (record->>'graded_at')::timestamptz,
          (record->>'late')::boolean,
          (record->>'missing')::boolean,
          (record->>'needs_grading')::boolean,
          (record->'submission_comments')::jsonb,
          (record->'rubric_assessment')::jsonb,
          record->>'lms_submission_id',
          (record->'lms_grade_data')::jsonb,
          (record->>'last_sync_date')::timestamptz
        )
        RETURNING id INTO result_grade_id;

        result_inserted := true;
        result_updated := false;
      END IF;

      -- Return success result
      lms_assignment_id := record_assignment_id;
      grade_id := result_grade_id;
      was_inserted := result_inserted;
      was_updated := result_updated;
      error_message := NULL;
      RETURN NEXT;

    EXCEPTION WHEN OTHERS THEN
      -- Capture error but continue processing
      lms_assignment_id := record_assignment_id;
      grade_id := NULL;
      was_inserted := false;
      was_updated := false;
      error_message := SQLERRM;
      RETURN NEXT;
    END;
  END LOOP;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION safe_bulk_grade_upsert TO authenticated;
GRANT EXECUTE ON FUNCTION safe_bulk_grade_upsert TO service_role;

COMMENT ON FUNCTION safe_bulk_grade_upsert IS
'Bulk upserts grades and teacher comments from LMS sync - inserts new, updates existing';
