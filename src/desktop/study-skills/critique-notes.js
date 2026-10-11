const fs = require('node:fs');
const path = require('node:path');
const { generate } = require('../claude');
const notes = require('../notes');
const pdf = require('../pdf');
const { currentUser } = require('../session');
const { noteContent, escapeHtml, parseReply, text, list, listOf, object } = require('./shared');

// Study skill: critique the user's notes.
//
// The user picks some of their own notes. They are sent to Claude, with all
// their files, alongside study_context.txt: a reference of advice on
// note-taking and studying, one entry per article. Claude's reply is turned
// into a one-to-two page PDF that critiques how the notes are taken (not
// whether the subject matter is right) and cites the reference entries it
// drew on.

const CONTEXT_FILE = path.join(__dirname, 'study_context.txt');

// Tells Claude how to behave for this skill.
const systemPrompt = `You are a study coach reviewing how a student takes notes.

You will be given a reference of advice on note-taking and studying, then one or more of the student's notes. A note may be typed text, attached files (PDFs and images of handwritten or typed pages), or both. Read every file.

Critique the student's note-taking style: structure and format, how well main ideas stand out from detail, wording (their own words or copied text), brevity, use of headings, diagrams, examples and questions, consistency between notes, and how easy the notes would be to review and self-test from. Do not correct or teach the subject matter itself, except to point out where the way the notes are written hides or muddles it.

Base the critique on the reference first, and on your own knowledge of how people learn where the reference says nothing. Follow these rules for sources:
- In each sources list, give only entry IDs that appear in the reference, such as N2 or S2, and only entries that actually support the point.
- Never cite an entry the reference marks as not available.
- When a point rests on your own knowledge and not on the reference, leave its sources empty. Never invent a source, a URL or a study.
- Keep in mind what the reference says about its own entries: some are anecdotal, opinion pieces, or published by a company with something to sell.

Be specific to these notes. Every strength and every improvement must point at something you can actually see in them, named by note title or file name. Generic advice that would fit anyone's notes is not useful.

The finished critique has to fit on one to two printed pages, so be selective and keep every field short:
- summary: two or three sentences on the overall picture.
- strengths: two or three things the student already does well.
- improvements: the three or four changes that would help most, most important first. In issue, name the problem in a few words. In evidence, say where it shows in the notes. In suggestion, say exactly what to do differently, in one or two sentences.
- nextSteps: three or four concrete things to do with these notes this week, each one sentence.

Write to the student directly and plainly, the way a good tutor would: honest about what is not working, and never harsh. Every string is plain text: no Markdown, no HTML.`;

// The shape of Claude's reply, as a JSON schema.
const schema = object({
  title: text,
  summary: text,
  strengths: listOf(object({ point: text, sources: list })),
  improvements: listOf(object({ issue: text, evidence: text, suggestion: text, sources: list })),
  nextSteps: list,
});

const MAX_NOTES = 10;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// Reads the reference's entries out of its text: { N2: { title, url }, ... }.
// Each entry starts "[N2] Title" with "URL: ..." on a later line. Entries the
// reference marks NOT AVAILABLE are left out, so they can never be cited.
function contextSources(context) {
  const sources = {};
  const entry = /^\[([A-Z]\d+)\] (.+)\n(?:.*\n)??URL: (\S+)/gm;
  for (const [, id, title, url] of context.matchAll(entry)) {
    if (!/NOT AVAILABLE/.test(title)) sources[id] = { title: title.trim().replace(/:$/, ''), url };
  }
  return sources;
}

// The IDs Claude cited that are real entries, without brackets or repeats.
function knownIds(cited, sources) {
  const ids = (cited ?? []).map((id) => String(id).replace(/[[\]\s]/g, '')).filter((id) => sources[id]);
  return [...new Set(ids)];
}

// " [N2] [S2]" after a point, or nothing when it cites no entry.
function citations(ids) {
  return ids.length ? ` <span class="cite">${ids.map((id) => `[${escapeHtml(id)}]`).join(' ')}</span>` : '';
}

