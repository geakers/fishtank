const path = require('node:path');
const Anthropic = require('@anthropic-ai/sdk');

// Calls Anthropic's Claude API through the official SDK. The key stays on the
// desktop side: it is read from ANTHROPIC_API_KEY, set either in the shell or
// in a .env file at the project root (which is not committed).

const DEFAULT_MODEL = 'claude-haiku-5-5';
// How hard Claude thinks before answering: low, medium, high, xhigh or max.
const EFFORT = 'medium';
const MAX_TOKENS = 16000;
// How long to wait for a reply before giving up, and how often to try again
// when Claude is overloaded or the connection drops.
const TIMEOUT_MS = 2 * 60 * 1000;
const MAX_RETRIES = 1;

let client = null;

function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    try {
      process.loadEnvFile(path.join(__dirname, '..', '..', '.env'));
    } catch {
      // No .env file; the check below says what's missing.
    }
  }
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('Set ANTHROPIC_API_KEY to use study skills');
  client ??= new Anthropic({
    timeout: TIMEOUT_MS,
    maxRetries: MAX_RETRIES,
    // Looked up on each call, so whatever fetch is current is the one used.
    fetch: (...args) => globalThis.fetch(...args),
  });
  return client;
}

// Sends one message to Claude and returns the text of its reply. The message
// is either `prompt` (plain text) or `content`, a list of Claude content
// blocks such as { type: 'text', text } and the document and image blocks for
// files. systemPrompt is left out of the request when it's empty. Give a JSON
// `schema` to get the reply as JSON text in that shape.
async function generate({ systemPrompt, prompt, content, schema }) {
  const anthropic = getClient();

  let response;
  try {
    response = await anthropic.messages.create({
      model: process.env.CLAUDE_MODEL || DEFAULT_MODEL,
      max_tokens: MAX_TOKENS,
      ...(systemPrompt ? { system: systemPrompt } : {}),
      output_config: {
        effort: EFFORT,
        ...(schema ? { format: { type: 'json_schema', schema } } : {}),
      },
      messages: [{ role: 'user', content: content ?? prompt }],
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) throw new Error("Claude didn't accept your ANTHROPIC_API_KEY.");
    if (err instanceof Anthropic.PermissionDeniedError) throw new Error("Your ANTHROPIC_API_KEY isn't allowed to use this model.");
    if (err instanceof Anthropic.RateLimitError) throw new Error('Claude is getting too many requests right now. Try again in a moment.');
    if (err instanceof Anthropic.APIConnectionTimeoutError) throw new Error('Claude took too long to answer. Try again in a moment.');
    if (err instanceof Anthropic.APIConnectionError) throw new Error("Couldn't reach Claude. Check your internet connection.");
    if (err instanceof Anthropic.APIError) throw new Error(err.error?.error?.message || err.message);
    throw err;
  }

  if (response.stop_reason === 'refusal') throw new Error('Claude declined to answer that.');
  if (response.stop_reason === 'max_tokens') throw new Error("Claude's answer was too long to finish. Ask for something shorter.");
  // The reply can start with thinking blocks, so pick the text out by type.
  const text = response.content.filter((block) => block.type === 'text').map((block) => block.text).join('');
  if (!text) throw new Error("Claude didn't send back an answer");
  return text;
}

module.exports = { generate, DEFAULT_MODEL, EFFORT };
