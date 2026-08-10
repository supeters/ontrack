create table public.school_years (
  name text not null,
  is_current boolean null default false,
  constraint school_years_pkey primary key (name)
) TABLESPACE pg_default;