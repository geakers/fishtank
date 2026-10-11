const { generate } = require('../claude');
const { listGroups, groupRoster } = require('../groups');
const notes = require('../notes');
const pdf = require('../pdf');
const { rpc } = require('../supabase');
const { noteContent, escapeHtml, bullets, parseReply, text, list, listOf, object } = require('./shared');

// Study skill: make a study plan for a study group.
//
// The user says what they want and which of their groups it's for. Every note
// shared with that group, with all its files, is sent to Claude along with who
// wrote it. Claude's reply is turned into a PDF with two sections: the group's
// notes pulled together, and what each member should focus on. A group with
// no notes still gets a plan, built from the request alone.

// Tells Claude how to behave for this skill.
const systemPrompt = `You are a study coach writing a study plan for a small study group.

You will be given the group's name, its members, what the person asking wants from the plan, and every note the members have shared with the group. Each note is labelled with its title and its author. A note may be typed text, attached files (PDFs and images), or both.

You are given every file, but they are not equally useful. Before writing, decide which files matter most for what was asked: the ones that cover the requested topic, carry the most substance, or are the clearest source for a point. Build the plan mainly from those, use the rest only where they add something, and ignore material that is off-topic or duplicated. List the files you relied on most in keyFiles, each with a short reason.

Write two things:

1. synthesis: one synthesized set of notes for the whole group, combining what the members' notes say. Organise it by topic, not by author or by file. Merge overlapping points, keep the important detail (definitions, formulas, dates, steps, examples), and where two notes disagree, say so and give the more likely correct version. Do not invent material that is not in the notes; if the notes leave an obvious hole in a topic, name the hole instead of filling it.

2. memberFocus: one entry for every member of the group, using the exact usernames you were given. Compare each member's own notes with the synthesized notes. In gaps, list what is missing, thin or mistaken in that member's notes. In focus, list what that member should study next to close those gaps, most important first. A member who shared no notes still gets an entry: say that they shared none, and base their focus on the group's material as a whole.

The group may have shared no notes at all. You will be told when that is so. Then there is nothing to synthesize, so build the plan from what the person asking wants, using your own knowledge of the subject: in synthesis, write the key material the group needs to learn for it, organised by topic; in memberFocus, give every member an entry whose gaps say that no notes have been shared yet, and split the topics between the members in focus so that the group covers everything between them. Leave keyFiles empty, and say in the overview that the plan is based on the request alone because the group has not shared any notes.

Follow what the person asking wants (the topic, an exam date, a time limit, a level of detail) wherever it applies. Write plainly and specifically, addressed to students. Every string is plain text: no Markdown, no HTML.`;

// The shape of Claude's reply, as a JSON schema.
const schema = object({
  title: text,
  // A few sentences on what the plan covers.
  overview: text,
  keyFiles: listOf(object({ file: text, reason: text })),
  synthesis: listOf(object({ heading: text, points: list })),
  memberFocus: listOf(object({ member: text, gaps: list, focus: list })),
});

const MAX_PROMPT = 4000;
// Returns a function giving the username for a uid. Falls back to "Member 1",
// "Member 2", ... when the usernames can't be looked up, which is what happens
// until study-group-member-ids.sql has been run.
async function authorNames(groupId) {
  const names = new Map();
  try {
    for (const member of await rpc('group_member_ids', { gid: groupId })) names.set(member.uid, member.username);
  } catch (err) {
    if (err.code !== 'PGRST202') throw err;
  }
  return (uid) => {
    if (!names.has(uid)) names.set(uid, `Member ${names.size + 1}`);
    return names.get(uid);
  };
}

