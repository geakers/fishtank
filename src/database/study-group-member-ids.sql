-- Goldfish: who wrote which note in a group study session.
-- Run in Supabase > SQL Editor > New query > Run, after study-groups.sql.
--
-- Nothing in study-groups.sql changes. A note only records its owner's uid, and
-- group_roster() only gives usernames, so the app had no way to put a name to a
-- group note. The group study plan needs that to say what each member should
-- focus on.

-- 1. Everyone in a group, as uid and username (emails stay hidden). Only for
--    people in that group.
create function public.group_member_ids(gid bigint)
returns table (uid uuid, username text)
language sql stable security definer set search_path = '' as $$
  select p.uid, p.username
    from public.study_groups g join public.profiles p on p.uid = g.leader_id
   where g.id = gid and (public.is_group_leader(gid) or public.is_group_member(gid))
  union all
  select p.uid, p.username
    from public.study_group_members m join public.profiles p on p.uid = m.member_id
   where m.group_id = gid and (public.is_group_leader(gid) or public.is_group_member(gid));
$$;

-- 2. Only logged-in users can call the function.
revoke execute on function public.group_member_ids(bigint) from public, anon;
grant  execute on function public.group_member_ids(bigint) to authenticated;
