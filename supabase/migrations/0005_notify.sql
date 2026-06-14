-- Count summaries that became 'done' today, grouped by the owning user.
create or replace function user_digests_today()
returns table (user_id uuid, new_count bigint)
language sql stable as $$
  select s.user_id, count(*) as new_count
    from summaries sm
    join articles a on a.id = sm.article_id
    join sources  s on s.id = a.source_id
   where sm.status = 'done'
     and sm.updated_at >= date_trunc('day', now())
   group by s.user_id;
$$;

-- Send the daily digest at 07:10 UTC, after fetch (07:00) and summarize (07:05).
select cron.schedule(
  'daily-notify', '10 7 * * *',
  $$ select net.http_post(
       url := current_setting('app.functions_base_url') || '/notify',
       headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key'))
     ); $$
);
