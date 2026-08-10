create table public.schools (
  id serial not null,
  name text not null,
  district text null,
  address text null,
  phone text null,
  website text null,
  created_by_user_id uuid not null,
  created_at timestamp with time zone null default now(),
  constraint schools_pkey primary key (id),
  constraint schools_created_by_user_id_fkey foreign KEY (created_by_user_id) references auth.users (id)
) TABLESPACE pg_default;