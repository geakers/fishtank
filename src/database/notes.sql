-- Goldfish: study notes (typed text, PDFs, screenshots), kept per user either
-- as a personal note or submitted to a study group.
-- Run in Supabase > SQL Editor > New query > Run, after study-groups.sql.
--
-- File contents live in the private storage bucket "notes"; the tables only
-- hold a row per note and per file. Files are stored at
--   <owner uid>/<note id>/<file name>
-- so the storage rules can tell whose file it is, and which note, from its path.
--
-- From the app, a note is only ever a draft or submitted (via submit_note()).
-- Reviewing, grading and awarding points will be done later by a server-side
-- AI step, which moves notes on to reviewing / reviewed / failed and adds its
-- own tables (reviews, a points ledger, group study summaries).
--
-- Everything runs in one transaction: if any step fails, nothing changes.

begin;

-- 1. The bucket. Private: files are opened through short-lived signed links,
--    which only people allowed by the rules below can get. Limited to the
--    file types the AI can read, 10 MB each.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('notes', 'notes', false, 10485760,
        array['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif']);

-- 2. Notes, and one row per uploaded file.
create table public.notes (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null default auth.uid() references public.profiles(uid) on delete cascade,
  group_id      bigint references public.study_groups(id) on delete set null,  -- null = personal note
  title         text not null check (btrim(title) <> '' and char_length(title) <= 80),
  body          text check (char_length(body) <= 50000),                       -- typed notes, optional
  status        text not null default 'draft'
                check (status in ('draft', 'submitted', 'reviewing', 'reviewed', 'failed')),
  created_at    timestamptz not null default now(),
  submitted_at  timestamptz
);

create table public.note_files (
  id            uuid primary key default gen_random_uuid(),
  note_id       uuid not null references public.notes(id) on delete cascade,
  storage_path  text not null unique,   -- where the file is in the notes bucket
  mime_type     text not null
                check (mime_type in ('application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif')),
  size_bytes    integer not null check (size_bytes between 1 and 10485760),
  sha256        text,                   -- filled in by the server, to spot copied files
  created_at    timestamptz not null default now()
);

create index notes_owner_id_idx     on public.notes (owner_id);
create index notes_group_id_idx     on public.notes (group_id) where group_id is not null;
create index note_files_note_id_idx on public.note_files (note_id);

-- 3. Checks the security rules use.

-- Can I see this note? Yes if it's mine, or it's in a group I lead or am in.
create function public.can_see_note(nid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.notes n
     where n.id = nid
       and (n.owner_id = auth.uid()
            or (n.group_id is not null
                and (public.is_group_leader(n.group_id) or public.is_group_member(n.group_id))))
  );
$$;

-- Is this my own note, still a draft? Files can only be changed on drafts.
create function public.is_my_draft_note(nid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.notes where id = nid and owner_id = auth.uid() and status = 'draft');
$$;

