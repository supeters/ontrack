create table public.family_relationships (
  id uuid not null default gen_random_uuid (),
  parent_user_id uuid null,
  child_user_id uuid null,
  kid_id integer null,
  relationship_type text null default 'parent-child'::text,
  created_at timestamp with time zone null default timezone ('utc'::text, now()),
  constraint family_relationships_pkey primary key (id),
  constraint family_relationships_child_user_id_fkey foreign KEY (child_user_id) references auth.users (id),
  constraint family_relationships_parent_user_id_fkey foreign KEY (parent_user_id) references auth.users (id),
  constraint family_relationships_kid_id_fkey foreign KEY (kid_id) references kids (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_family_relationships_kid_id on public.family_relationships using btree (kid_id) TABLESPACE pg_default;