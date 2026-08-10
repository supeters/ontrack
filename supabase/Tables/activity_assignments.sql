create table public.activity_assignments (
  id serial not null,
  points_possible numeric null,
  submission_types text[] null,
  published boolean null default true,
  unlock_at timestamp without time zone null,
  lock_at timestamp without time zone null,
  due_date timestamp without time zone null,
  completion_requirement text null,
  min_score numeric null,
  lms_assignment_data jsonb null,
  created_at timestamp without time zone null default now(),
  updated_at timestamp without time zone null default now(),
  course_id integer null,
  lms_source text null,
  lms_assignment_id text null,
  last_sync_date timestamp without time zone null,
  cutoff_date timestamp without time zone null,
  description text null,
  content_id text null,
  constraint activity_assignments_pkey primary key (id),
  constraint activity_assignments_course_id_fkey foreign KEY (course_id) references courses (id) on delete CASCADE,
  constraint activity_assignments_lms_source_check check (
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

create index IF not exists idx_activity_assignments_content_id on public.activity_assignments using btree (content_id) TABLESPACE pg_default;

create index IF not exists idx_activity_assignments_course_id on public.activity_assignments using btree (course_id) TABLESPACE pg_default;

create index IF not exists idx_activity_assignments_lms_source on public.activity_assignments using btree (lms_source) TABLESPACE pg_default;

create index IF not exists idx_activity_assignments_lms_id on public.activity_assignments using btree (lms_assignment_id) TABLESPACE pg_default;

create index IF not exists idx_activity_assignments_last_sync on public.activity_assignments using btree (last_sync_date) TABLESPACE pg_default;