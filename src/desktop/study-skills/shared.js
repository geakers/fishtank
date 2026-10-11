const notes = require('../notes');

// Pieces the study skills share: turning notes into the content of a Claude
// message, and the HTML helpers for the PDFs.

// Files travel inside the request, which Claude caps at 32 MB once encoded
// (encoding adds a third). Claude also takes no image over 5 MB.
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// The file's name as uploaded: storage paths end in "<number>-<name>".
function fileName(storagePath) {
  return storagePath.split('/').pop().replace(/^\d+-/, '');
}

// The Claude content block for a file: a document block for a PDF, an image
// block for a picture.
function fileBlock(mimeType, bytes) {
  const source = { type: 'base64', media_type: mimeType, data: Buffer.from(bytes).toString('base64') };
  return { type: mimeType === 'application/pdf' ? 'document' : 'image', source };
}

// Returns the Claude content blocks for the given notes: each note's title and
// typed text, then each of its files. author(note), when given, names who
// wrote it.
async function noteContent(noteList, author) {
  const parts = [];
  let fileBytes = 0;
  for (const [index, note] of noteList.entries()) {
    const files = note.note_files ?? [];
    const by = author ? author(note) : null;
    parts.push({
      type: 'text',
      text: `--- Note ${index + 1} of ${noteList.length} ---\nTitle: ${note.title}\n${by ? `Author: ${by}\n` : ''}Files: ${files.length}\n\n${note.body ?? '(no typed text)'}`,
    });
    for (const file of files) {
      fileBytes += file.size_bytes;
      if (fileBytes > MAX_FILE_BYTES) {
        throw new Error('These note files add up to more than 20 MB, which is too much to send to Claude at once.');
      }
      if (file.mime_type !== 'application/pdf' && file.size_bytes > MAX_IMAGE_BYTES) {
        throw new Error(`"${fileName(file.storage_path)}" is over 5 MB, which is too big an image to send to Claude.`);
      }
      const bytes = await notes.downloadNoteFile(file.storage_path);
      parts.push({ type: 'text', text: `File "${fileName(file.storage_path)}" from note ${index + 1} ("${note.title}"${by ? `, by ${by}` : ''}):` });
      parts.push(fileBlock(file.mime_type, bytes));
    }
  }
  return parts;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function bullets(items) {
  const filled = (items ?? []).filter(Boolean);
  if (filled.length === 0) return '<p class="none">Nothing to add.</p>';
  return `<ul>${filled.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
}

// Building blocks for the JSON schemas Claude's replies have to match. Every
// field of an object is required and nothing else is allowed in it.
const text = { type: 'string' };
const list = { type: 'array', items: text };
const listOf = (items) => ({ type: 'array', items });
const object = (properties) => ({ type: 'object', additionalProperties: false, required: Object.keys(properties), properties });

// Reads Claude's JSON reply, or throws a message the user can act on.
function parseReply(reply, what) {
  try {
    return JSON.parse(reply);
  } catch {
    throw new Error(`Claude's ${what} couldn't be read. Try again.`);
  }
}

module.exports = { MAX_FILE_BYTES, fileName, noteContent, escapeHtml, bullets, parseReply, text, list, listOf, object };
