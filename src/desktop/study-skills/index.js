const { generate } = require('../claude');

// Study skills: the things the Study Skills panel can ask Claude to do. Each
// skill lives in its own file. A skill that does more than ask (reading notes,
// making a PDF) has its own run(input); one with just a system prompt and a
// prompt builder is run as plain text in, text out.
const SKILLS = [require('./group-study-plan'), require('./critique-notes'), require('./ask-question')];

const MAX_INPUT = 20000;

// Runs the skill with the given id. input is what the skill's form collected:
// { prompt, groupId } for the group study plan, { noteIds } for the notes
// critique, text for a question. Resolves with { text }, plus pdfPath when the
// skill made a PDF.
async function runStudySkill(skillId, input) {
  const skill = SKILLS.find((s) => s.id === skillId);
  if (!skill) throw new Error('No such study skill');
  if (skill.run) return skill.run(input);

  if (typeof input !== 'string' || !input.trim()) throw new Error('Type something first.');
  if (input.length > MAX_INPUT) throw new Error(`That's too long: the limit is ${MAX_INPUT} characters.`);
  return { text: await generate({ systemPrompt: skill.systemPrompt, prompt: skill.buildPrompt(input.trim()) }) };
}

module.exports = { SKILLS, runStudySkill };
