begin;
select plan(8);

-- two users
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@test.dev'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.dev');

-- user A owns a source
insert into sources (id, user_id, type, feed_url)
  values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          '11111111-1111-1111-1111-111111111111', 'rss', 'https://a.dev/feed');

insert into articles (id, source_id, guid, title, url)
  values ('cccccccc-cccc-cccc-cccc-cccccccccccc',
          'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'g1', 'T', 'https://a.dev/1');

insert into summaries (id, article_id, status)
  values ('dddddddd-dddd-dddd-dddd-dddddddddddd',
          'cccccccc-cccc-cccc-cccc-cccccccccccc', 'done');

insert into push_tokens (id, user_id, expo_token, platform)
  values ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
          '11111111-1111-1111-1111-111111111111', 'ExponentPushToken[x]', 'ios');

-- act as user B
set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select is(
  (select count(*) from sources where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  0::bigint, 'user B cannot see user A''s source');
select is(
  (select count(*) from articles where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
  0::bigint, 'user B cannot see user A''s article');
select is(
  (select count(*) from summaries where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'),
  0::bigint, 'user B cannot see user A''s summary');
select is(
  (select count(*) from push_tokens where id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'),
  0::bigint, 'user B cannot see user A''s push token');

-- act as user A
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select is(
  (select count(*) from sources where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  1::bigint, 'user A can see their own source');
select is(
  (select count(*) from articles where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
  1::bigint, 'user A can see their own article');
select is(
  (select count(*) from summaries where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'),
  1::bigint, 'user A can see their own summary');
select is(
  (select count(*) from push_tokens where id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'),
  1::bigint, 'user A can see their own push token');

select * from finish();
rollback;
