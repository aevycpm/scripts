-- Aevy CPM ecosystem: Supabase schema + Row Level Security.
-- Run once: Supabase dashboard -> SQL Editor -> New query -> paste this whole file -> Run.
-- Safe to re-run (idempotent).

-- ---------- profiles: public info only (email stays in auth.users) ----------
create table if not exists public.profiles (
  id       uuid primary key references auth.users(id) on delete cascade,
  username text not null check (username ~ '^[a-z0-9_]{3,20}$'),
  name     text not null check (char_length(name) between 1 and 40),
  bio      text not null default '' check (char_length(bio) <= 280),
  color    text not null default '#c8f53c' check (color ~ '^#[0-9a-fA-F]{6}$'),
  created  timestamptz not null default now()
);
create unique index if not exists profiles_username_key on public.profiles (username);

-- ---------- scripts: metadata ----------
create table if not exists public.scripts (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null references public.profiles(id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 80),
  lang        text not null check (lang in ('javascript','typescript','python','bash','lua','go','rust','html','css','json','text')),
  author      text not null default '' check (char_length(author) <= 40),
  description text not null default '' check (char_length(description) <= 220),
  tags        text[] not null default '{}' check (cardinality(tags) <= 8),
  cat         text not null default 'Other' check (cat in ('Vehicles & Tuning','Visual & Graphics','Gameplay & Physics','Tools & Utilities','Maps & Environment','Other')),
  vis         text not null default 'public' check (vis in ('public','private')),
  video       text not null default '' check (char_length(video) <= 300),
  size        integer not null default 0 check (size between 0 and 2097152),
  lines       integer not null default 0 check (lines >= 0),
  preview     text not null default '' check (char_length(preview) <= 1500),
  created     timestamptz not null default now(),
  updated     timestamptz not null default now()
);
create index if not exists scripts_owner_idx on public.scripts (owner);
create index if not exists scripts_vis_created_idx on public.scripts (vis, created desc);

-- ---------- script_files: the file content itself (max 2 MB) ----------
create table if not exists public.script_files (
  script_id uuid primary key references public.scripts(id) on delete cascade,
  code      text not null check (octet_length(code) <= 2097152)
);

-- ---------- videos: strictly private saved videos ----------
create table if not exists public.videos (
  id      uuid primary key default gen_random_uuid(),
  owner   uuid not null references public.profiles(id) on delete cascade,
  url     text not null check (char_length(url) <= 500),
  title   text not null default '' check (char_length(title) <= 90),
  created timestamptz not null default now()
);
create index if not exists videos_owner_idx on public.videos (owner);

-- ---------- triggers ----------
-- Owner, created and updated can never be forged or changed by the client.
create or replace function public.scripts_guard() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.created := now();
    new.updated := now();
  else
    new.owner   := old.owner;
    new.created := old.created;
    new.updated := now();
  end if;
  return new;
end $$;
drop trigger if exists scripts_guard on public.scripts;
create trigger scripts_guard before insert or update on public.scripts
  for each row execute function public.scripts_guard();

create or replace function public.profiles_guard() returns trigger
language plpgsql as $$
begin
  new.id       := old.id;
  new.username := old.username;   -- usernames are permanent
  new.created  := old.created;
  return new;
end $$;
drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.profiles_guard();

-- Email sign-ups pass username + name as user metadata; the profile is created here so it works
-- even when "Confirm email" is on (no session yet). Google users have no username: the app asks for one.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  un text := lower(coalesce(new.raw_user_meta_data->>'username', ''));
  nm text := left(coalesce(nullif(btrim(new.raw_user_meta_data->>'name'), ''), un), 40);
begin
  if un ~ '^[a-z0-9_]{3,20}$' then
    insert into public.profiles (id, username, name, color)
    values (new.id, un, nm,
      (array['#c8f53c','#5ec8ff','#ff9f5a','#c792ff','#ff6b8b','#4de0b0'])[1 + abs(hashtext(un)) % 6]);
  end if;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Lets a signed-in user delete their own account (cascades to profile, scripts, files, videos).
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  delete from auth.users where id = auth.uid();
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ---------- Row Level Security ----------
alter table public.profiles     enable row level security;
alter table public.scripts      enable row level security;
alter table public.script_files enable row level security;
alter table public.videos       enable row level security;

-- profiles: public read; only the owner writes their own row
drop policy if exists profiles_read   on public.profiles;
drop policy if exists profiles_insert on public.profiles;
drop policy if exists profiles_update on public.profiles;
drop policy if exists profiles_delete on public.profiles;
create policy profiles_read   on public.profiles for select using (true);
create policy profiles_insert on public.profiles for insert to authenticated with check (id = (select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy profiles_delete on public.profiles for delete to authenticated using (id = (select auth.uid()));

-- scripts: public ones readable by everyone, private only by the owner; only the owner writes
drop policy if exists scripts_read   on public.scripts;
drop policy if exists scripts_insert on public.scripts;
drop policy if exists scripts_update on public.scripts;
drop policy if exists scripts_delete on public.scripts;
create policy scripts_read   on public.scripts for select using (vis = 'public' or owner = (select auth.uid()));
create policy scripts_insert on public.scripts for insert to authenticated with check (owner = (select auth.uid()));
create policy scripts_update on public.scripts for update to authenticated using (owner = (select auth.uid())) with check (owner = (select auth.uid()));
create policy scripts_delete on public.scripts for delete to authenticated using (owner = (select auth.uid()));

-- script_files: follows the visibility of its script
drop policy if exists files_read   on public.script_files;
drop policy if exists files_insert on public.script_files;
drop policy if exists files_update on public.script_files;
drop policy if exists files_delete on public.script_files;
create policy files_read on public.script_files for select using (
  exists (select 1 from public.scripts s where s.id = script_id and (s.vis = 'public' or s.owner = (select auth.uid()))));
create policy files_insert on public.script_files for insert to authenticated with check (
  exists (select 1 from public.scripts s where s.id = script_id and s.owner = (select auth.uid())));
create policy files_update on public.script_files for update to authenticated
  using      (exists (select 1 from public.scripts s where s.id = script_id and s.owner = (select auth.uid())))
  with check (exists (select 1 from public.scripts s where s.id = script_id and s.owner = (select auth.uid())));
create policy files_delete on public.script_files for delete to authenticated using (
  exists (select 1 from public.scripts s where s.id = script_id and s.owner = (select auth.uid())));

-- videos: strictly private
drop policy if exists videos_read   on public.videos;
drop policy if exists videos_insert on public.videos;
drop policy if exists videos_delete on public.videos;
create policy videos_read   on public.videos for select to authenticated using (owner = (select auth.uid()));
create policy videos_insert on public.videos for insert to authenticated with check (owner = (select auth.uid()));
create policy videos_delete on public.videos for delete to authenticated using (owner = (select auth.uid()));

-- ---------- grants ----------
grant usage on schema public to anon, authenticated;
grant select on public.profiles, public.scripts, public.script_files to anon;
grant select, insert, update, delete on public.profiles, public.scripts, public.script_files, public.videos to authenticated;
