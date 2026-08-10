create table public.courses (
  id serial not null,
  course_name text not null,
  kid_id integer null,
  school_id integer null,
  calendar_id integer null,
  course_webpage text null,
  meeting_link text null,
  google_drive_folder text null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  subject text null,
  teacher text null,
  course_code text null,
  lms_account_id integer null,
  source_type text null default 'manual'::text,
  workflow_state text null default 'active'::text,
  is_active boolean null default true,
  sync_status text null default 'manual'::text,
  lms_synced_at timestamp with time zone null,
  lms_course_id text null,
  activities_last_sync timestamp with time zone null,
  work_days text null,
  class_days text null,
  exclusion_patterns jsonb null,
  mnemonic text null,
  constraint courses_pkey primary key (id),
  constraint courses_school_id_fkey foreign KEY (school_id) references schools (id),
  constraint courses_calendar_id_fkey foreign KEY (calendar_id) references school_calendars (id),
  constraint courses_kid_id_fkey foreign KEY (kid_id) references kids (id) on delete CASCADE,
  constraint courses_lms_account_id_fkey foreign KEY (lms_account_id) references lms_accounts (id) on delete set null,
  constraint courses_sync_status_check check (
    (
      sync_status = any (
        array[
          'manual'::text,
          'synced'::text,
          'error'::text,
          'pending'::text
        ]
      )
    )
  ),
  constraint courses_source_type_check check (
    (
      source_type = any (
        array[
          'manual'::text,
          'canvas'::text,
          'moodle'::text,
          'imported'::text
        ]
      )
    )
  ),
  constraint check_lms_course_consistency check (
    (
      (
        (
          source_type = any (array['canvas'::text, 'moodle'::text])
        )
        and (lms_course_id is not null)
      )
      or (
        (
          source_type = any (array['manual'::text, 'imported'::text])
        )
        and (lms_course_id is null)
      )
      or (source_type is null)
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_courses_exclusion_patterns on public.courses using gin (exclusion_patterns) TABLESPACE pg_default;

create index IF not exists idx_courses_is_active on public.courses using btree (is_active) TABLESPACE pg_default
where
  (is_active = true);

create index IF not exists idx_courses_kid_id on public.courses using btree (kid_id) TABLESPACE pg_default;

create index IF not exists idx_courses_lms_account_id on public.courses using btree (lms_account_id) TABLESPACE pg_default;

create index IF not exists idx_courses_lms_course_id on public.courses using btree (lms_course_id) TABLESPACE pg_default
where
  (lms_course_id is not null);

create index IF not exists idx_courses_lms_lookup on public.courses using btree (lms_course_id, source_type) TABLESPACE pg_default
where
  (lms_course_id is not null);

create unique INDEX IF not exists idx_courses_lms_unique on public.courses using btree (lms_course_id, source_type, lms_account_id) TABLESPACE pg_default
where
  (
    (lms_course_id is not null)
    and (source_type is not null)
    and (lms_account_id is not null)
  );

create index IF not exists idx_courses_source_type on public.courses using btree (source_type) TABLESPACE pg_default;

create index IF not exists idx_courses_subject on public.courses using btree (subject) TABLESPACE pg_default;

create index IF not exists idx_courses_sync_status on public.courses using btree (sync_status) TABLESPACE pg_default;

create trigger auto_set_course_subject BEFORE INSERT
or
update on courses for EACH row
execute FUNCTION update_course_subject_from_code ();