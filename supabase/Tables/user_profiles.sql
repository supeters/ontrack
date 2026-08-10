create table public.user_profiles (
  id serial not null,
  user_id uuid not null,
  full_name text null,
  role text null default 'parent'::text,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  kid_id integer null,
  constraint user_profiles_pkey primary key (id),
  constraint user_profiles_user_id_key unique (user_id),
  constraint user_profiles_kid_id_fkey foreign KEY (kid_id) references kids (id),
  constraint user_profiles_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_user_profiles_role on public.user_profiles using btree (role) TABLESPACE pg_default;

create index IF not exists idx_user_profiles_kid_id on public.user_profiles using btree (kid_id) TABLESPACE pg_default;