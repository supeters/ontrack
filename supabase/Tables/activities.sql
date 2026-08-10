-- OnTrack Schema: Activities Table
-- This is the actual schema from the production Supabase database

CREATE TABLE IF NOT EXISTS public.activities (
  id serial NOT NULL,
  title text NOT NULL,
  description text NULL,
  activity_type text NOT NULL,
  sub_type text NULL,
  course_id integer NULL,
  kid_id integer NULL,
  parent_activity_id integer NULL,
  plan_date date NULL,
  estimated_minutes integer NULL DEFAULT 30,
  start_time timestamp without time zone NULL,
  end_time timestamp without time zone NULL,
  minutes_worked integer NULL,
  position integer NULL,
  items_count integer NULL DEFAULT 0,
  require_sequential_progress boolean NULL DEFAULT false,
  can_mark_complete boolean NULL DEFAULT true,
  lms_id text NULL,
  lms_type text NULL,
  lms_source text NULL,
  lms_url text NULL,
  lms_synced_at timestamp without time zone NULL,
  is_deleted boolean NULL DEFAULT false,
  is_hidden boolean NULL DEFAULT false,
  created_at timestamp without time zone NULL DEFAULT now(),
  updated_at timestamp without time zone NULL DEFAULT now(),
  resource_url text NULL,
  lms_assignment_id text NULL,
  item_needs_processing boolean NULL DEFAULT false,
  recurrence_id integer NULL,
  is_archive boolean NOT NULL DEFAULT false,
  planning_bucket character varying(20) NULL DEFAULT 'unassigned'::character varying,
  bucket_assigned_date timestamp with time zone NULL DEFAULT now(),
  module_id integer NULL,
  actual_minutes integer NULL,
  is_completed boolean NOT NULL DEFAULT false,
  is_action_sync boolean NULL,
  is_action_override boolean NULL,
  completed_at timestamp without time zone NULL,
  is_action boolean GENERATED ALWAYS AS (COALESCE(is_action_override, is_action_sync)) STORED NULL,
  is_pinned boolean NULL DEFAULT false,
  CONSTRAINT activities_pkey PRIMARY KEY (id),
  CONSTRAINT activities_kid_id_fkey FOREIGN KEY (kid_id) REFERENCES kids (id) ON DELETE CASCADE,
  CONSTRAINT activities_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses (id) ON DELETE CASCADE,
  CONSTRAINT activities_parent_activity_id_fkey FOREIGN KEY (parent_activity_id) REFERENCES activities (id) ON DELETE CASCADE,
  CONSTRAINT activities_module_id_fkey FOREIGN KEY (module_id) REFERENCES activities (id) ON DELETE SET NULL,
  CONSTRAINT activities_recurrence_id_fkey FOREIGN KEY (recurrence_id) REFERENCES activity_recurrence (id) ON DELETE SET NULL,
  CONSTRAINT activities_lms_source_check CHECK (
    (
      (
        lms_source = ANY (
          ARRAY[
            'canvas'::text,
            'moodle'::text,
            'blackboard'::text,
            'manual'::text
          ]
        )
      )
      OR (lms_source IS NULL)
    )
  )
) TABLESPACE pg_default;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_activities_course_id ON public.activities USING btree (course_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_activities_kid_id ON public.activities USING btree (kid_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_activities_parent_activity_id ON public.activities USING btree (parent_activity_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_activities_plan_date ON public.activities USING btree (plan_date) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_activities_position ON public.activities USING btree ("position") TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_activities_lms_composite ON public.activities USING btree (lms_source, lms_type, lms_id) TABLESPACE pg_default WHERE (lms_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_activities_visible ON public.activities USING btree (is_deleted, is_hidden) TABLESPACE pg_default WHERE ((is_deleted = false) AND (is_hidden = false));
CREATE INDEX IF NOT EXISTS idx_activities_resource_url ON public.activities USING btree (resource_url) TABLESPACE pg_default WHERE (resource_url IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_activities_lms_assignment_id ON public.activities USING btree (lms_assignment_id) TABLESPACE pg_default WHERE (lms_assignment_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_activities_needs_processing ON public.activities USING btree (item_needs_processing) TABLESPACE pg_default WHERE (item_needs_processing = true);
CREATE INDEX IF NOT EXISTS idx_activities_recurrence_id ON public.activities USING btree (recurrence_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_activities_is_archive ON public.activities USING btree (is_archive) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_activities_planning_bucket ON public.activities USING btree (planning_bucket) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_activities_bucket_assigned_date ON public.activities USING btree (bucket_assigned_date) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_activities_module_id ON public.activities USING btree (module_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_activities_actual_minutes ON public.activities USING btree (actual_minutes) TABLESPACE pg_default;

-- Triggers
-- Note: Trigger functions (update_activity_module_id, set_manual_assignment_id) need to be defined separately
CREATE TRIGGER activities_module_id_trigger
  BEFORE INSERT OR UPDATE OF parent_activity_id
  ON activities
  FOR EACH ROW
  EXECUTE FUNCTION update_activity_module_id();

CREATE TRIGGER set_manual_assignment_id_trigger
  BEFORE INSERT OR UPDATE
  ON activities
  FOR EACH ROW
  EXECUTE FUNCTION set_manual_assignment_id();

-- Comments
COMMENT ON TABLE public.activities IS 'Activities/tasks for students - includes assignments, events, modules, and custom tasks';
COMMENT ON COLUMN public.activities.is_action IS 'Computed field: true if this is an actionable item (vs just informational)';
