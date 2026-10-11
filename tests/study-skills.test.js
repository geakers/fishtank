const { test, mock } = require('node:test');
const assert = require('node:assert/strict');
const { generate } = require('../src/desktop/claude');
const { SKILLS, runStudySkill } = require('../src/desktop/study-skills');

// A Claude reply holding the given content blocks.
function message(content, extra = {}) {
  return {
    id: 'msg_dud', type: 'message', role: 'assistant', model: 'claude-haiku-5-5',
    stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 },
    content, ...extra,
  };
}

// Stands in for Claude so the tests never call the real API. Returns the
// requests that were made.
function mockClaude(respond = () => Response.json(message([{ type: 'text', text: 'dud answer' }]))) {
  const requests = [];
  mock.method(globalThis, 'fetch', async (url, options) => {
    requests.push({ url: String(url), headers: new Headers(options.headers), body: JSON.parse(options.body) });
    return respond();
  });
  return requests;
}

function reset(t) {
  process.env.ANTHROPIC_API_KEY = 'dud-key';
  delete process.env.CLAUDE_MODEL;
  t.after(() => mock.restoreAll());
}

test('generate sends the prompt and system prompt to Haiku at medium effort and returns the reply', async (t) => {
  reset(t);
  const requests = mockClaude();

  assert.equal(await generate({ systemPrompt: 'Be brief.', prompt: 'What is osmosis?' }), 'dud answer');

  const [request] = requests;
  assert.match(request.url, /^https:\/\/api\.anthropic\.com\/v1\/messages/);
  assert.equal(request.headers.get('x-api-key'), 'dud-key');
  assert.equal(request.body.model, 'claude-haiku-5-5');
  assert.deepEqual(request.body.output_config, { effort: 'medium' });
  assert.equal(request.body.system, 'Be brief.');
  assert.deepEqual(request.body.messages, [{ role: 'user', content: 'What is osmosis?' }]);
});

test('generate leaves out an empty system prompt', async (t) => {
  reset(t);
  const requests = mockClaude();

  await generate({ systemPrompt: '', prompt: 'What is osmosis?' });

  assert.equal('system' in requests[0].body, false);
});

test('generate asks for JSON in the given shape when given a schema', async (t) => {
  reset(t);
  const requests = mockClaude();
  const schema = { type: 'object', additionalProperties: false, required: ['answer'], properties: { answer: { type: 'string' } } };

  await generate({ systemPrompt: '', prompt: 'hi', schema });

  assert.deepEqual(requests[0].body.output_config, { effort: 'medium', format: { type: 'json_schema', schema } });
});

test('generate reads the answer past any thinking blocks', async (t) => {
  reset(t);
  mockClaude(() => Response.json(message([{ type: 'thinking', thinking: '', signature: 'dud' }, { type: 'text', text: 'the answer' }])));

  assert.equal(await generate({ systemPrompt: '', prompt: 'hi' }), 'the answer');
});

test("generate passes on Claude's reason for refusing a request", async (t) => {
  reset(t);
  mockClaude(() => Response.json({ type: 'error', error: { type: 'invalid_request_error', message: 'prompt is too long' } }, { status: 400 }));

  await assert.rejects(generate({ systemPrompt: '', prompt: 'hi' }), { message: 'prompt is too long' });
});

test('generate says so when the API key is wrong', async (t) => {
  reset(t);
  mockClaude(() => Response.json({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }, { status: 401 }));

  await assert.rejects(generate({ systemPrompt: '', prompt: 'hi' }), /didn't accept your ANTHROPIC_API_KEY/);
});

test('generate says so when Claude declines or sends back nothing', async (t) => {
  reset(t);
  mockClaude(() => Response.json(message([], { stop_reason: 'refusal' })));
  await assert.rejects(generate({ systemPrompt: '', prompt: 'hi' }), /Claude declined to answer/);

  globalThis.fetch.mock.mockImplementation(async () => Response.json(message([])));
  await assert.rejects(generate({ systemPrompt: '', prompt: 'hi' }), /didn't send back an answer/);
});

test('there are three study skills, each with a system prompt and a way to run', () => {
  assert.deepEqual(SKILLS.map((s) => s.id), ['group-study-plan', 'critique-notes', 'ask-question']);
  for (const skill of SKILLS) {
    assert.equal(typeof skill.systemPrompt, 'string');
    // A skill either runs itself or just builds a prompt.
    assert.equal(typeof (skill.run ?? skill.buildPrompt), 'function');
  }
});

test('runStudySkill sends what the skill builds from the input', async (t) => {
  reset(t);
  const requests = mockClaude();
  const skill = SKILLS.find((s) => s.id === 'ask-question');

  assert.deepEqual(await runStudySkill('ask-question', '  What is osmosis?  '), { text: 'dud answer' });
  assert.match(requests[0].body.system, /study helper answering a student's question/);
  assert.deepEqual(requests[0].body.messages, [{ role: 'user', content: skill.buildPrompt('What is osmosis?') }]);
});

test('runStudySkill refuses an unknown skill or empty input without calling Claude', async (t) => {
  reset(t);
  const requests = mockClaude();

  await assert.rejects(runStudySkill('write-my-essay', 'hello'), /No such study skill/);
  await assert.rejects(runStudySkill('ask-question', '   '), /Type something first/);
  assert.equal(requests.length, 0);
});
