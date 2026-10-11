-- Goldfish: leaving a group study session.
-- Run in Supabase > SQL Editor > New query > Run, after study-groups.sql.
--
-- Nothing in study-groups.sql changes. Until now only a group's leader could
-- take someone off the member list; this lets members take themselves off.

-- 1. Leave a group I'm a member of. The leader can't leave their own group;
--    they delete it instead. The messages show up in the app.
create function public.leave_group(gid bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if public.is_group_leader(gid) then
    raise exception 'you lead this group, so you can''t leave it';
  end if;
  delete from public.study_group_members where group_id = gid and member_id = auth.uid();
  if not found then
    raise exception 'you aren''t in this group';
  end if;
end;
$$;

-- 2. Only logged-in users can call the function.
revoke execute on function public.leave_group(bigint) from public, anon;
grant  execute on function public.leave_group(bigint) to authenticated;
