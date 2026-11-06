-- Storage buckets + policies, and RPCs for the home feed and the map tab.

-- ----------------------------------------------------------------- buckets
-- `posts`: private (private accounts!) -> client uses signed URLs.
-- Object path convention: {author_id}/{post_id}/{position}.{ext}
-- `avatars`: public, path {user_id}/{filename}.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('posts',   'posts',   false, 20971520,
   array['image/jpeg','image/png','image/webp','image/heic','video/mp4','video/quicktime']),
  ('avatars', 'avatars', true,  5242880,
   array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "read post media of viewable authors"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'posts'
    and public.can_view_content_of(((storage.foldername(name))[1])::uuid)
  );
create policy "upload post media to own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'posts'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "update own post media"
  on storage.objects for update to authenticated
  using (bucket_id = 'posts' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "delete own post media"
  on storage.objects for delete to authenticated
  using (bucket_id = 'posts' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "upload avatar to own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "update own avatar"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "delete own avatar"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- --------------------------------------------------------------- home feed
-- Own posts + posts of accepted followees, newest first, keyset-paginated:
--   supabase.rpc('get_home_feed', { before_ts: lastItem.created_at, page_size: 20 })
-- SECURITY INVOKER (default): RLS on posts still applies.
create function public.get_home_feed(
  before_ts timestamptz default null,
  page_size integer     default 20
)
returns setof public.posts
language sql
stable
set search_path = ''
as $$
  select p.*
    from public.posts p
   where p.deleted_at is null
     and (before_ts is null or p.created_at < before_ts)
     and (
       p.author_id = (select auth.uid())
       or p.author_id in (
         select f.following_id from public.follows f
          where f.follower_id = (select auth.uid()) and f.status = 'accepted')
     )
   order by p.created_at desc
   limit least(greatest(page_size, 1), 50);
$$;

-- ---------------------------------------------------------------- map tab
-- Posts with a location inside the visible map rectangle, with a thumbnail.
--   supabase.rpc('get_posts_in_bounds',
--     { min_lng, min_lat, max_lng, max_lat, max_results: 200 })
-- SECURITY INVOKER: private accounts' posts are excluded by RLS automatically.
create function public.get_posts_in_bounds(
  min_lng     double precision,
  min_lat     double precision,
  max_lng     double precision,
  max_lat     double precision,
  max_results integer default 200
)
returns table (
  post_id        uuid,
  author_id      uuid,
  latitude       double precision,
  longitude      double precision,
  location_name  text,
  thumbnail_path text,
  created_at     timestamptz
)
language sql
stable
set search_path = ''
as $$
  select p.id,
         p.author_id,
         extensions.st_y(p.location::extensions.geometry),
         extensions.st_x(p.location::extensions.geometry),
         p.location_name,
         (select m.storage_path from public.post_media m
           where m.post_id = p.id order by m.position limit 1),
         p.created_at
    from public.posts p
   where p.deleted_at is null
     and p.location is not null
     and p.location operator(extensions.&&)
         extensions.st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326)::extensions.geography
   order by p.created_at desc
   limit least(greatest(max_results, 1), 500);
$$;

revoke execute on function public.get_home_feed, public.get_posts_in_bounds from public, anon;
grant execute on function public.get_home_feed, public.get_posts_in_bounds to authenticated;
