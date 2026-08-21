create table public.google_sync_tokens (
  id uuid not null default gen_random_uuid (),
  kid_id text not null,
  access_token text not null,
  refresh_token text not null,
  token_expires_at timestamp with time zone not null,
  sync_token text null,
  updated_at timestamp with time zone null default now(),
  calendar_id text not null default 'primary'::text,
  next_sync_token text null,
  constraint google_sync_tokens_pkey primary key (id),
  constraint google_sync_tokens_kid_id_key unique (kid_id)
) TABLESPACE pg_default;