create table public.school_calendars (
  id serial not null,
  school_id integer null,
  school_year_name text not null,
  term_name text not null,
  start_date date not null,
  end_date date not null,
  created_at timestamp with time zone null default CURRENT_TIMESTAMP,
  updated_at timestamp with time zone null default CURRENT_TIMESTAMP,
  week_start_day integer null default 0,
  constraint school_calendars_pkey primary key (id),
  constraint school_calendars_school_id_fkey foreign KEY (school_id) references schools (id) on delete CASCADE,
  constraint school_calendars_school_year_name_fkey foreign KEY (school_year_name) references school_years (name) on delete CASCADE
) TABLESPACE pg_default;