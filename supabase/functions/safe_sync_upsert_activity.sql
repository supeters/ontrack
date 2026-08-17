-- Safe Sync Upsert Activity Function
-- Inserts new activities or updates existing ones during LMS sync
-- Preserves user-entered data while updating LMS-provided fields
--
-- Usage:
--   SELECT safe_sync_upsert_activity(
--     lookup_key => jsonb_build_object(
--       'lms_id', '12345',
--       'course_id', 51,
--       'lms_source', 'canvas'
--     ),
--     sync_data => jsonb_build_object(
--       'title', 'Assignment 1',
--       'description', '<p>Do this</p>',
--       'lms_url', 'https://...',
--       'is_action_sync', true,
--       'parent_activity_id', 123
--     )
--   );

CREATE OR REPLACE FUNCTION safe_sync_upsert_activity(
  lookup_key jsonb,
  sync_data jsonb
)
RETURNS TABLE (
  activity_id integer,
  was_inserted boolean
)
LANGUAGE plpgsql
AS $$
DECLARE
  existing_id integer;
  new_id integer;
  lms_id_val text;
  course_id_val integer;
  lms_source_val text;
BEGIN
  -- Extract lookup values
  lms_id_val := lookup_key->>'lms_id';
  course_id_val := (lookup_key->>'course_id')::integer;
  lms_source_val := lookup_key->>'lms_source';

  -- Check if activity exists
  SELECT id INTO existing_id
  FROM activities
  WHERE lms_id = lms_id_val
    AND course_id = course_id_val
    AND (lms_source = lms_source_val OR lms_source_val IS NULL);

  IF existing_id IS NOT NULL THEN
    -- Activity exists - use safe update (preserves user data)
    PERFORM safe_sync_activity_update(existing_id, sync_data);

    activity_id := existing_id;
    was_inserted := false;
    RETURN NEXT;
  ELSE
    -- Activity doesn't exist - safe to insert everything
    -- Merge lookup_key and sync_data
    INSERT INTO activities (
      lms_id,
      course_id,
      lms_source,
      title,
      description,
      activity_type,
      sub_type,
      lms_type,
      lms_url,
      lms_assignment_id,
      resource_url,
      position,
      is_hidden,
      is_action_sync,
      item_needs_processing,
      estimated_minutes,
      plan_date,
      items_count,
      parent_activity_id,
      module_id,
      kid_id,
      lms_synced_at,
      created_at,
      updated_at
    )
    VALUES (
      lms_id_val,
      course_id_val,
      COALESCE(lms_source_val, sync_data->>'lms_source'),
      sync_data->>'title',
      sync_data->>'description',
      COALESCE(sync_data->>'activity_type', 'assignment'),
      sync_data->>'sub_type',
      sync_data->>'lms_type',
      sync_data->>'lms_url',
      sync_data->>'lms_assignment_id',
      sync_data->>'resource_url',
      COALESCE((sync_data->>'position')::integer, 0),
      COALESCE((sync_data->>'is_hidden')::boolean, false),
      COALESCE((sync_data->>'is_action_sync')::boolean, true),
      COALESCE((sync_data->>'item_needs_processing')::boolean, true),
      (sync_data->>'estimated_minutes')::integer,
      (sync_data->>'plan_date')::date,
      (sync_data->>'items_count')::integer,
      (sync_data->>'parent_activity_id')::integer,
      (sync_data->>'module_id')::integer,
      (sync_data->>'kid_id')::integer,
      COALESCE((sync_data->>'lms_synced_at')::timestamp, NOW()),
      NOW(),
      NOW()
    )
    RETURNING id INTO new_id;

    activity_id := new_id;
    was_inserted := true;
    RETURN NEXT;
  END IF;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION safe_sync_upsert_activity TO authenticated;
GRANT EXECUTE ON FUNCTION safe_sync_upsert_activity TO service_role;

COMMENT ON FUNCTION safe_sync_upsert_activity IS
'Upserts activity from LMS sync - inserts if new, safely updates if exists (preserving user data)';
