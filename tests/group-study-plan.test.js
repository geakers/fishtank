const { test, mock } = require('node:test');
const assert = require('node:assert/strict');
const session = require('../src/desktop/session');
const pdf = require('../src/desktop/pdf');

// The Supabase modules pick up getAccessToken when they load, so swap it first.
mock.method(session, 'getAccessToken', async () => 'dud-access-token');
const plan = require('../src/desktop/study-skills/group-study-plan');

const LEADER = '00000000-0000-4000-8000-000000000001';
const MEMBER = '00000000-0000-4000-8000-000000000002';
const GROUP = { id: 1, name: 'Biology revision', leader_id: LEADER };
const FILE_PATH = `${MEMBER}/note-2/1-cells.pdf`;
const NOTES = [
  { id: 'note-1', owner_id: LEADER, group_id: 1, title: 'Osmosis', body: 'Water moves across a membrane.', status: 'submitted', note_files: [] },
  {
    id: 'note-2', owner_id: MEMBER, group_id: 1, title: 'Cells', body: null, status: 'submitted',
    note_files: [{ id: 'f1', storage_path: FILE_PATH, mime_type: 'application/pdf', size_bytes: 4 }],
  },
  { id: 'note-3', owner_id: LEADER, group_id: 2, title: 'Another group', body: 'Not for this plan.', status: 'submitted', note_files: [] },
  { id: 'note-4', owner_id: LEADER, group_id: 1, title: 'Unfinished', body: 'Still a draft.', status: 'draft', note_files: [] },
];
const REPLY = {
  title: 'Biology plan',
  overview: 'Covers osmosis and cells.',
  keyFiles: [{ file: 'cells.pdf', reason: 'The fullest account of cell structure.' }],
  synthesis: [{ heading: 'Osmosis', points: ['Water moves <down> its gradient.'] }],
  memberFocus: [
    { member: 'dud-leader', gaps: ['Nothing on cells.'], focus: ['Cell structure.'] },
    { member: 'dud-member', gaps: ['Nothing on osmosis.'], focus: ['Osmosis.'] },
  ],
};

// Stands in for Supabase and Claude. Returns the request sent to Claude (once
// made) and the pages handed to the PDF writer.
function mockEverything(t, { groups = [GROUP], notes = NOTES, memberIds = true } = {}) {
  process.env.ANTHROPIC_API_KEY = 'dud-key';
  const seen = { claude: null, pdfs: [] };

  mock.method(globalThis, 'fetch', async (url, options = {}) => {
    const { hostname, pathname } = new URL(url);
    if (hostname === 'api.anthropic.com') {
      seen.claude = JSON.parse(options.body);
      return Response.json({
        id: 'msg_dud', type: 'message', role: 'assistant', model: 'claude-haiku-5-5',
        stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 },
        content: [{ type: 'text', text: JSON.stringify(REPLY) }],
      });
    }
    if (pathname === '/rest/v1/study_groups') return Response.json(groups);
    if (pathname === '/rest/v1/notes') return Response.json(notes);
    if (pathname === '/rest/v1/rpc/group_roster') {
      return Response.json([{ username: 'dud-leader', role: 'leader' }, { username: 'dud-member', role: 'member' }]);
    }
    if (pathname === '/rest/v1/rpc/group_member_ids') {
      if (!memberIds) return Response.json({ code: 'PGRST202', message: 'Could not find the function' }, { status: 404 });
      return Response.json([{ uid: LEADER, username: 'dud-leader' }, { uid: MEMBER, username: 'dud-member' }]);
    }
    // The signed link first, since asking for one starts with the same path.
    if (pathname === '/storage/v1/object/sign/notes/dud') return new Response(new Uint8Array([37, 80, 68, 70]));
    if (pathname.startsWith('/storage/v1/object/sign/notes/')) return Response.json({ signedURL: '/object/sign/notes/dud?token=dud' });
    return Response.json({ message: `Unexpected request to ${pathname}` }, { status: 404 });
  });
  mock.method(pdf, 'savePdf', async (page) => {
    seen.pdfs.push(page);
    return `/dud/Downloads/${page.name}.pdf`;
  });
  // getAccessToken's mock is shared by every test, so only these are undone.
  t.after(() => {
    globalThis.fetch.mock.restore();
    pdf.savePdf.mock.restore();
  });
  return seen;
}

