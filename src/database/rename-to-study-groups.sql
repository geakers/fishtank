-- Goldfish: rename the classes tables and functions to the study group theme.
-- Run once in Supabase > SQL Editor > New query > Run, after the classes SQL
-- and search-usernames.sql. Existing groups and members are kept.
--
--   classes          -> study_groups         (class_name -> name, teacher_id -> leader_id)
--   class_students   -> study_group_members  (class_id -> group_id, student_id -> member_id)
--   is_class_teacher -> is_group_leader      is_class_student -> is_group_member
--   add_student      -> add_member           class_roster     -> group_roster
--                                            (roles 'teacher'/'student' -> 'leader'/'member')
--
-- The code says "group" rather than "session" because session already means the
-- login session and the lock-in timer. The app calls these group study sessions.
--
-- Everything runs in one transaction: if any step fails, nothing changes.

begin;

-- 1. Tables and columns. Renaming keeps the rows, keys, foreign keys, the
--    leader_id default (auth.uid()) and row level security.
alter table public.classes rename to study_groups;
alter table public.study_groups rename column class_name to name;
alter table public.study_groups rename column teacher_id to leader_id;

alter table public.class_students rename to study_group_members;
alter table public.study_group_members rename column class_id to group_id;
alter table public.study_group_members rename column student_id to member_id;

-- Constraint names (and the indexes behind them) still say class; rename the
-- ones that have their default names.
do $$
declare
  renames text[] := array[
    'public.study_groups',        'classes_pkey',                   'study_groups_pkey',
    'public.study_groups',        'classes_teacher_id_fkey',        'study_groups_leader_id_fkey',
    'public.study_group_members', 'class_students_pkey',            'study_group_members_pkey',
    'public.study_group_members', 'class_students_class_id_fkey',   'study_group_members_group_id_fkey',
    'public.study_group_members', 'class_students_student_id_fkey', 'study_group_members_member_id_fkey'
  ];
begin
  for i in 0 .. array_length(renames, 1) / 3 - 1 loop
    if exists (select 1 from pg_constraint
                where conrelid = renames[i * 3 + 1]::regclass and conname = renames[i * 3 + 2]) then
      execute format('alter table %s rename constraint %I to %I',
                     renames[i * 3 + 1], renames[i * 3 + 2], renames[i * 3 + 3]);
    end if;
  end loop;
end $$;

-- 2. The old policies call the old functions, so drop every policy on the two
--    tables. They are recreated with the new names in step 4.
do $$
declare
  p record;
begin
  for p in select tablename, policyname from pg_policies
            where schemaname = 'public' and tablename in ('study_groups', 'study_group_members') loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

-- 3. The functions store their bodies as text, so they still name the old
--    tables. Replace them with versions under the new names.
drop function public.add_student(bigint, text);
drop function public.class_roster(bigint);
drop function public.is_class_teacher(bigint);
drop function public.is_class_student(bigint);

-- "Am I this group's leader?" and "am I a member of this group?", for the policies.
create function public.is_group_leader(gid bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.study_groups where id = gid and leader_id = auth.uid());
$$;

create function public.is_group_member(gid bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.study_group_members where group_id = gid and member_id = auth.uid());
$$;

-- Add a member by their username. Only the group's leader can, and not themselves.
-- The messages show up in the app.
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

-- Everyone in a group, by username (emails stay hidden), with role 'leader' or
-- 'member'. Only for people in that group.
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

revoke execute on function public.is_group_leader(bigint)     from public, anon;
revoke execute on function public.is_group_member(bigint)     from public, anon;
revoke execute on function public.add_member(bigint, text)    from public, anon;
revoke execute on function public.group_roster(bigint)        from public, anon;
grant  execute on function public.is_group_leader(bigint)     to authenticated;
grant  execute on function public.is_group_member(bigint)     to authenticated;
grant  execute on function public.add_member(bigint, text)    to authenticated;
grant  execute on function public.group_roster(bigint)        to authenticated;

-- 4. Security rules, same as before under the new names.
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
-- remove members. Adding goes through add_member().
create policy "see group members" on public.study_group_members for select to authenticated
  using (member_id = (select auth.uid()) or public.is_group_leader(group_id));
create policy "leader removes members" on public.study_group_members for delete to authenticated
  using (public.is_group_leader(group_id));

commit;

-- Let the API see the new names right away.
notify pgrst, 'reload schema';
