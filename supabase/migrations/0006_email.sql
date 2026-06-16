-- Add the 'email' source kind and a full-text content column for articles.
alter type source_type add value if not exists 'email';
alter table articles add column if not exists content text;
