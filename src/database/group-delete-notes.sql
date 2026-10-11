-- Goldfish: let a study group's leader delete the group's notes and their
-- files, so deleting a group can take its notes with it.
-- Run once in Supabase > SQL Editor > New query > Run, after notes.sql and
-- study-groups.sql. (notes.sql already includes these for new setups.)
--
-- Before, only a note's author could delete it or its files, so when a leader
-- deleted a group, everyone else's notes in it stayed behind as their personal
-- notes, files and all. The app now deletes the group's notes (files first)
-- before deleting the group; these rules let the leader do that.
--
-- Everything runs in one transaction: if any step fails, nothing changes.

begin;

-- Is this note in a study group I lead?
create function public.is_note_in_group_i_lead(nid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.notes n
     where n.id = nid and n.group_id is not null and public.is_group_leader(n.group_id)
  );
$$;

revoke execute on function public.is_note_in_group_i_lead(uuid) from public, anon;
grant  execute on function public.is_note_in_group_i_lead(uuid) to authenticated;

-- The leader can delete any note in their group...
create policy "leader deletes group notes" on public.notes for delete to authenticated
  using (group_id is not null and public.is_group_leader(group_id));

-- ...and the files of those notes. (The leader can already see them.)
create policy "notes bucket: leader deletes group note files" on storage.objects for delete to authenticated
  using (bucket_id = 'notes' and public.is_note_in_group_i_lead(public.note_id_from_path(name)));

commit;

-- Let the API see the changes right away.
notify pgrst, 'reload schema';
