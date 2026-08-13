-- Function: Get course module hierarchy (modules, workgroups, activities)
-- Replaces complex client-side queries and grouping in CourseModuleView.jsx

CREATE OR REPLACE FUNCTION public.get_course_modules(
  p_kid_id INTEGER,
  p_course_id INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Get all activities for this course organized into hierarchy
  WITH all_activities AS (
    SELECT *
    FROM public.activities
    WHERE kid_id = p_kid_id
      AND course_id = p_course_id
      
    ORDER BY position
  ),
  modules AS (
    SELECT
      a.*,
      -- Get direct activities (not in workgroups)
      (
        SELECT jsonb_agg(to_jsonb(act.*) ORDER BY act.position)
        FROM all_activities act
        WHERE act.module_id = a.id
          AND act.activity_type NOT IN ('module', 'workgroup')
          AND (act.parent_activity_id IS NULL OR act.parent_activity_id = a.id)
      ) AS direct_activities,
      -- Get workgroups
      (
        SELECT jsonb_agg(
          to_jsonb(wg.*) || jsonb_build_object(
            'activities', (
              SELECT jsonb_agg(to_jsonb(wg_act.*) ORDER BY wg_act.position)
              FROM all_activities wg_act
              WHERE wg_act.parent_activity_id = wg.id
                AND wg_act.activity_type NOT IN ('module', 'workgroup')
            ),
            'stats', jsonb_build_object(
              'total', (
                SELECT COUNT(*)
                FROM all_activities wg_act
                WHERE wg_act.parent_activity_id = wg.id
                  AND wg_act.activity_type NOT IN ('module', 'workgroup')
              ),
              'completed', (
                SELECT COUNT(*)
                FROM all_activities wg_act
                WHERE wg_act.parent_activity_id = wg.id
                  AND wg_act.activity_type NOT IN ('module', 'workgroup')
                  AND wg_act.is_completed = true
              ),
              'totalTime', (
                SELECT COALESCE(SUM(estimated_minutes), 0)
                FROM all_activities wg_act
                WHERE wg_act.parent_activity_id = wg.id
                  AND wg_act.activity_type NOT IN ('module', 'workgroup')
              )
            )
          )
          ORDER BY wg.position
        )
        FROM all_activities wg
        WHERE wg.activity_type = 'workgroup'
          AND wg.parent_activity_id = a.id
      ) AS workgroups
    FROM all_activities a
    WHERE a.activity_type = 'module'
  )
  SELECT jsonb_agg(
    to_jsonb(m.*) || jsonb_build_object(
      'stats', jsonb_build_object(
        'total', (
          SELECT COUNT(*)
          FROM all_activities act
          WHERE act.module_id = m.id
            AND act.activity_type NOT IN ('module', 'workgroup')
        ),
        'completed', (
          SELECT COUNT(*)
          FROM all_activities act
          WHERE act.module_id = m.id
            AND act.activity_type NOT IN ('module', 'workgroup')
            AND act.is_completed = true
        ),
        'totalTime', (
          SELECT COALESCE(SUM(estimated_minutes), 0)
          FROM all_activities act
          WHERE act.module_id = m.id
            AND act.activity_type NOT IN ('module', 'workgroup')
        )
      )
    )
    ORDER BY m.position
  )
  INTO v_result
  FROM modules m;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_course_modules(INTEGER, INTEGER) TO authenticated;

COMMENT ON FUNCTION public.get_course_modules IS
'Get hierarchical course structure: modules with workgroups and activities, including stats. Used by CourseModuleView.';
