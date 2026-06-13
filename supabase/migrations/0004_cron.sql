-- Requires the pg_cron and pg_net extensions (available on Supabase).
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- PREREQUISITE — run ONCE per environment before these jobs can succeed.
-- These are NOT in the migration because the values are environment-specific
-- secrets. Without them, current_setting(...) raises and the scheduled jobs
-- fail silently (errors land in net._http_response, not the logs).
--
--   alter database postgres
--     set app.functions_base_url = 'https://<project-ref>.supabase.co/functions/v1';
--   alter database postgres
--     set app.service_role_key   = '<service-role-key>';
--
-- For local dev the base url is the kong gateway, e.g.
--   'http://kong:8000/functions/v1' (inside the stack) or
--   'http://host.docker.internal:54321/functions/v1'.

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
