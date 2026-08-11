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
      WHEN (p_updates->>'is_completed')::BOOLEAN = true THEN NOW()
      WHEN (p_updates->>'is_completed')::BOOLEAN = false THEN NULL
      ELSE completed_at
    END,
    actual_minutes = COALESCE((p_updates->>'actual_minutes')::INTEGER, actual_minutes),
    estimated_minutes = COALESCE((p_updates->>'estimated_minutes')::INTEGER, estimated_minutes),
    start_time = COALESCE((p_updates->>'start_time')::TIMESTAMP, start_time),
    end_time = COALESCE((p_updates->>'end_time')::TIMESTAMP, end_time),
    plan_date = COALESCE((p_updates->>'plan_date')::DATE, plan_date),
    title = COALESCE(p_updates->>'title', title),
    description = COALESCE(p_updates->>'description', description),
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
