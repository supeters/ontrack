CREATE OR REPLACE FUNCTION safe_sync_activity_update(
  activity_id integer,
  sync_data jsonb
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  -- LMS-provided fields that CAN be updated by sync
  allowed_fields text[] := ARRAY[
    'title',
    'description',
    'lms_id',
    'lms_type',
    'lms_source',
    'lms_url',
    'lms_assignment_id',
    'lms_synced_at',
    'resource_url',
    'position',
    'is_hidden',
    'is_action_sync',
    'item_needs_processing',
    'estimated_minutes',
    'plan_date',
    'items_count',
    'activity_type',
    'sub_type',
    'parent_activity_id',
    'module_id',
    'daily_checklist' -- <-- ADDED HERE
  ];

  -- User-controlled fields that should NEVER be updated by sync
  protected_fields text[] := ARRAY[
    'is_completed',
    'completed_at',
    'actual_minutes',
    'is_action_override',
    'start_time',
    'end_time',
    'minutes_worked',
    'is_pinned',
    'is_deleted',
    'planning_bucket',
    'bucket_assigned_date'
  ];

  field text;
  update_query text;
  set_clauses text[] := ARRAY[]::text[];
BEGIN
  -- Build SET clauses only for allowed fields that exist in sync_data
  FOR field IN SELECT unnest(allowed_fields) LOOP
    IF sync_data ? field THEN
      -- Add to SET clause, properly handling different data types
      CASE
        WHEN field IN ('daily_checklist') THEN
          -- Treat daily_checklist as JSONB instead of text
          set_clauses := array_append(set_clauses, format('%I = %L::jsonb', field, sync_data->field));
        WHEN field IN ('is_hidden', 'is_action_sync', 'item_needs_processing') THEN
          set_clauses := array_append(set_clauses, format('%I = %L::boolean', field, sync_data->>field));
        WHEN field IN ('position', 'items_count', 'estimated_minutes', 'parent_activity_id', 'module_id') THEN
          set_clauses := array_append(set_clauses, format('%I = %L::integer', field, sync_data->>field));
        WHEN field IN ('plan_date') THEN
          set_clauses := array_append(set_clauses, format('%I = %L::date', field, sync_data->>field));
        WHEN field IN ('lms_synced_at') THEN
          set_clauses := array_append(set_clauses, format('%I = %L::timestamp', field, sync_data->>field));
        ELSE
          -- Text fields
          set_clauses := array_append(set_clauses, format('%I = %L', field, sync_data->>field));
      END CASE;
    END IF;
  END LOOP;

  -- Only run UPDATE if there are fields to update
  IF array_length(set_clauses, 1) > 0 THEN
    -- Always update updated_at
    set_clauses := array_append(set_clauses, 'updated_at = now()');

    -- Build and execute update query
    update_query := format(
      'UPDATE activities SET %s WHERE id = %L',
      array_to_string(set_clauses, ', '),
      activity_id
    );

    EXECUTE update_query;

    RAISE DEBUG 'Updated activity % with % fields', activity_id, array_length(set_clauses, 1);
  ELSE
    RAISE DEBUG 'No allowed fields to update for activity %', activity_id;
  END IF;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION safe_sync_activity_update TO authenticated;
GRANT EXECUTE ON FUNCTION safe_sync_activity_update TO service_role;