// All the text sent to Claude, joined up.
function sentText(seen) {
  return seen.claude.messages[0].content.map((block) => block.text ?? '').join('\n');
}

test("the plan sends the group's notes and files to Claude and saves a PDF", async (t) => {
  const seen = mockEverything(t);

  const result = await plan.run({ prompt: '  Exam on Friday  ', groupId: 1 });

  assert.equal(result.text, 'Covers osmosis and cells.');
  assert.match(result.pdfPath, /^\/dud\/Downloads\/Study plan - Biology revision - \d{4}-\d{2}-\d{2}\.pdf$/);

  const sent = sentText(seen);
  assert.match(sent, /Exam on Friday/);
  assert.match(sent, /- dud-leader \(leader\)/);
  assert.match(sent, /Title: Osmosis\nAuthor: dud-leader/);
  assert.match(sent, /Title: Cells\nAuthor: dud-member/);
  assert.match(sent, /File "cells\.pdf" from note 2/);
  // Another group's note and the user's own draft stay out.
  assert.doesNotMatch(sent, /Another group|Unfinished/);
  assert.deepEqual(seen.claude.messages[0].content.filter((block) => block.type !== 'text'), [
    { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: 'JVBERg==' } },
  ]);

  assert.match(seen.claude.system, /decide which files matter most/);
  assert.equal(seen.claude.model, 'claude-haiku-5-5');
  assert.equal(seen.claude.output_config.effort, 'medium');
  assert.equal(seen.claude.output_config.format.type, 'json_schema');
});

test("the PDF has both sections, with Claude's text escaped", async (t) => {
  const seen = mockEverything(t);

  await plan.run({ prompt: 'Exam on Friday', groupId: 1 });

  const { html } = seen.pdfs[0];
  assert.match(html, /<h2>1\. Synthesized notes<\/h2>/);
  assert.match(html, /<h2>2\. What each member should focus on<\/h2>/);
  assert.match(html, /<h3>dud-member<\/h3>/);
  assert.match(html, /Water moves &lt;down&gt; its gradient\./);
  assert.doesNotMatch(html, /<down>/);
});

test('the plan refuses a group the user is not in, without calling Claude', async (t) => {
  const seen = mockEverything(t, { groups: [] });

  await assert.rejects(plan.run({ prompt: 'Exam on Friday', groupId: 1 }), /Pick one of your study groups/);
  await assert.rejects(plan.run({ prompt: 'Exam on Friday', groupId: '1' }), /Pick one of your study groups/);
  await assert.rejects(plan.run({ prompt: '   ', groupId: 1 }), /Say what you want the study plan to cover/);
  assert.equal(seen.claude, null);
});

test('a group with no notes still gets a plan, from the request alone', async (t) => {
  const seen = mockEverything(t, { notes: NOTES.filter((n) => n.group_id !== 1) });

  const result = await plan.run({ prompt: 'Exam on Friday', groupId: 1 });

  assert.match(result.pdfPath, /Study plan - Biology revision/);
  const content = seen.claude.messages[0].content;
  assert.equal(content.length, 1);
  assert.match(content[0].text, /Exam on Friday/);
  assert.match(content[0].text, /The group has not shared any notes\./);
  assert.match(seen.claude.system, /may have shared no notes at all/);
  assert.match(seen.pdfs[0].html, /has not shared any notes yet/);
});

test("the plan still runs when authors' usernames can't be looked up", async (t) => {
  const seen = mockEverything(t, { memberIds: false });

  await plan.run({ prompt: 'Exam on Friday', groupId: 1 });

  const sent = sentText(seen);
  assert.match(sent, /Title: Osmosis\nAuthor: Member 1/);
  assert.match(sent, /Title: Cells\nAuthor: Member 2/);
});
