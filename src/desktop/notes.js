const { NEXT_PUBLIC_SUPABASE_URL } = require('../db');
const { request, rpc } = require('./supabase');
const { currentUser } = require('./session');

// Study notes: typed text and/or PDFs and screenshots, personal or shared with
// a study group. Files go in the private "notes" storage bucket at
// <owner uid>/<note id>/<file name>; see src/database/notes.sql.

// What the notes bucket accepts.
const FILE_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 10;
const MAX_TITLE = 80;
const MAX_BODY = 50000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const NOTE_COLUMNS = 'id,owner_id,group_id,title,body,status,created_at,submitted_at,note_files(id,storage_path,mime_type,size_bytes)';

// A storage path with each folder and the file name URL-encoded.
function encodePath(storagePath) {
  return storagePath.split('/').map(encodeURIComponent).join('/');
}

// A file name that's safe in a storage path.
function safeFileName(name) {
  const cleaned = String(name).replace(/[^A-Za-z0-9._-]+/g, '_').slice(-80);
  return cleaned || 'file';
}

// Checks a note before anything is uploaded and returns it tidied up.
function checkNote({ title, body, groupId = null, files = [] }) {
  title = typeof title === 'string' ? title.trim() : '';
  body = typeof body === 'string' && body.trim() ? body : null;
  if (!title) throw new Error('Give your note a title.');
  if (title.length > MAX_TITLE) throw new Error(`Titles can be at most ${MAX_TITLE} characters.`);
  if (body && body.length > MAX_BODY) throw new Error(`Typed notes can be at most ${MAX_BODY} characters.`);
  if (groupId !== null && !Number.isInteger(groupId)) throw new Error('Pick a study group or "Just me".');
  if (!Array.isArray(files)) throw new Error('Files must be a list.');
  if (files.length > MAX_FILES) throw new Error(`A note can have at most ${MAX_FILES} files.`);
  for (const file of files) {
    if (!(file?.bytes instanceof Uint8Array)) throw new Error('A file is missing its contents.');
    if (!FILE_TYPES.includes(file.type)) throw new Error(`${file.name} isn't a PDF or an image.`);
    if (file.bytes.length === 0) throw new Error(`${file.name} is empty.`);
    if (file.bytes.length > MAX_FILE_BYTES) throw new Error(`${file.name} is over 10 MB.`);
  }
  if (!body && files.length === 0) throw new Error('Add some typed notes or a file.');
  return { title, body, groupId, files };
}

// Returns the notes the logged-in user can see (their own and their study
// groups'), newest first, each with its files.
function listNotes() {
  return request(`/rest/v1/notes?select=${NOTE_COLUMNS}&order=created_at.desc`);
}

// Saves a note: creates it as a draft, uploads and records each file, then
// submits it. If any step fails, whatever was saved is removed again so no
// half-uploaded draft is left behind. Resolves with the new note's id.
// files: [{ name, type, bytes: Uint8Array }]
async function submitNote(note) {
  const user = currentUser();
  if (!user) throw new Error('Log in first');
  const { title, body, groupId, files } = checkNote(note ?? {});

  const [created] = await request('/rest/v1/notes?select=id', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: { title, body, group_id: groupId },
  });

  try {
    for (const [index, file] of files.entries()) {
      // Numbered so two files with the same name don't collide.
      const storagePath = `${user.uid}/${created.id}/${index + 1}-${safeFileName(file.name)}`;
      await request(`/storage/v1/object/notes/${encodePath(storagePath)}`, {
        method: 'POST',
        headers: { 'Content-Type': file.type },
        body: file.bytes,
      });
      await request('/rest/v1/note_files', {
        method: 'POST',
        body: { note_id: created.id, storage_path: storagePath, mime_type: file.type, size_bytes: file.bytes.length },
      });
    }
    await rpc('submit_note', { nid: created.id });
  } catch (err) {
    await removeNote(created.id, user.uid).catch(() => {});
    throw err;
  }
  return created.id;
}

// Returns the full storage paths of the files in a note's folder. This is what
// actually exists in storage, including any file whose note_files row is
// missing; a row whose file is already gone isn't listed.
async function listNoteFolder(ownerUid, noteId) {
  const prefix = `${ownerUid}/${noteId}`;
  const items = await request('/storage/v1/object/list/notes', { method: 'POST', body: { prefix, limit: 100, offset: 0 } });
  // Sub-folders come back without an id; a note's folder should only hold files.
  return items.filter((item) => item.id !== null).map((item) => `${prefix}/${item.name}`);
}

// Deletes every file in the note's folder, then the note; its note_files rows
// go with it. Deleting the note row doesn't remove files from storage, so they
// have to go first. Supabase reports success even when it skips files, so the
// reply is checked: if any file survives, the note is kept and this throws,
// rather than the note being reported as deleted while parts of it remain.
async function removeNote(noteId, ownerUid) {
  const paths = await listNoteFolder(ownerUid, noteId);
  if (paths.length > 0) {
    const deleted = await request('/storage/v1/object/notes', { method: 'DELETE', body: { prefixes: paths } });
    const gone = new Set((deleted ?? []).map((object) => object.name));
    const left = paths.filter((path) => !gone.has(path));
    if (left.length > 0) throw new Error(`Couldn't delete ${left.length} of this note's files, so the note was kept. Try again.`);
  }

  const removed = await request(`/rest/v1/notes?id=eq.${noteId}&select=id`, {
    method: 'DELETE',
    headers: { Prefer: 'return=representation' },
  });
  if (!Array.isArray(removed) || removed.length !== 1) throw new Error("That note couldn't be deleted.");
}

// Deletes one of the logged-in user's own notes, with its files.
async function deleteNote(noteId) {
  if (typeof noteId !== 'string' || !UUID.test(noteId)) throw new Error('A note id is required');
  const user = currentUser();
  if (!user) throw new Error('Log in first');

  const [note] = await request(`/rest/v1/notes?id=eq.${noteId}&select=owner_id`);
  if (!note || note.owner_id !== user.uid) throw new Error('You can only delete your own notes.');
  await removeNote(noteId, user.uid);
}

// Deletes every note in a study group, with its files, so deleting the group
// takes its notes with it. For the group's leader, who may delete any note in
// it. Stops with an error at the first note that can't be fully deleted.
async function deleteGroupNotes(groupId) {
  if (!Number.isInteger(groupId)) throw new Error('A study group is required');
  const notes = await request(`/rest/v1/notes?group_id=eq.${groupId}&select=id,owner_id`);
  for (const note of notes) await removeNote(note.id, note.owner_id);
}

// Returns a link to one of a note's files that works for 5 minutes. Supabase
// only gives one to people who can see the note.
async function noteFileUrl(storagePath) {
  if (typeof storagePath !== 'string' || !storagePath) throw new Error('A file path is required');
  const { signedURL } = await request(`/storage/v1/object/sign/notes/${encodePath(storagePath)}`, {
    method: 'POST',
    body: { expiresIn: 300 },
  });
  return `${NEXT_PUBLIC_SUPABASE_URL}/storage/v1${signedURL}`;
}

// Downloads one of a note's files and returns its bytes. Works for the same
// people as noteFileUrl.
async function downloadNoteFile(storagePath) {
  const res = await fetch(await noteFileUrl(storagePath));
  if (!res.ok) throw new Error(`Couldn't download a note file (${res.status})`);
  return new Uint8Array(await res.arrayBuffer());
}

module.exports = { FILE_TYPES, MAX_FILE_BYTES, MAX_FILES, listNotes, submitNote, deleteNote, deleteGroupNotes, noteFileUrl, downloadNoteFile };
