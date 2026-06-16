-- Store the content image URLs extracted from an article's source (email).
alter table articles add column if not exists image_urls text[];
