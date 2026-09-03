-- Add kid_id column to family_relationships to support kids without logins
-- This allows parents to be linked to kids even if the kid doesn't have their own user account

ALTER TABLE family_relationships
  ADD COLUMN kid_id integer REFERENCES kids(id) ON DELETE CASCADE;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_family_relationships_kid_id
  ON family_relationships(kid_id);

-- Update the family_relationships RLS policy to allow access via kid_id
DROP POLICY IF EXISTS "Family relationships access" ON family_relationships;

CREATE POLICY "Family relationships access"
  ON family_relationships
  FOR SELECT
  USING (
    auth.uid() = parent_user_id
    OR auth.uid() = child_user_id
    OR EXISTS (
      SELECT 1 FROM kids
      WHERE kids.id = family_relationships.kid_id
        AND kids.user_id = auth.uid()
    )
  );

COMMENT ON COLUMN family_relationships.kid_id IS
  'Links parent to kid when kid does not have their own login account. Use either child_user_id (for kids with login) or kid_id (for kids without login), but not both.';
