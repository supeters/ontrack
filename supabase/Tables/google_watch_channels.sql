create table public.google_watch_channels (
  id uuid not null default gen_random_uuid (),
  kid_id text not null,
  channel_id text not null,
  resource_id text not null,
  expiration timestamp with time zone not null,
  created_at timestamp with time zone null default now(),
  constraint google_watch_channels_pkey primary key (id),
  constraint google_watch_channels_channel_id_key unique (channel_id)
) TABLESPACE pg_default;