CREATE OR REPLACE FUNCTION safe_sync_upsert_activity(
  lookup_key jsonb,
  sync_data jsonb
)
RETURNS TABLE (
  activity_id integer,
  was_inserted boolean,
  was_updated boolean,
  was_skipped boolean
)
LANGUAGE plpgsql
AS $$
DECLARE
  existing_id integer;
  new_id integer;
  lms_id_val text;
  course_id_val integer;
  lms_source_val text;
  existing_record RECORD;
  has_changes boolean := false;
BEGIN
  -- Extract lookup values
  lms_id_val := lookup_key->>'lms_id';
  course_id_val := (lookup_key->>'course_id')::integer;
  lms_source_val := lookup_key->>'lms_source';

  -- Check if activity exists and get current values for comparison
  SELECT
    id,
    title,
    description,
    lms_url,
    resource_url,
    position,
    is_action_sync,
    is_hidden,
    lms_type,
    activity_type,
    parent_activity_id,
    module_id
  INTO existing_record
  FROM activities
  WHERE lms_id = lms_id_val
    AND course_id = course_id_val
    AND (lms_source = lms_source_val OR lms_source_val IS NULL);

  IF existing_record.id IS NOT NULL THEN
    -- Activity exists - check if any LMS-provided fields or daily_checklist changed
    -- Use IS DISTINCT FROM for nullable fields to properly handle JSON null vs SQL NULL
    has_changes :=
      (existing_record.title IS DISTINCT FROM (sync_data->>'title')) OR
      (existing_record.description IS DISTINCT FROM NULLIF(sync_data->>'description', 'null')) OR
      (existing_record.lms_url IS DISTINCT FROM NULLIF(sync_data->>'lms_url', 'null')) OR
      (existing_record.resource_url IS DISTINCT FROM NULLIF(sync_data->>'resource_url', 'null')) OR
      COALESCE(existing_record.position, 0) != COALESCE((sync_data->>'position')::integer, 0) OR
      COALESCE(existing_record.is_action_sync, false) != COALESCE((sync_data->>'is_action_sync')::boolean, false) OR
      COALESCE(existing_record.is_hidden, false) != COALESCE((sync_data->>'is_hidden')::boolean, false) OR
      (existing_record.lms_type IS DISTINCT FROM (sync_data->>'lms_type')) OR
      (existing_record.activity_type IS DISTINCT FROM (sync_data->>'activity_type')) OR
      COALESCE(existing_record.parent_activity_id, 0) != COALESCE((sync_data->>'parent_activity_id')::integer, 0) OR
      -- Skip module_id comparison for modules (trigger auto-sets to self-reference)
      (existing_record.activity_type != 'module' AND COALESCE(existing_record.module_id, 0) != COALESCE((sync_data->>'module_id')::integer, 0));

    IF has_changes THEN
      -- Data changed - perform safe update (preserves user fields)
      -- Set item_needs_processing = true to trigger date recalculation
      sync_data := sync_data || jsonb_build_object('item_needs_processing', true);
      PERFORM safe_sync_activity_update(existing_record.id, sync_data);

      activity_id := existing_record.id;
      was_inserted := false;
      was_updated := true;
      was_skipped := false;
      RETURN NEXT;
    ELSE
      -- No changes detected - skip update to save DB operations
      activity_id := existing_record.id;
      was_inserted := false;
      was_updated := false;
      was_skipped := true;
      RETURN NEXT;
    END IF;
  ELSE
    -- Activity doesn't exist - safe to insert everything
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
    was_updated := false;
    was_skipped := false;
    RETURN NEXT;
  END IF;
END;
$$;