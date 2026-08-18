-- Function: Update activity (completion, scheduling, etc.)
-- Consolidates multiple update patterns from React components
-- Uses actual schema: public.activities

CREATE OR REPLACE FUNCTION public.update_activity(
  p_activity_id INTEGER,
  p_updates JSONB  -- Flexible: any fields to update
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Update the activity with provided fields
  UPDATE public.activities
  SET
    is_completed = COALESCE((p_updates->>'is_completed')::BOOLEAN, is_completed),
    completed_at = CASE
      WHEN (p_updates->>'is_completed')::BOOLEAN = true THEN
        COALESCE((p_updates->>'completed_at')::DATE, NOW())
      WHEN (p_updates->>'is_completed')::BOOLEAN = false THEN NULL
      WHEN p_updates ? 'completed_at' THEN (p_updates->>'completed_at')::DATE
      ELSE completed_at
    END,
   actual_minutes = CASE
      -- If actual_minutes is explicitly provided, use it (manual override)
      WHEN p_updates ? 'actual_minutes' THEN (p_updates->>'actual_minutes')::INTEGER
      ELSE actual_minutes
    END,
    estimated_minutes = COALESCE((p_updates->>'estimated_minutes')::INTEGER, estimated_minutes),
    start_time = CASE
      WHEN p_updates ? 'start_time' THEN (p_updates->>'start_time')::TIMESTAMP
      ELSE start_time
    END,
    end_time = CASE
      WHEN p_updates ? 'end_time' THEN (p_updates->>'end_time')::TIMESTAMP
      ELSE end_time
    END,
    plan_date = COALESCE((p_updates->>'plan_date')::DATE, plan_date),
    title = COALESCE(p_updates->>'title', title),
    description = COALESCE(p_updates->>'description', description),
    course_id = COALESCE((p_updates->>'course_id')::INTEGER, course_id),
    position = COALESCE((p_updates->>'position')::INTEGER, position),
    is_action_override = COALESCE((p_updates->>'is_action_override')::BOOLEAN, is_action_override),
    is_pinned = COALESCE((p_updates->>'is_pinned')::BOOLEAN, is_pinned),
    updated_at = NOW()
  WHERE id = p_activity_id
  RETURNING to_jsonb(activities.*) INTO v_result;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Activity not found: %', p_activity_id;
  END IF;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_activity(INTEGER, JSONB) TO authenticated;

COMMENT ON FUNCTION public.update_activity IS
'Update an activity with flexible field updates. Handles completion timestamp automatically. Used for marking complete, scheduling, updating details, etc.';