// Lays the critique out as the page that becomes the PDF.
function renderCritique({ critique, noteTitles, sources, date }) {
  const used = new Set();
  const cite = (cited) => {
    const ids = knownIds(cited, sources);
    ids.forEach((id) => used.add(id));
    return citations(ids);
  };

  const strengths = (critique.strengths ?? []).map((s) => `<li>${escapeHtml(s.point)}${cite(s.sources)}</li>`).join('');
  const improvements = (critique.improvements ?? [])
    .map(
      (i) =>
        `<div class="item"><h3>${escapeHtml(i.issue)}</h3><p><span class="label">In your notes:</span> ${escapeHtml(i.evidence)}</p><p><span class="label">Try this:</span> ${escapeHtml(i.suggestion)}${cite(i.sources)}</p></div>`,
    )
    .join('');
  const nextSteps = (critique.nextSteps ?? []).filter(Boolean).map((step) => `<li>${escapeHtml(step)}</li>`).join('');
  const sourceList = [...used]
    .sort()
    .map((id) => `<li><span class="cite">[${escapeHtml(id)}]</span> ${escapeHtml(sources[id].title)}<br><span class="url">${escapeHtml(sources[id].url)}</span></li>`)
    .join('');
  const none = '<p class="none">Nothing to add.</p>';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(critique.title)}</title>
<style>
  body { margin: 0; font: 10pt/1.4 -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif; color: #26313b; }
  h1 { margin: 0 0 2pt; font-size: 18pt; color: #0d6f9c; }
  h2 { margin: 12pt 0 4pt; padding-bottom: 2pt; border-bottom: 1.5pt solid #8edcf7; font-size: 12pt; color: #0d6f9c; break-after: avoid; }
  h3 { margin: 7pt 0 1pt; font-size: 10.5pt; break-after: avoid; }
  p { margin: 0 0 3pt; }
  ul, ol { margin: 0 0 3pt; padding-left: 15pt; }
  li { margin-bottom: 2pt; }
  .meta, .none, .url { color: #6b7782; }
  .meta { margin-bottom: 6pt; font-size: 8.5pt; }
  .label { font-weight: 600; }
  .cite { color: #0d6f9c; font-size: 8.5pt; white-space: nowrap; }
  .item { break-inside: avoid; }
  .sources { font-size: 8.5pt; list-style: none; padding-left: 0; }
  .url { font-size: 8pt; word-break: break-all; }
</style>
</head>
<body>
  <h1>${escapeHtml(critique.title)}</h1>
  <p class="meta">${escapeHtml(date)} · made with Fishtank · notes reviewed: ${escapeHtml(noteTitles.join(', '))}</p>
  <p>${escapeHtml(critique.summary)}</p>

  <h2>What's working</h2>
  ${strengths ? `<ul>${strengths}</ul>` : none}

  <h2>What to change</h2>
  ${improvements || none}

  <h2>What to do this week</h2>
  ${nextSteps ? `<ol>${nextSteps}</ol>` : none}

  ${sourceList ? `<h2>Sources</h2><ul class="sources">${sourceList}</ul>` : ''}
</body>
</html>`;
}

// Makes the critique. input: { noteIds }, the ids of some of the logged-in
// user's own notes. Resolves with { text, pdfPath }.
async function run(input) {
  const noteIds = input?.noteIds;
  if (!Array.isArray(noteIds) || noteIds.length === 0) throw new Error('Pick at least one of your notes.');
  if (noteIds.length > MAX_NOTES) throw new Error(`Pick at most ${MAX_NOTES} notes at a time.`);
  if (!noteIds.every((id) => typeof id === 'string' && UUID.test(id))) throw new Error('Pick notes from your list.');
  const user = currentUser();
  if (!user) throw new Error('Log in first');

  // listNotes also returns study groups' notes; only the user's own count here.
  const mine = (await notes.listNotes()).filter((note) => note.owner_id === user.uid && note.status !== 'draft');
  const picked = mine.filter((note) => noteIds.includes(note.id));
  if (picked.length !== new Set(noteIds).size) throw new Error('Pick notes from your list.');

  const context = fs.readFileSync(CONTEXT_FILE, 'utf8');
  const content = [
    { type: 'text', text: `Reference on note-taking and studying:\n\n${context}` },
    { type: 'text', text: `The student's ${picked.length === 1 ? 'note follows' : `${picked.length} notes follow`}.` },
    ...(await noteContent(picked)),
  ];
  const critique = parseReply(await generate({ systemPrompt, content, schema }), 'critique');

  const date = new Date().toISOString().slice(0, 10);
  const pdfPath = await pdf.savePdf({
    html: renderCritique({ critique, noteTitles: picked.map((note) => note.title), sources: contextSources(context), date }),
    name: `Notes critique - ${date}`,
  });
  return { text: critique.summary || 'Your critique is ready.', pdfPath };
}

module.exports = { id: 'critique-notes', systemPrompt, schema, contextSources, renderCritique, run };
