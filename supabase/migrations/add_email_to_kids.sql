-- Add email to kids table so we can link them when they sign up
ALTER TABLE kids
  ADD COLUMN email text UNIQUE;

-- Create index for email lookups
CREATE INDEX IF NOT EXISTS idx_kids_email
  ON kids(email)
  WHERE email IS NOT NULL;

-- Create a trigger function to automatically link kids when they sign up
CREATE OR REPLACE FUNCTION link_kid_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  matching_kid_id integer;
  parent_user_id uuid;
BEGIN
  -- Check if there's a kid record with this email (and no user_id yet)
  SELECT id INTO matching_kid_id
  FROM kids
  WHERE email = NEW.email
    AND user_id IS NULL
  LIMIT 1;

  -- If found, link the kid to this new user
  IF matching_kid_id IS NOT NULL THEN
    -- Update kid record with new user_id
    UPDATE kids
    SET user_id = NEW.id
    WHERE id = matching_kid_id;

    -- Find the parent from family_relationships (via kid_id)
    SELECT fr.parent_user_id INTO parent_user_id
    FROM family_relationships fr
    WHERE fr.kid_id = matching_kid_id
    LIMIT 1;

    -- If parent exists, update family_relationship to use child_user_id
    IF parent_user_id IS NOT NULL THEN
      UPDATE family_relationships
      SET child_user_id = NEW.id
      WHERE kid_id = matching_kid_id
        AND parent_user_id = parent_user_id;

      -- Note: We keep kid_id as well for backward compatibility
    END IF;

    -- Create user profile for the kid
    INSERT INTO user_profiles (user_id, full_name, role, kid_id)
    VALUES (
      NEW.id,
      (SELECT name FROM kids WHERE id = matching_kid_id),
      'student',
      matching_kid_id
    )
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on auth.users table (runs after user signs up)
DROP TRIGGER IF EXISTS on_auth_user_created_link_kid ON auth.users;

CREATE TRIGGER on_auth_user_created_link_kid
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION link_kid_on_signup();

COMMENT ON COLUMN kids.email IS
  'Optional email for kid. When kid signs up with this email, they are automatically linked to their kid record and parent relationship.';

COMMENT ON FUNCTION link_kid_on_signup IS
  'Automatically links a new auth user to their kid record if email matches. Updates family_relationships from kid_id to child_user_id.';
