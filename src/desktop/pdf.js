const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { app, BrowserWindow, shell } = require('electron');

// Turns a page of HTML into a PDF in the user's Downloads folder and opens it.

// A file name with nothing in it a file system would refuse.
function safeName(name) {
  return String(name).replace(/[\\/:*?"<>|\x00-\x1f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) || 'Fishtank';
}

// A path in dir for name.pdf that doesn't exist yet: name.pdf, name (2).pdf, ...
function freePath(dir, name) {
  for (let n = 1; ; n++) {
    const candidate = path.join(dir, n === 1 ? `${name}.pdf` : `${name} (${n}).pdf`);
    if (!fs.existsSync(candidate)) return candidate;
  }
}

// Prints the HTML to a PDF called `name` in Downloads, opens it in the default
// viewer and resolves with its path. The page is rendered in a hidden window
// with scripts off, since its text comes from Claude.
async function savePdf({ html, name }) {
  const page = path.join(os.tmpdir(), `fishtank-${process.pid}-${Date.now()}.html`);
  fs.writeFileSync(page, html);
  const win = new BrowserWindow({ show: false, webPreferences: { javascript: false } });
  try {
    await win.loadFile(page);
    const pdf = await win.webContents.printToPDF({ pageSize: 'Letter', printBackground: true });
    const filePath = freePath(app.getPath('downloads'), safeName(name));
    fs.writeFileSync(filePath, pdf);
    void shell.openPath(filePath);
    return filePath;
  } finally {
    win.destroy();
    fs.rmSync(page, { force: true });
  }
}

module.exports = { savePdf, safeName };
