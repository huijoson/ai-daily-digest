create type source_type as enum ('rss', 'youtube', 'hackernews');
create type summary_status as enum ('pending', 'done', 'failed');

create table sources (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  type        source_type not null,
  feed_url    text,
  title       text,
  is_active   boolean not null default true,
  last_error  text,
  created_at  timestamptz not null default now()
);

create table articles (
  id            uuid primary key default gen_random_uuid(),
  source_id     uuid not null references sources(id) on delete cascade,
  guid          text not null,
  title         text not null,
  url           text not null,
  published_at  timestamptz,
  fetched_at    timestamptz not null default now(),
  unique (source_id, guid)
);

create table summaries (
  id            uuid primary key default gen_random_uuid(),
  article_id    uuid not null unique references articles(id) on delete cascade,
  summary_text  text,
  model         text,
  status        summary_status not null default 'pending',
  attempts      int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table push_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  expo_token  text not null,
  platform    text not null,
  created_at  timestamptz not null default now(),
  unique (user_id, expo_token)
);

create index articles_source_id_idx on articles(source_id);
create index summaries_status_idx on summaries(status);
