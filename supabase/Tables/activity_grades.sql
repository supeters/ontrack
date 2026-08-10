create table public.activity_grades (
  id serial not null,
  kid_id integer null,
  submitted_at timestamp without time zone null,
  submission_type text null,
  workflow_state text null,
  score numeric null,
  grade text null,
  graded_at timestamp without time zone null,
  late boolean null default false,
  missing boolean null default false,
  needs_grading boolean null default false,
  submission_url text null,
  submission_comments jsonb null,
  rubric_assessment jsonb null,
  lms_submission_id text null,
  lms_grade_data jsonb null,
  created_at timestamp without time zone null default now(),
  updated_at timestamp without time zone null default now(),
  course_id integer null,
  lms_source text null,
  last_sync_date timestamp without time zone null,
  lms_assignment_id text null,
  constraint activity_grades_pkey primary key (id),
  constraint activity_grades_course_id_fkey foreign KEY (course_id) references courses (id) on delete CASCADE,
  constraint activity_grades_kid_id_fkey foreign KEY (kid_id) references kids (id),
  constraint activity_grades_lms_source_check check (
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

create index IF not exists idx_activity_grades_lms_assignment_id on public.activity_grades using btree (lms_assignment_id) TABLESPACE pg_default;

create index IF not exists idx_activity_grades_kid_id on public.activity_grades using btree (kid_id) TABLESPACE pg_default;

create index IF not exists idx_activity_grades_course_id on public.activity_grades using btree (course_id) TABLESPACE pg_default;

create index IF not exists idx_activity_grades_lms_source on public.activity_grades using btree (lms_source) TABLESPACE pg_default;

create index IF not exists idx_activity_grades_last_sync on public.activity_grades using btree (last_sync_date) TABLESPACE pg_default;