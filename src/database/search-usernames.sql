-- Goldfish: search usernames, so a teacher can find students to add to a class.
-- Run in Supabase > SQL Editor > New query > Run (after the classes SQL).
--
-- Returns up to 10 usernames containing the search text (any case), names that
-- start with it first. Only usernames come back; emails and uids stay hidden.
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

revoke execute on function public.search_usernames(text) from public, anon;
grant  execute on function public.search_usernames(text) to authenticated;
