-- Safe Bulk Sync Upsert Function V2
-- Efficiently processes multiple activity upserts in a single call
-- OPTIMIZATION: Only updates records that actually changed
-- Returns detailed stats for each operation
--
-- Usage:
--   SELECT * FROM safe_bulk_sync_upsert(
--     sync_records => '[...]'::jsonb
--   );
--
-- Returns: lms_id, activity_id, was_inserted, was_updated, was_skipped, error_message

CREATE OR REPLACE FUNCTION safe_bulk_sync_upsert(
  sync_records jsonb
)
RETURNS TABLE (
  lms_id text,
  activity_id integer,
  was_inserted boolean,
  was_updated boolean,
  was_skipped boolean,
  error_message text
)
LANGUAGE plpgsql
AS $$
DECLARE
  record jsonb;
  lookup_key jsonb;
  sync_data jsonb;
  result_record RECORD;
  record_lms_id text;
BEGIN
  -- Process each record in the array
  FOR record IN SELECT jsonb_array_elements(sync_records)
  LOOP
    BEGIN
      -- Extract lms_id for tracking
      record_lms_id := record->>'lms_id';

      -- Build lookup key (fields used to find existing record)
      lookup_key := jsonb_build_object(
        'lms_id', record->>'lms_id',
        'course_id', record->>'course_id',
        'lms_source', record->>'lms_source'
      );

      -- Sync data is everything except the lookup keys
      sync_data := record - 'lms_id';

      -- Call the upsert function
      SELECT * INTO result_record
      FROM safe_sync_upsert_activity(lookup_key, sync_data);

      -- Return result with detailed stats
      lms_id := record_lms_id;
      activity_id := result_record.activity_id;
      was_inserted := result_record.was_inserted;
      was_updated := result_record.was_updated;
      was_skipped := result_record.was_skipped;
      error_message := NULL;
      RETURN NEXT;

    EXCEPTION WHEN OTHERS THEN
      -- Capture error but continue processing
      lms_id := record_lms_id;
      activity_id := NULL;
      was_inserted := false;
      was_updated := false;
      was_skipped := false;
      error_message := SQLERRM;
      RETURN NEXT;
    END;
  END LOOP;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION safe_bulk_sync_upsert TO authenticated;
GRANT EXECUTE ON FUNCTION safe_bulk_sync_upsert TO service_role;

COMMENT ON FUNCTION safe_bulk_sync_upsert IS
'Bulk upserts activities from LMS sync - inserts new, updates changed, skips unchanged (preserving user data)';
