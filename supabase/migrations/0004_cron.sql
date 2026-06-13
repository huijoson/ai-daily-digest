-- Requires the pg_cron and pg_net extensions (available on Supabase).
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Run fetch at 07:00 UTC, then summarize at 07:05 UTC daily.
-- app.functions_base_url and app.service_role_key are environment-specific DB settings.
select cron.schedule(
  'daily-fetch', '0 7 * * *',
  $$ select net.http_post(
       url := current_setting('app.functions_base_url') || '/fetch',
       headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key'))
     ); $$
);

select cron.schedule(
  'daily-summarize', '5 7 * * *',
  $$ select net.http_post(
       url := current_setting('app.functions_base_url') || '/summarize',
       headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key'))
     ); $$
);
