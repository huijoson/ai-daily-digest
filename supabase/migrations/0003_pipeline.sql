-- Atomically mark a summary failed and bump its attempt counter.
create or replace function increment_summary_failure(p_article_id uuid)
returns void language sql as $$
  update summaries
     set status = 'failed', attempts = attempts + 1, updated_at = now()
   where article_id = p_article_id;
$$;
