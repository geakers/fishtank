-- Goldfish: group study sessions, each with a group leader and a list of members.
-- Run in Supabase > SQL Editor > New query > Run, after the profiles table SQL.
-- Sets up a new project from scratch; the live database already has all of this.
--
-- The code says "group" rather than "session" because session already means the
-- login session and the lock-in timer. The app calls these group study sessions.
--
-- Two tables instead of one with a list column:
--   study_groups         one row per group (name + leader)
--   study_group_members  one row per member of a group (this IS the member list)
-- People are stored by uid, not username, so renaming yourself never breaks a group.

-- 1. Groups. The leader is a user; whoever creates the group becomes its leader.
create table public.study_groups (
  id          bigint generated always as identity primary key,
  name        text not null,
  leader_id   uuid not null default auth.uid() references public.profiles(uid) on delete cascade,
  created_at  timestamptz not null default now()
);

-- 2. The member list: one row per member per group.
create table public.study_group_members (
  group_id    bigint not null references public.study_groups(id) on delete cascade,
  member_id   uuid not null references public.profiles(uid) on delete cascade,
  joined_at   timestamptz not null default now(),
  primary key (group_id, member_id)   -- nobody can be in the same group twice
);

-- 3. "Am I this group's leader?" and "am I a member of this group?", for the
--    security rules.
create function public.is_group_leader(gid bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.study_groups where id = gid and leader_id = auth.uid());
$$;

create function public.is_group_member(gid bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.study_group_members where group_id = gid and member_id = auth.uid());
$$;

-- 4. Security rules.
alter table public.study_groups        enable row level security;
alter table public.study_group_members enable row level security;

-- Groups: you see groups you lead or are in. Only the leader can change them.
create policy "see my groups" on public.study_groups for select to authenticated
  using (leader_id = (select auth.uid()) or public.is_group_member(id));
create policy "create a group as its leader" on public.study_groups for insert to authenticated
  with check (leader_id = (select auth.uid()));
create policy "leader edits group" on public.study_groups for update to authenticated
  using (leader_id = (select auth.uid())) with check (leader_id = (select auth.uid()));
create policy "leader deletes group" on public.study_groups for delete to authenticated
  using (leader_id = (select auth.uid()));

-- Members: you see your own rows, leaders see their whole group. Leaders can
-- remove members. Adding goes through add_member() below.
create policy "see group members" on public.study_group_members for select to authenticated
  using (member_id = (select auth.uid()) or public.is_group_leader(group_id));
create policy "leader removes members" on public.study_group_members for delete to authenticated
  using (public.is_group_leader(group_id));

-- 5. Add a member by their username. Only the group's leader can, and not
--    themselves. The messages show up in the app.
create function public.add_member(gid bigint, member_username text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  mid uuid;
begin
  if not public.is_group_leader(gid) then
    raise exception 'only the group leader can add members';
  end if;
  select uid into mid from public.profiles where username = member_username;
  if mid is null then
    raise exception 'no user called %', member_username;
  end if;
  -- The caller is this group's leader (checked above), so this is them.
  if mid = auth.uid() then
    raise exception 'you lead this study session, so you can''t also be a member of it';
  end if;
  insert into public.study_group_members (group_id, member_id) values (gid, mid)
  on conflict do nothing;
end;
$$;

-- 6. Everyone in a group, by username (emails stay hidden), with role 'leader'
--    or 'member'. Only for people in that group.
create function public.group_roster(gid bigint)
returns table (username text, role text)
language sql stable security definer set search_path = '' as $$
  select p.username, 'leader'
    from public.study_groups g join public.profiles p on p.uid = g.leader_id
   where g.id = gid and (public.is_group_leader(gid) or public.is_group_member(gid))
  union all
  select p.username, 'member'
    from public.study_group_members m join public.profiles p on p.uid = m.member_id
   where m.group_id = gid and (public.is_group_leader(gid) or public.is_group_member(gid));
$$;

-- 7. Search usernames, so a leader can find people to add. Returns up to 10
--    usernames containing the search text (any case), names that start with it
--    first. Only usernames come back; emails and uids stay hidden.
create function public.search_usernames(query text)
returns table (username text)
language sql stable security definer set search_path = '' as $$
  select p.username
    from public.profiles p
   where length(trim(query)) > 0
     and strpos(lower(p.username), lower(trim(query))) > 0
   order by not starts_with(lower(p.username), lower(trim(query))), p.username
   limit 10;
$$;

-- 8. Only logged-in users can call the functions.
revoke execute on function public.is_group_leader(bigint)   from public, anon;
revoke execute on function public.is_group_member(bigint)   from public, anon;
revoke execute on function public.add_member(bigint, text)  from public, anon;
revoke execute on function public.group_roster(bigint)      from public, anon;
revoke execute on function public.search_usernames(text)    from public, anon;
grant  execute on function public.is_group_leader(bigint)   to authenticated;
grant  execute on function public.is_group_member(bigint)   to authenticated;
grant  execute on function public.add_member(bigint, text)  to authenticated;
grant  execute on function public.group_roster(bigint)      to authenticated;
grant  execute on function public.search_usernames(text)    to authenticated;
