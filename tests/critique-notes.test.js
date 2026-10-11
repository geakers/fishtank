const { test, mock } = require('node:test');
const assert = require('node:assert/strict');
const session = require('../src/desktop/session');
const pdf = require('../src/desktop/pdf');

const ME = '00000000-0000-4000-8000-000000000001';
const OTHER = '00000000-0000-4000-8000-000000000002';

// The skill and the Supabase modules pick these up when they load, so swap
// them out first.
mock.method(session, 'getAccessToken', async () => 'dud-access-token');
mock.method(session, 'currentUser', () => ({ uid: ME, email: 'dud@example.com', username: 'dud-user' }));
const critique = require('../src/desktop/study-skills/critique-notes');

const NOTE_1 = '11111111-1111-4111-8111-111111111111';
const NOTE_2 = '22222222-2222-4222-8222-222222222222';
const THEIRS = '33333333-3333-4333-8333-333333333333';
const NOTES = [
  { id: NOTE_1, owner_id: ME, group_id: null, title: 'Osmosis', body: 'Water moves across a membrane.', status: 'submitted', note_files: [] },
  {
    id: NOTE_2, owner_id: ME, group_id: 1, title: 'Cells', body: null, status: 'submitted',
    note_files: [{ id: 'f1', storage_path: `${ME}/${NOTE_2}/1-cells.pdf`, mime_type: 'application/pdf', size_bytes: 4 }],
  },
  { id: THEIRS, owner_id: OTHER, group_id: 1, title: 'A group note', body: 'Someone else wrote this.', status: 'submitted', note_files: [] },
];
const REPLY = {
  title: 'Your notes on cells',
  summary: 'Clear but too wordy.',
  strengths: [{ point: 'Every page is dated.', sources: ['N1'] }],
  improvements: [
    { issue: 'Full sentences', evidence: 'In "Osmosis" <every> line is a sentence.', suggestion: 'Use phrases.', sources: ['[N1]', 'S1', 'Z9'] },
    { issue: 'No self-testing', evidence: 'No questions anywhere.', suggestion: 'Add a question column.', sources: [] },
  ],
  nextSteps: ['Rewrite "Osmosis" as bullets.'],
};

// Stands in for Supabase and Claude. Returns the request sent to Claude (once
// made) and the pages handed to the PDF writer.
function mockEverything(t) {
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
    if (pathname === '/rest/v1/notes') return Response.json(NOTES);
    // The signed link first, since asking for one starts with the same path.
    if (pathname === '/storage/v1/object/sign/notes/dud') return new Response(new Uint8Array([37, 80, 68, 70]));
    if (pathname.startsWith('/storage/v1/object/sign/notes/')) return Response.json({ signedURL: '/object/sign/notes/dud?token=dud' });
    return Response.json({ message: `Unexpected request to ${pathname}` }, { status: 404 });
  });
  mock.method(pdf, 'savePdf', async (page) => {
    seen.pdfs.push(page);
    return `/dud/Downloads/${page.name}.pdf`;
  });
  // The session mocks are shared by every test, so only these are undone.
  t.after(() => {
    globalThis.fetch.mock.restore();
    pdf.savePdf.mock.restore();
  });
  return seen;
}

test('the critique sends the reference and the picked notes to Claude and saves a PDF', async (t) => {
  const seen = mockEverything(t);

  const result = await critique.run({ noteIds: [NOTE_1, NOTE_2] });

  assert.equal(result.text, 'Clear but too wordy.');
  assert.match(result.pdfPath, /^\/dud\/Downloads\/Notes critique - \d{4}-\d{2}-\d{2}\.pdf$/);

  const parts = seen.claude.messages[0].content;
  const sent = parts.map((p) => p.text ?? '').join('\n');
  assert.match(sent, /STUDY & NOTE-TAKING REFERENCE CONTEXT/);
  assert.match(sent, /\[N1\] Effective Note-Taking in Class/);
  assert.match(sent, /Title: Osmosis\nFiles: 0\n\nWater moves across a membrane\./);
  assert.match(sent, /File "cells\.pdf" from note 2 \("Cells"\):/);
  assert.doesNotMatch(sent, /A group note/);
  assert.deepEqual(parts.filter((p) => p.type !== 'text'), [
    { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: 'JVBERg==' } },
  ]);
  assert.match(seen.claude.system, /Never invent a source/);
  assert.equal(seen.claude.model, 'claude-haiku-5-5');
  assert.equal(seen.claude.output_config.effort, 'medium');
  assert.equal(seen.claude.output_config.format.type, 'json_schema');
});

test("the PDF cites only real reference entries, with their URLs, and escapes Claude's text", async (t) => {
  const seen = mockEverything(t);

  await critique.run({ noteIds: [NOTE_1] });

  const { html } = seen.pdfs[0];
  assert.match(html, /<h2>What's working<\/h2>/);
  assert.match(html, /<h2>What to change<\/h2>/);
  assert.match(html, /In &quot;Osmosis&quot; &lt;every&gt; line is a sentence\./);
  // N1 is a real entry; S1 is marked not available and Z9 doesn't exist.
  assert.match(html, /Use phrases\. <span class="cite">\[N1\]<\/span>/);
  assert.doesNotMatch(html, /\[S1\]|\[Z9\]/);
  assert.match(html, /<h2>Sources<\/h2>/);
  assert.match(html, /learningcenter\.unc\.edu\/tips-and-tools\/effective-note-taking-in-class\//);
});

test('contextSources reads every available entry of the reference', () => {
  const sources = critique.contextSources(require('node:fs').readFileSync(`${__dirname}/../src/desktop/study-skills/study_context.txt`, 'utf8'));

  assert.equal(Object.keys(sources).length, 14);
  assert.equal('S1' in sources, false);
  assert.deepEqual(sources.F1, {
    title: 'Flashcards - University of Toronto Scarborough Learning Strategies',
    url: 'https://www.utsc.utoronto.ca/learningstrategies/flashcards',
  });
});

test("the critique only takes the user's own notes, and at least one", async (t) => {
  const seen = mockEverything(t);

  await assert.rejects(critique.run({ noteIds: [] }), /Pick at least one of your notes/);
  await assert.rejects(critique.run({ noteIds: [NOTE_1, THEIRS] }), /Pick notes from your list/);
  await assert.rejects(critique.run({ noteIds: ['not-a-note'] }), /Pick notes from your list/);
  await assert.rejects(critique.run({ noteIds: Array(11).fill(NOTE_1) }), /Pick at most 10 notes/);
  assert.equal(seen.claude, null);
});
