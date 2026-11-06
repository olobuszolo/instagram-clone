-- Profiles & follows. Auth itself (auth.users) is managed by Supabase Auth.

create extension if not exists citext with schema extensions;
create extension if not exists postgis with schema extensions;

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  username    extensions.citext not null unique
              check (username ~ '^[a-zA-Z0-9._]{3,30}$'),
  full_name   text check (char_length(full_name) <= 100),
  bio         text check (char_length(bio) <= 500),
  avatar_path text,
  is_private  boolean not null default false,  -- public by default
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Generic updated_at trigger, reused by other tables.
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create a profile automatically whenever someone signs up.
-- Client may pass { username, full_name } in signUp options.data.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  desired text := nullif(new.raw_user_meta_data ->> 'username', '');
begin
  if desired is null
     or desired !~ '^[a-zA-Z0-9._]{3,30}$'
     or exists (select 1 from public.profiles where username = desired::extensions.citext) then
    desired := 'user_' || substr(replace(new.id::text, '-', ''), 1, 12);
  end if;

  insert into public.profiles (id, username, full_name)
  values (new.id, desired, nullif(new.raw_user_meta_data ->> 'full_name', ''));

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------- follows
create type public.follow_status as enum ('pending', 'accepted');

create table public.follows (
  follower_id  uuid not null references public.profiles (id) on delete cascade,
  following_id uuid not null references public.profiles (id) on delete cascade,
  status       public.follow_status not null default 'accepted',
  created_at   timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create index follows_following_idx on public.follows (following_id, status);

-- The status is decided by the server, never by the client:
-- following a private account creates a pending request.
create function public.follows_set_initial_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select case when p.is_private then 'pending'::public.follow_status
              else 'accepted'::public.follow_status end
    into new.status
    from public.profiles p
   where p.id = new.following_id;
  return new;
end;
$$;

create trigger follows_before_insert
  before insert on public.follows
  for each row execute function public.follows_set_initial_status();

-- When an account switches to public, pending requests are auto-accepted.
create function public.profiles_accept_pending_when_public()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.is_private and not new.is_private then
    update public.follows set status = 'accepted'
     where following_id = new.id and status = 'pending';
  end if;
  return new;
end;
$$;

create trigger profiles_after_privacy_change
  after update of is_private on public.profiles
  for each row execute function public.profiles_accept_pending_when_public();

-- -------------------------------------------------------- visibility helper
-- True if the current user may see content (posts, media) authored by `author`.
-- SECURITY DEFINER so it can read follows/profiles regardless of their RLS.
create function public.can_view_content_of(author uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    author = (select auth.uid())
    or exists (select 1 from public.profiles p where p.id = author and not p.is_private)
    or exists (
      select 1 from public.follows f
       where f.follower_id = (select auth.uid())
         and f.following_id = author
         and f.status = 'accepted'
    );
$$;

-- ---------------------------------------------------------------- security
alter table public.profiles enable row level security;
alter table public.follows  enable row level security;

revoke all on public.profiles, public.follows from anon;
revoke insert, update, delete on public.profiles from authenticated;
grant update (username, full_name, bio, avatar_path, is_private)
  on public.profiles to authenticated;
revoke update on public.follows from authenticated;
grant update (status) on public.follows to authenticated;

-- Profiles are discoverable (like Instagram: private accounts show name/bio,
-- only the posts are hidden).
create policy "profiles are readable by signed-in users"
  on public.profiles for select to authenticated using (true);

create policy "users update their own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "follows visible to involved users or when target is viewable"
  on public.follows for select to authenticated
  using (
    follower_id = (select auth.uid())
    or following_id = (select auth.uid())
    or (status = 'accepted' and public.can_view_content_of(following_id))
  );

create policy "users follow as themselves"
  on public.follows for insert to authenticated
  with check (follower_id = (select auth.uid()));

-- The followed user approves a pending request.
create policy "followed user accepts requests"
  on public.follows for update to authenticated
  using (following_id = (select auth.uid()))
  with check (following_id = (select auth.uid()));

-- Either side can remove the relation (unfollow / reject / remove follower).
create policy "either side deletes a follow"
  on public.follows for delete to authenticated
  using (follower_id = (select auth.uid()) or following_id = (select auth.uid()));
