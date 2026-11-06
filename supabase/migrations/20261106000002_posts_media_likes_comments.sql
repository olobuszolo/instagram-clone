-- Posts, carousel media, likes, comments (+ replies, comment likes).

-- ------------------------------------------------------------------- posts
create table public.posts (
  id            uuid primary key default gen_random_uuid(),
  author_id     uuid not null references public.profiles (id) on delete cascade,
  description   text check (char_length(description) <= 2200),
  location_name text check (char_length(location_name) <= 200),
  -- WGS84 point. Insert via WKT: 'SRID=4326;POINT(<lng> <lat>)'  (lng first!)
  location      extensions.geography(Point, 4326),
  like_count    integer not null default 0 check (like_count >= 0),
  comment_count integer not null default 0 check (comment_count >= 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz                       -- soft delete
);

create index posts_author_created_idx on public.posts (author_id, created_at desc)
  where deleted_at is null;
create index posts_created_idx on public.posts (created_at desc)
  where deleted_at is null;
create index posts_location_idx on public.posts using gist (location)
  where deleted_at is null and location is not null;

create trigger posts_set_updated_at
  before update on public.posts
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------- post_media
create type public.media_type as enum ('image', 'video');

create table public.post_media (
  id           uuid primary key default gen_random_uuid(),
  post_id      uuid not null references public.posts (id) on delete cascade,
  storage_path text not null,                     -- path in the `posts` bucket
  media_type   public.media_type not null default 'image',
  width        integer check (width > 0),
  height       integer check (height > 0),
  blurhash     text,
  position     smallint not null check (position between 0 and 9),  -- max 10 slides
  created_at   timestamptz not null default now(),
  unique (post_id, position)
);

-- ------------------------------------------------------------------ likes
create table public.likes (
  post_id    uuid not null references public.posts (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index likes_user_idx on public.likes (user_id, created_at desc);

-- --------------------------------------------------------------- comments
create table public.comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts (id) on delete cascade,
  author_id  uuid not null references public.profiles (id) on delete cascade,
  parent_id  uuid references public.comments (id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 2200),
  like_count integer not null default 0 check (like_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index comments_post_idx   on public.comments (post_id, created_at);
create index comments_parent_idx on public.comments (parent_id) where parent_id is not null;

create trigger comments_set_updated_at
  before update on public.comments
  for each row execute function public.set_updated_at();

-- Replies must target a top-level comment on the same post (one level deep).
create function public.comments_validate_parent()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent public.comments;
begin
  if new.parent_id is not null then
    select * into parent from public.comments where id = new.parent_id;
    if not found or parent.post_id <> new.post_id or parent.parent_id is not null then
      raise exception 'reply must target a top-level comment on the same post';
    end if;
  end if;
  return new;
end;
$$;

create trigger comments_before_insert_validate
  before insert on public.comments
  for each row execute function public.comments_validate_parent();

create table public.comment_likes (
  comment_id uuid not null references public.comments (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

-- ----------------------------------------------------- denormalized counters
create function public.bump_post_like_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set like_count = like_count + 1 where id = new.post_id;
  else
    update public.posts set like_count = greatest(like_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end;
$$;

create trigger likes_count_ins after insert on public.likes
  for each row execute function public.bump_post_like_count();
create trigger likes_count_del after delete on public.likes
  for each row execute function public.bump_post_like_count();

create function public.bump_comment_like_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.comments set like_count = like_count + 1 where id = new.comment_id;
  else
    update public.comments set like_count = greatest(like_count - 1, 0) where id = old.comment_id;
  end if;
  return null;
end;
$$;

create trigger comment_likes_count_ins after insert on public.comment_likes
  for each row execute function public.bump_comment_like_count();
create trigger comment_likes_count_del after delete on public.comment_likes
  for each row execute function public.bump_comment_like_count();

-- comment_count counts live (non-soft-deleted) comments, replies included.
create function public.bump_post_comment_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.deleted_at is null then
      update public.posts set comment_count = comment_count + 1 where id = new.post_id;
    end if;
  elsif tg_op = 'DELETE' then
    if old.deleted_at is null then
      update public.posts set comment_count = greatest(comment_count - 1, 0) where id = old.post_id;
    end if;
  else -- UPDATE of deleted_at
    if old.deleted_at is null and new.deleted_at is not null then
      update public.posts set comment_count = greatest(comment_count - 1, 0) where id = new.post_id;
    elsif old.deleted_at is not null and new.deleted_at is null then
      update public.posts set comment_count = comment_count + 1 where id = new.post_id;
    end if;
  end if;
  return null;
end;
$$;

create trigger comments_count_ins after insert on public.comments
  for each row execute function public.bump_post_comment_count();
create trigger comments_count_del after delete on public.comments
  for each row execute function public.bump_post_comment_count();
create trigger comments_count_upd after update of deleted_at on public.comments
  for each row execute function public.bump_post_comment_count();

-- ------------------------------------------------------------ RLS & grants
alter table public.posts         enable row level security;
alter table public.post_media    enable row level security;
alter table public.likes         enable row level security;
alter table public.comments      enable row level security;
alter table public.comment_likes enable row level security;

revoke all on public.posts, public.post_media, public.likes,
              public.comments, public.comment_likes from anon;

-- Counters and ownership columns are server-managed: clients get column-level
-- UPDATE only on what they may legitimately edit.
revoke update on public.posts, public.post_media, public.comments from authenticated;
grant update (description, location_name, location, deleted_at) on public.posts to authenticated;
grant update (position, width, height, blurhash) on public.post_media to authenticated;
grant update (body, deleted_at) on public.comments to authenticated;
revoke update on public.likes, public.comment_likes from authenticated;

-- posts: owner always sees own rows (incl. soft-deleted, so that soft-delete
-- UPDATE works); others see live posts of public / followed accounts.
-- NOTE: clients must filter `deleted_at is null` in their own queries.
create policy "read visible posts"
  on public.posts for select to authenticated
  using (
    author_id = (select auth.uid())
    or (deleted_at is null and public.can_view_content_of(author_id))
  );
create policy "create own posts"
  on public.posts for insert to authenticated
  with check (author_id = (select auth.uid()));
create policy "update own posts"
  on public.posts for update to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));
create policy "delete own posts"
  on public.posts for delete to authenticated
  using (author_id = (select auth.uid()));

-- post_media: inherits visibility from the parent post (posts RLS applies
-- inside the subquery).
create policy "read media of visible posts"
  on public.post_media for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id));
create policy "owner adds media"
  on public.post_media for insert to authenticated
  with check (exists (
    select 1 from public.posts p
     where p.id = post_id and p.author_id = (select auth.uid())));
create policy "owner updates media"
  on public.post_media for update to authenticated
  using (exists (
    select 1 from public.posts p
     where p.id = post_id and p.author_id = (select auth.uid())));
create policy "owner deletes media"
  on public.post_media for delete to authenticated
  using (exists (
    select 1 from public.posts p
     where p.id = post_id and p.author_id = (select auth.uid())));

-- likes
create policy "read likes of visible posts"
  on public.likes for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id and p.deleted_at is null));
create policy "like as yourself"
  on public.likes for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.posts p where p.id = post_id and p.deleted_at is null));
create policy "remove own like"
  on public.likes for delete to authenticated
  using (user_id = (select auth.uid()));

-- comments
create policy "read comments of visible posts"
  on public.comments for select to authenticated
  using (
    exists (select 1 from public.posts p where p.id = post_id and p.deleted_at is null)
    and (deleted_at is null or author_id = (select auth.uid()))
  );
create policy "comment as yourself"
  on public.comments for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (select 1 from public.posts p where p.id = post_id and p.deleted_at is null));
create policy "edit own comments"
  on public.comments for update to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));
-- Comment author or the post owner may delete a comment.
create policy "delete own comments or comments on own posts"
  on public.comments for delete to authenticated
  using (
    author_id = (select auth.uid())
    or exists (select 1 from public.posts p
                where p.id = post_id and p.author_id = (select auth.uid())));

-- comment likes
create policy "read comment likes"
  on public.comment_likes for select to authenticated
  using (exists (select 1 from public.comments c where c.id = comment_id));
create policy "like comment as yourself"
  on public.comment_likes for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.comments c where c.id = comment_id));
create policy "remove own comment like"
  on public.comment_likes for delete to authenticated
  using (user_id = (select auth.uid()));
