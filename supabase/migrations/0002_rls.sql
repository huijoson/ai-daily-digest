alter table sources     enable row level security;
alter table articles    enable row level security;
alter table summaries   enable row level security;
alter table push_tokens enable row level security;

create policy "own sources" on sources
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own push tokens" on push_tokens
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- articles & summaries are written ONLY by the pipeline via the service-role key
-- (which bypasses RLS). Authenticated app clients get read-only (SELECT) access.
create policy "read own articles" on articles
  for select using (exists (
    select 1 from sources s
    where s.id = articles.source_id and s.user_id = auth.uid()));

create policy "read own summaries" on summaries
  for select using (exists (
    select 1 from articles a
    join sources s on s.id = a.source_id
    where a.id = summaries.article_id and s.user_id = auth.uid()));
