create table public.kids (
  id serial not null,
  name text not null,
  age integer null,
  personality text null,
  level text null,
  points integer null default 0,
  weekly_goal text null,
  user_id uuid null,
  email text null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  competition_rank integer null default 1,
  constraint kids_pkey primary key (id),
  constraint kids_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE,
  constraint kids_email_key unique (email)
) TABLESPACE pg_default;

create index IF not exists idx_kids_user_id on public.kids using btree (user_id) TABLESPACE pg_default;

create index IF not exists idx_kids_email on public.kids using btree (email) TABLESPACE pg_default
where (email is not null);