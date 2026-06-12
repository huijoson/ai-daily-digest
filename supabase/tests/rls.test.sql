begin;
select plan(2);

-- two users
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@test.dev'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.dev');

-- user A owns a source
insert into sources (id, user_id, type, feed_url)
  values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          '11111111-1111-1111-1111-111111111111', 'rss', 'https://a.dev/feed');

-- act as user B
set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select is(
  (select count(*) from sources where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  0::bigint, 'user B cannot see user A''s source');

-- act as user A
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select is(
  (select count(*) from sources where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  1::bigint, 'user A can see their own source');

select * from finish();
rollback;