-- Can I add another file to this note? My draft, with fewer than 10 files.
create function public.can_add_note_file(nid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_my_draft_note(nid)
     and (select count(*) from public.note_files where note_id = nid) < 10;
$$;

-- The note a path in the notes bucket belongs to (its second folder), or null
-- when the path isn't shaped <owner uid>/<note id>/<file name>.
create function public.note_id_from_path(path text) returns uuid
language sql immutable set search_path = '' as $$
  select case
    when path ~ '^[^/]+/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[^/]+$'
    then split_part(path, '/', 2)::uuid
  end;
$$;

-- 4. Security rules for the tables.
alter table public.notes      enable row level security;
alter table public.note_files enable row level security;

-- Notes: you see your own notes and the notes of groups you lead or are in.
-- You can only create and edit your own drafts, and only put them in a group
-- you're part of. Leaving draft goes through submit_note().
create policy "see my notes and my groups' notes" on public.notes for select to authenticated
  using (owner_id = (select auth.uid())
         or (group_id is not null and (public.is_group_leader(group_id) or public.is_group_member(group_id))));
create policy "create my own draft notes" on public.notes for insert to authenticated
  with check (owner_id = (select auth.uid()) and status = 'draft' and submitted_at is null
              and (group_id is null or public.is_group_leader(group_id) or public.is_group_member(group_id)));
create policy "edit my drafts" on public.notes for update to authenticated
  using (owner_id = (select auth.uid()) and status = 'draft')
  with check (owner_id = (select auth.uid()) and status = 'draft' and submitted_at is null
              and (group_id is null or public.is_group_leader(group_id) or public.is_group_member(group_id)));
create policy "delete my notes" on public.notes for delete to authenticated
  using (owner_id = (select auth.uid()));

-- Files: you see the files of notes you can see. You can add files (at most
-- 10) to your own drafts, stored under <your uid>/<note id>/, and remove them
-- while the note is a draft. Rows can't be edited; sha256 is the server's.
create policy "see files of notes I can see" on public.note_files for select to authenticated
  using (public.can_see_note(note_id));
create policy "add files to my drafts" on public.note_files for insert to authenticated
  with check (public.can_add_note_file(note_id)
              and storage_path ~ ('^' || (select auth.uid())::text || '/' || note_id::text || '/[^/]+$')
              and sha256 is null);
create policy "remove files from my drafts" on public.note_files for delete to authenticated
  using (public.is_my_draft_note(note_id));

-- 5. Security rules for the files in the bucket.
-- Upload only into <your uid>/<your draft note>/; read files in your own
-- folder and files of notes you can see; delete your own files (e.g. before
-- deleting a note). No overwriting. Reading your own folder doesn't need the
-- note to exist, so files that outlive their note can still be cleaned up.
create policy "notes bucket: upload to my draft notes" on storage.objects for insert to authenticated
  with check (bucket_id = 'notes'
              and split_part(name, '/', 1) = (select auth.uid())::text
              and public.is_my_draft_note(public.note_id_from_path(name)));
create policy "notes bucket: read my files and my groups' files" on storage.objects for select to authenticated
  using (bucket_id = 'notes'
         and (split_part(name, '/', 1) = (select auth.uid())::text
              or public.can_see_note(public.note_id_from_path(name))));
create policy "notes bucket: delete my own files" on storage.objects for delete to authenticated
  using (bucket_id = 'notes' and split_part(name, '/', 1) = (select auth.uid())::text);

-- 6. Submit a draft: the only way a note leaves draft from the app. It needs
--    some typed text or at least one file. The messages show up in the app.
create function public.submit_note(nid uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.notes where id = nid and owner_id = auth.uid()) then
    raise exception 'note not found';
  end if;
  if not exists (select 1 from public.notes n
                  where n.id = nid and coalesce(btrim(n.body), '') <> '')
     and not exists (select 1 from public.note_files where note_id = nid) then
    raise exception 'add some text or a file before submitting';
  end if;
  update public.notes set status = 'submitted', submitted_at = now()
   where id = nid and status = 'draft';
  if not found then
    raise exception 'this note has already been submitted';
  end if;
end;
$$;

-- 7. Only logged-in users can call the functions.
revoke execute on function public.can_see_note(uuid)        from public, anon;
revoke execute on function public.is_my_draft_note(uuid)    from public, anon;
revoke execute on function public.can_add_note_file(uuid)   from public, anon;
revoke execute on function public.note_id_from_path(text)   from public, anon;
revoke execute on function public.submit_note(uuid)         from public, anon;
grant  execute on function public.can_see_note(uuid)        to authenticated;
grant  execute on function public.is_my_draft_note(uuid)    to authenticated;
grant  execute on function public.can_add_note_file(uuid)   to authenticated;
grant  execute on function public.note_id_from_path(text)   to authenticated;
grant  execute on function public.submit_note(uuid)         to authenticated;

commit;

-- Let the API see the new tables and functions right away.
notify pgrst, 'reload schema';