// Builds the message for Claude: the request, then each note with its files.
async function buildContent({ prompt, group, roster, groupNotes, nameOf }) {
  const members = roster.map((m) => `- ${m.username} (${m.role})`).join('\n');
  const parts = [
    {
      type: 'text',
      text: `Study group: ${group.name}\n\nMembers:\n${members}\n\nWhat the person asking wants:\n${prompt}\n\n${
        groupNotes.length === 0 ? 'The group has not shared any notes.' : `The group's ${groupNotes.length} notes follow.`
      }`,
    },
  ];

  parts.push(...(await noteContent(groupNotes, (note) => nameOf(note.owner_id))));
  return parts;
}

// Lays the plan out as the page that becomes the PDF.
function renderPlan({ plan, group, prompt, date, noteCount }) {
  const keyFiles = (plan.keyFiles ?? [])
    .map((f) => `<li><strong>${escapeHtml(f.file)}</strong>: ${escapeHtml(f.reason)}</li>`)
    .join('');
  const synthesis = (plan.synthesis ?? [])
    .map((topic) => `<h3>${escapeHtml(topic.heading)}</h3>${bullets(topic.points)}`)
    .join('');
  const members = (plan.memberFocus ?? [])
    .map(
      (m) =>
        `<div class="member"><h3>${escapeHtml(m.member)}</h3><h4>Gaps in their notes</h4>${bullets(m.gaps)}<h4>What to focus on</h4>${bullets(m.focus)}</div>`,
    )
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(plan.title)}</title>
<style>
  body { margin: 0; font: 11pt/1.5 -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif; color: #26313b; }
  h1 { margin: 0 0 4pt; font-size: 22pt; color: #0d6f9c; }
  h2 { margin: 22pt 0 6pt; padding-bottom: 4pt; border-bottom: 2pt solid #8edcf7; font-size: 15pt; color: #0d6f9c; }
  h3 { margin: 14pt 0 4pt; font-size: 12pt; break-after: avoid; }
  h4 { margin: 8pt 0 2pt; font-size: 9pt; letter-spacing: 0.06em; text-transform: uppercase; color: #6b7782; break-after: avoid; }
  p { margin: 0 0 6pt; }
  ul { margin: 0 0 6pt; padding-left: 16pt; }
  li { margin-bottom: 3pt; }
  .meta, .none { color: #6b7782; }
  .meta { font-size: 9.5pt; }
  .request { margin: 10pt 0; padding: 8pt 10pt; border-left: 3pt solid #8edcf7; background: #f1fafe; white-space: pre-wrap; }
  .member { break-inside: avoid; }
</style>
</head>
<body>
  <h1>${escapeHtml(plan.title)}</h1>
  <p class="meta">${escapeHtml(group.name)} · ${escapeHtml(date)} · made with Fishtank</p>
  <p class="request">${escapeHtml(prompt)}</p>
  <p>${escapeHtml(plan.overview)}</p>

  <h2>1. Synthesized notes</h2>
  ${noteCount === 0 ? '<p class="none">This group has not shared any notes yet, so this section is based on the request alone.</p>' : ''}
  ${keyFiles ? `<h4>Files this draws on most</h4><ul>${keyFiles}</ul>` : ''}
  ${synthesis || '<p class="none">Nothing to add.</p>'}

  <h2>2. What each member should focus on</h2>
  ${members || '<p class="none">Nothing to add.</p>'}
</body>
</html>`;
}

// Makes the plan. input: { prompt, groupId }, where the group must be one the
// logged-in user leads or is in. Resolves with { text, pdfPath }.
async function run(input) {
  const prompt = typeof input?.prompt === 'string' ? input.prompt.trim() : '';
  const groupId = input?.groupId;
  if (!prompt) throw new Error('Say what you want the study plan to cover.');
  if (prompt.length > MAX_PROMPT) throw new Error(`That's too long: the limit is ${MAX_PROMPT} characters.`);
  if (!Number.isInteger(groupId)) throw new Error('Pick one of your study groups.');

  // listGroups only returns groups the user leads or is in.
  const group = (await listGroups()).find((g) => g.id === groupId);
  if (!group) throw new Error('Pick one of your study groups.');

  const [roster, allNotes, nameOf] = await Promise.all([groupRoster(groupId), notes.listNotes(), authorNames(groupId)]);
  const groupNotes = allNotes.filter((note) => note.group_id === groupId && note.status !== 'draft');

  const content = await buildContent({ prompt, group, roster, groupNotes, nameOf });
  const plan = parseReply(await generate({ systemPrompt, content, schema }), 'study plan');

  const date = new Date().toISOString().slice(0, 10);
  const pdfPath = await pdf.savePdf({
    html: renderPlan({ plan, group, prompt, date, noteCount: groupNotes.length }),
    name: `Study plan - ${group.name} - ${date}`,
  });
  return { text: plan.overview || 'Your study plan is ready.', pdfPath };
}

module.exports = { id: 'group-study-plan', systemPrompt, schema, renderPlan, run };
