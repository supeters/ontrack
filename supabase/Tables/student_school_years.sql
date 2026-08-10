create table public.student_school_years (
  id serial not null,
  kid_id integer not null,
  school_year_name text not null,
  grade_level text null,
  enrollment_date date null default CURRENT_DATE,
  created_at timestamp with time zone null default now(),
  constraint student_school_years_pkey primary key (id),
  constraint student_school_years_kid_id_school_year_id_key unique (kid_id, school_year_name),
  constraint student_school_years_kid_id_fkey foreign KEY (kid_id) references kids (id) on delete CASCADE,
  constraint student_school_years_school_year_name_fkey foreign KEY (school_year_name) references school_years (name) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_student_school_years_kid_id on public.student_school_years using btree (kid_id) TABLESPACE pg_default;