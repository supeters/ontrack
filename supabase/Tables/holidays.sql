create table public.holidays (
  id serial not null,
  calendar_id integer not null,
  name text not null,
  start_date date not null,
  end_date date null,
  holiday_type text null default 'break'::text,
  description text null,
  created_at timestamp with time zone null default now(),
  constraint holidays_pkey primary key (id)
) TABLESPACE pg_default;