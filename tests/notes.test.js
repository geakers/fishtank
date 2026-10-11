const { test, mock } = require('node:test');
const assert = require('node:assert/strict');
const session = require('../src/desktop/session');

const USER = { uid: '00000000-0000-4000-8000-000000000001', email: 'dud@example.com', username: 'dud-user' };
const NOTE_ID = '00000000-0000-4000-8000-0000000000aa';

// The logged-in user, or null to act as if nobody is logged in.
let user = USER;

// notes.js picks these up when it loads, so swap them out first.
mock.method(session, 'getAccessToken', async () => (user ? 'dud-access-token' : null));
mock.method(session, 'currentUser', () => user);
const { listNotes, submitNote, deleteNote, noteFileUrl } = require('../src/desktop/notes');

const pdf = (name = 'My notes.pdf', size = 10) => ({ name, type: 'application/pdf', bytes: new Uint8Array(size).fill(1) });
const png = (name = 'screenshot.png') => ({ name, type: 'image/png', bytes: new Uint8Array([137, 80, 78, 71]) });

// Stands in for Supabase so the test never touches the real database. Each
// "METHOD /path" maps to the response it returns; the requests made are
// returned in order.
function mockSupabase(responses) {
  const requests = [];

  mock.method(globalThis, 'fetch', async (url, options) => {
    const { pathname, search } = new URL(url);
    const key = `${options.method} ${pathname}`;
    const bytes = options.body instanceof Uint8Array;
    requests.push({
      key,
      search: decodeURIComponent(search),
      headers: options.headers,
      body: bytes ? options.body : options.body === undefined ? undefined : JSON.parse(options.body),
    });

    const respond = Object.entries(responses).find(([pattern]) => key.startsWith(pattern))?.[1];
    if (respond) return respond();
    return Response.json({ message: `Unexpected request to ${key}` }, { status: 404 });
  });

  return requests;
}

const ok = (body = null, status = 200) => () => (body === null ? new Response(null, { status: 204 }) : Response.json(body, { status }));

function reset(t) {
  user = USER;
  t.after(() => {
    // Only undo the fetch stand-in; the session swaps must stay.
    globalThis.fetch.mock?.restore();
  });
}

test('listNotes asks for the visible notes with their files, newest first', async (t) => {
  reset(t);
  const requests = mockSupabase({ 'GET /rest/v1/notes': ok([{ id: NOTE_ID, note_files: [] }]) });

  assert.deepEqual(await listNotes(), [{ id: NOTE_ID, note_files: [] }]);
  assert.equal(requests[0].search, '?select=id,owner_id,group_id,title,body,status,created_at,submitted_at,note_files(id,storage_path,mime_type,size_bytes)&order=created_at.desc');
});

test('submitNote creates the draft, uploads and records each file, then submits', async (t) => {
  reset(t);
  const requests = mockSupabase({
    'POST /rest/v1/notes': ok([{ id: NOTE_ID }], 201),
    'POST /storage/v1/object/notes/': ok({ Key: 'x' }),
    'POST /rest/v1/note_files': ok(null),
    'POST /rest/v1/rpc/submit_note': ok(null),
  });

  const id = await submitNote({ title: '  Cell biology  ', body: 'Mitochondria', groupId: 7, files: [pdf(), png()] });

  assert.equal(id, NOTE_ID);
  assert.deepEqual(requests.map((r) => r.key), [
    'POST /rest/v1/notes',
    `POST /storage/v1/object/notes/${USER.uid}/${NOTE_ID}/1-My_notes.pdf`,
    'POST /rest/v1/note_files',
    `POST /storage/v1/object/notes/${USER.uid}/${NOTE_ID}/2-screenshot.png`,
    'POST /rest/v1/note_files',
    'POST /rest/v1/rpc/submit_note',
  ]);
  assert.deepEqual(requests[0].body, { title: 'Cell biology', body: 'Mitochondria', group_id: 7 });
  assert.equal(requests[1].headers['Content-Type'], 'application/pdf');
  assert.equal(requests[1].headers.Authorization, 'Bearer dud-access-token');
  assert.deepEqual(requests[1].body, pdf().bytes);
  assert.deepEqual(requests[2].body, {
    note_id: NOTE_ID,
    storage_path: `${USER.uid}/${NOTE_ID}/1-My_notes.pdf`,
    mime_type: 'application/pdf',
    size_bytes: 10,
  });
  assert.deepEqual(requests[5].body, { nid: NOTE_ID });
});

