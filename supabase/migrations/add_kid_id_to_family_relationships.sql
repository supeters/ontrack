-- Add kid_id column to family_relationships to support kids without logins
-- This allows parents to be linked to kids even if the kid doesn't have their own user account

ALTER TABLE family_relationships
  ADD COLUMN kid_id integer REFERENCES kids(id) ON DELETE CASCADE;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_family_relationships_kid_id
  ON family_relationships(kid_id);

-- Note: family_relationships RLS policy remains unchanged to avoid recursion
-- The existing policy checks parent_user_id and child_user_id only
-- Kids without login are accessed via parent_user_id, not via kid_id check

COMMENT ON COLUMN family_relationships.kid_id IS
  'Links parent to kid when kid does not have their own login account. Use either child_user_id (for kids with login) or kid_id (for kids without login), but not both.';
