create table public.activities (
  id serial not null,
  title text not null,
  description text null,
  activity_type text not null,
  sub_type text null,
  course_id integer null,
  kid_id integer null,
  parent_activity_id integer null,
  plan_date date null,
  estimated_minutes integer null default 30,
  start_time timestamp without time zone null,
  end_time timestamp without time zone null,
  minutes_worked integer null,
  position integer null,
  items_count integer null default 0,
  require_sequential_progress boolean null default false,
  can_mark_complete boolean null default true,
  lms_id text null,
  lms_type text null,
  lms_source text null,
  lms_url text null,
  lms_synced_at timestamp without time zone null,
  is_deleted boolean null default false,
  is_hidden boolean null default false,
  created_at timestamp without time zone null default now(),
  updated_at timestamp without time zone null default now(),
  resource_url text null,
  lms_assignment_id text null,
  item_needs_processing boolean null default false,
  recurrence_id integer null,
  is_archive boolean not null default false,
  planning_bucket character varying(20) null default 'unassigned'::character varying,
  bucket_assigned_date timestamp with time zone null default now(),
  module_id integer null,
  actual_minutes integer null,
  is_completed boolean not null default false,
  is_action_sync boolean null,
  is_action_override boolean null,
  completed_at timestamp without time zone null,
  is_action boolean GENERATED ALWAYS as (COALESCE(is_action_override, is_action_sync)) STORED null,
  is_pinned boolean null default false,
  daily_checklist jsonb null,
  google_event_id text null,
  last_synced_at timestamp with time zone null,
  constraint activities_pkey primary key (id),
  constraint activities_google_event_id_key unique (google_event_id),
  constraint activities_module_id_fkey foreign KEY (module_id) references activities (id) on delete set null,
  constraint activities_parent_activity_id_fkey foreign KEY (parent_activity_id) references activities (id) on delete CASCADE,
  constraint activities_recurrence_id_fkey foreign KEY (recurrence_id) references activity_recurrence (id) on delete set null,
  constraint activities_kid_id_fkey foreign KEY (kid_id) references kids (id) on delete CASCADE,
  constraint activities_course_id_fkey foreign KEY (course_id) references courses (id) on delete CASCADE,
  constraint activities_lms_source_check check (
    (
      (
        lms_source = any (
          array[
            'canvas'::text,
            'moodle'::text,
            'blackboard'::text,
            'manual'::text
          ]
        )
      )
      or (lms_source is null)
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_activities_course_id on public.activities using btree (course_id) TABLESPACE pg_default;

create index IF not exists idx_activities_kid_id on public.activities using btree (kid_id) TABLESPACE pg_default;

create index IF not exists idx_activities_parent_activity_id on public.activities using btree (parent_activity_id) TABLESPACE pg_default;

create index IF not exists idx_activities_plan_date on public.activities using btree (plan_date) TABLESPACE pg_default;

create index IF not exists idx_activities_position on public.activities using btree ("position") TABLESPACE pg_default;

create index IF not exists idx_activities_lms_composite on public.activities using btree (lms_source, lms_type, lms_id) TABLESPACE pg_default
where
  (lms_id is not null);

create index IF not exists idx_activities_visible on public.activities using btree (is_deleted, is_hidden) TABLESPACE pg_default
where
  (
    (is_deleted = false)
    and (is_hidden = false)
  );

create index IF not exists idx_activities_resource_url on public.activities using btree (resource_url) TABLESPACE pg_default
where
  (resource_url is not null);

create index IF not exists idx_activities_lms_assignment_id on public.activities using btree (lms_assignment_id) TABLESPACE pg_default
where
  (lms_assignment_id is not null);

create index IF not exists idx_activities_needs_processing on public.activities using btree (item_needs_processing) TABLESPACE pg_default
where
  (item_needs_processing = true);

create index IF not exists idx_activities_recurrence_id on public.activities using btree (recurrence_id) TABLESPACE pg_default;

create index IF not exists idx_activities_is_archive on public.activities using btree (is_archive) TABLESPACE pg_default;

create index IF not exists idx_activities_planning_bucket on public.activities using btree (planning_bucket) TABLESPACE pg_default;

create index IF not exists idx_activities_bucket_assigned_date on public.activities using btree (bucket_assigned_date) TABLESPACE pg_default;

create index IF not exists idx_activities_module_id on public.activities using btree (module_id) TABLESPACE pg_default;

create index IF not exists idx_activities_actual_minutes on public.activities using btree (actual_minutes) TABLESPACE pg_default;

create trigger activities_module_id_trigger BEFORE INSERT
or
update OF parent_activity_id on activities for EACH row
execute FUNCTION update_activity_module_id ();

create trigger set_manual_assignment_id_trigger BEFORE INSERT
or
update on activities for EACH row
execute FUNCTION set_manual_assignment_id ();