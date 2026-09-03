CREATE OR REPLACE FUNCTION get_accessible_kid_ids()
RETURNS SETOF INTEGER
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  -- Return kid IDs for:
  -- 1. The logged-in user's own kid record (when user is a student)
  SELECT id FROM kids WHERE user_id = auth.uid()

  UNION

  -- 2. Kids where the logged-in user is the parent (child has their own login)
  SELECT k.id
  FROM kids k
  JOIN family_relationships fr ON k.user_id = fr.child_user_id
  WHERE fr.parent_user_id = auth.uid()

  UNION

  -- 3. Kids where the logged-in user is the parent (child does NOT have login)
  SELECT kid_id
  FROM family_relationships
  WHERE parent_user_id = auth.uid()
    AND kid_id IS NOT NULL
$$;

COMMENT ON FUNCTION get_accessible_kid_ids IS
  'Returns kid IDs accessible by the current user: their own kid record (if student), or their children (if parent). Supports both kids with login accounts (via child_user_id) and kids without login accounts (via kid_id).';
