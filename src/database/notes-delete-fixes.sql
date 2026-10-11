-- Goldfish: make deleting a note reliably delete its file rows and files.
-- Run once in Supabase > SQL Editor > New query > Run, after notes.sql.
-- (notes.sql already includes these changes for new setups.)
--
-- 1. Guarantees note_files rows are deleted with their note (on delete cascade).
-- 2. Lets you always see and delete the files in your own folder, even once
--    the note row is gone, so the app can clean up leftovers. Before, reading
--    a file needed its note to exist, so files outliving their note were stuck.
--
-- Everything runs in one transaction: if any step fails, nothing changes.

begin;

-- 1. File rows whose note no longer exists can only be left behind if the
--    cascade was lost; remove them, then put the cascade back for certain.
delete from public.note_files f
 where not exists (select 1 from public.notes n where n.id = f.note_id);

alter table public.note_files drop constraint if exists note_files_note_id_fkey;
alter table public.note_files
  add constraint note_files_note_id_fkey
  foreign key (note_id) references public.notes(id) on delete cascade;

-- 2. Read files in your own folder, or files of notes you can see (your
--    groups'). Group members still only see files of notes in their groups.
drop policy "notes bucket: read files of notes I can see" on storage.objects;
create policy "notes bucket: read my files and my groups' files" on storage.objects for select to authenticated
  using (bucket_id = 'notes'
         and (split_part(name, '/', 1) = (select auth.uid())::text
              or public.can_see_note(public.note_id_from_path(name))));

commit;

-- Let the API see the changes right away.
notify pgrst, 'reload schema';