test('submitNote turns blank typed notes into none and allows a personal note', async (t) => {
  reset(t);
  const requests = mockSupabase({
    'POST /rest/v1/notes': ok([{ id: NOTE_ID }], 201),
    'POST /storage/v1/object/notes/': ok({ Key: 'x' }),
    'POST /rest/v1/note_files': ok(null),
    'POST /rest/v1/rpc/submit_note': ok(null),
  });

  await submitNote({ title: 'Diagram', body: '   ', groupId: null, files: [png()] });
  assert.deepEqual(requests[0].body, { title: 'Diagram', body: null, group_id: null });
});

test("submitNote checks the note before uploading anything", async (t) => {
  reset(t);
  const requests = mockSupabase({});

  await assert.rejects(submitNote({ title: ' ', body: 'text', files: [] }), /Give your note a title/);
  await assert.rejects(submitNote({ title: 'Empty', body: '', files: [] }), /Add some typed notes or a file/);
  await assert.rejects(submitNote({ title: 'Text', files: [{ name: 'a.txt', type: 'text/plain', bytes: new Uint8Array(1) }] }), /a\.txt isn't a PDF or an image/);
  await assert.rejects(submitNote({ title: 'Big', files: [pdf('big.pdf', 10 * 1024 * 1024 + 1)] }), /big\.pdf is over 10 MB/);
  await assert.rejects(submitNote({ title: 'Many', files: Array.from({ length: 11 }, () => png()) }), /at most 10 files/);
  await assert.rejects(submitNote({ title: 'Group', body: 'text', groupId: 'abc' }), /Pick a study group/);
  assert.equal(requests.length, 0);
});

test('submitNote removes what it saved when an upload fails', async (t) => {
  reset(t);
  let uploads = 0;
  const requests = mockSupabase({
    'POST /rest/v1/notes': ok([{ id: NOTE_ID }], 201),
    'POST /storage/v1/object/notes/': () =>
      ++uploads === 1 ? Response.json({ Key: 'x' }) : Response.json({ message: 'mime type text/plain is not supported' }, { status: 400 }),
    'POST /rest/v1/note_files': ok(null),
    'DELETE /storage/v1/object/notes': ok([]),
    'DELETE /rest/v1/notes': ok(null),
  });

  await assert.rejects(submitNote({ title: 'Two files', files: [pdf(), png()] }), { message: 'mime type text/plain is not supported' });

  const cleanup = requests.filter((r) => r.key.startsWith('DELETE'));
  assert.deepEqual(cleanup.map((r) => r.key), ['DELETE /storage/v1/object/notes', 'DELETE /rest/v1/notes']);
  assert.deepEqual(cleanup[0].body, { prefixes: [`${USER.uid}/${NOTE_ID}/1-My_notes.pdf`] });
  assert.equal(cleanup[1].search, `?id=eq.${NOTE_ID}`);
});

test('deleteNote deletes your own note, files first', async (t) => {
  reset(t);
  const path = `${USER.uid}/${NOTE_ID}/1-My_notes.pdf`;
  const requests = mockSupabase({
    'GET /rest/v1/notes': ok([{ owner_id: USER.uid, note_files: [{ storage_path: path }] }]),
    'DELETE /storage/v1/object/notes': ok([]),
    'DELETE /rest/v1/notes': ok(null),
  });

  await deleteNote(NOTE_ID);
  assert.deepEqual(requests.map((r) => r.key), ['GET /rest/v1/notes', 'DELETE /storage/v1/object/notes', 'DELETE /rest/v1/notes']);
  assert.deepEqual(requests[1].body, { prefixes: [path] });
});

test("deleteNote refuses someone else's note and bad ids", async (t) => {
  reset(t);
  const requests = mockSupabase({ 'GET /rest/v1/notes': ok([{ owner_id: 'someone-else', note_files: [] }]) });

  await assert.rejects(deleteNote(NOTE_ID), /only delete your own notes/);
  await assert.rejects(deleteNote('1&owner_id=neq.x'), /A note id is required/);
  assert.equal(requests.filter((r) => r.key.startsWith('DELETE')).length, 0);
});

test('noteFileUrl returns a full signed link', async (t) => {
  reset(t);
  const requests = mockSupabase({ 'POST /storage/v1/object/sign/notes/': ok({ signedURL: '/object/sign/notes/a/b/c.pdf?token=t' }) });

  const url = await noteFileUrl('a/b/c.pdf');
  assert.match(url, /\/storage\/v1\/object\/sign\/notes\/a\/b\/c\.pdf\?token=t$/);
  assert.deepEqual(requests[0].body, { expiresIn: 300 });
});

test('notes need someone logged in', async (t) => {
  reset(t);
  user = null;
  const requests = mockSupabase({});

  await assert.rejects(listNotes(), /Log in first/);
  await assert.rejects(submitNote({ title: 'x', body: 'some text', files: [] }), /Log in first/);
  assert.equal(requests.length, 0);
});
