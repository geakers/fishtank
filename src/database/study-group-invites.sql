-- Goldfish: invites to group study sessions. A leader invites someone by
-- username; that person joins the group only once they accept.
-- Run in Supabase > SQL Editor > New query > Run, after study-groups.sql.
--
-- Nothing in study-groups.sql changes. add_member() still adds someone
-- straight away; the app now uses invite_member() instead.

-- 1. Pending invites: one row per invited person per group. The row goes away
--    when the invite is accepted or declined.
create table public.study_group_invites (
  group_id    bigint not null references public.study_groups(id) on delete cascade,
  invitee_id  uuid not null references public.profiles(uid) on delete cascade,
  invited_at  timestamptz not null default now(),
  primary key (group_id, invitee_id)   -- nobody can be invited to the same group twice
);

-- 2. Security rules. There are no policies, so nobody can read or change this
--    table directly; everything goes through the functions below.
alter table public.study_group_invites enable row level security;

-- 3. Invite someone by their username. Only the group's leader can, and not
--    themselves or someone already in the group. The messages show up in the app.
create function public.invite_member(gid bigint, member_username text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  mid uuid;
begin
  if not public.is_group_leader(gid) then
    raise exception 'only the group leader can invite people';
  end if;
  select uid into mid from public.profiles where username = member_username;
  if mid is null then
    raise exception 'no user called %', member_username;
  end if;
  -- The caller is this group's leader (checked above), so this is them.
  if mid = auth.uid() then
    raise exception 'you lead this group, so you''re already in it';
  end if;
  if exists (select 1 from public.study_group_members where group_id = gid and member_id = mid) then
    raise exception '% is already in this group', member_username;
  end if;
  insert into public.study_group_invites (group_id, invitee_id) values (gid, mid)
  on conflict do nothing;
end;
$$;

-- 4. The invites waiting for me, oldest first, with the group's name and its
--    leader's username. (Row level security hides a group from people who
--    aren't in it yet, so the app can't look these up itself.)
create function public.my_invites()
returns table (group_id bigint, group_name text, leader text)
language sql stable security definer set search_path = '' as $$
  select g.id, g.name, p.username
    from public.study_group_invites i
    join public.study_groups g on g.id = i.group_id
    join public.profiles p on p.uid = g.leader_id
   where i.invitee_id = auth.uid()
   order by i.invited_at;
$$;

-- 5. Accept my invite to a group: I become a member and the invite goes away.
create function public.accept_invite(gid bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.study_group_invites where group_id = gid and invitee_id = auth.uid();
  if not found then
    raise exception 'that invite is no longer available';
  end if;
  insert into public.study_group_members (group_id, member_id) values (gid, auth.uid())
  on conflict do nothing;
end;
$$;

-- 6. Decline my invite to a group.
create function public.decline_invite(gid bigint) returns void
language sql security definer set search_path = '' as $$
  delete from public.study_group_invites where group_id = gid and invitee_id = auth.uid();
$$;

-- 7. Usernames of the people invited to a group who haven't answered yet.
--    Only for the group's leader.
create function public.group_invites(gid bigint)
returns table (username text)
language sql stable security definer set search_path = '' as $$
  select p.username
    from public.study_group_invites i join public.profiles p on p.uid = i.invitee_id
   where i.group_id = gid and public.is_group_leader(gid)
   order by i.invited_at;
$$;

-- 8. Only logged-in users can call the functions.
revoke execute on function public.invite_member(bigint, text) from public, anon;
revoke execute on function public.my_invites()                from public, anon;
revoke execute on function public.accept_invite(bigint)       from public, anon;
revoke execute on function public.decline_invite(bigint)      from public, anon;
revoke execute on function public.group_invites(bigint)       from public, anon;
grant  execute on function public.invite_member(bigint, text) to authenticated;
grant  execute on function public.my_invites()                to authenticated;
grant  execute on function public.accept_invite(bigint)       to authenticated;
grant  execute on function public.decline_invite(bigint)      to authenticated;
grant  execute on function public.group_invites(bigint)       to authenticated;
