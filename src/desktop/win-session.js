const { spawn } = require('node:child_process');
const path = require('node:path');

// Processes that show a window but aren't apps the user studies with.
const SKIP_PICKER = new Set([
  'textinputhost',
  'lockapp',
  'logonui',
  'consent',
  'credentialuibroker',
  'shellexperiencehost',
  'searchhost',
  'startmenuexperiencehost',
  'runtimebroker',
  'applicationframehost',
  'systemsettings',
  'dwm',
  'sihost',
  'ctfmon',
  'fontdrvhost',
  'winlogon',
  'csrss',
  'powershell',
  'pwsh',
  'conhost',
]);

// Turns the helper's app list into the [{ id, name }] the study picker shows.
function presentWindowsApps(apps) {
  if (!Array.isArray(apps)) return [];
  const seen = new Set();
  const out = [];
  for (const app of apps) {
    if (!app || typeof app.id !== 'string' || !app.id) continue;
    const id = app.id.toLowerCase();
    if (SKIP_PICKER.has(id) || seen.has(id)) continue;
    seen.add(id);
    const name = typeof app.name === 'string' && app.name.trim() ? app.name.trim() : id;
    out.push({ id, name });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

// --- helper process ---
// Lines are queued because the helper can write a whole list in one burst,
// before the caller asks for the next line.

let child = null;
let ready = null;
let buffer = '';
const pendingLines = [];
let waiter = null;
let chain = Promise.resolve();

function decodeChunk(chunk) {
  if (chunk.length >= 4 && chunk[1] === 0 && chunk[3] === 0) return chunk.toString('utf16le');
  return chunk.toString('utf8');
}

function pushLine(line) {
  if (waiter) {
    const current = waiter;
    waiter = null;
    current(line);
  } else {
    pendingLines.push(line);
  }
}

function onData(chunk) {
  buffer += decodeChunk(chunk);
  let nl;
  while ((nl = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, nl).replace(/\r$/, '');
    buffer = buffer.slice(nl + 1);
    if (line === 'READY' || line === '') continue;
    pushLine(line);
  }
}

function nextLine() {
  if (pendingLines.length > 0) return Promise.resolve(pendingLines.shift());
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (waiter) {
        waiter = null;
        reject(new Error('Windows study helper timed out'));
      }
    }, 8000);
    waiter = (line) => {
      clearTimeout(timer);
      resolve(line);
    };
  });
}

function startHelper() {
  if (child && child.exitCode === null && !child.killed) return ready;
  buffer = '';
  pendingLines.length = 0;
  waiter = null;
  child = spawn(
    'powershell.exe',
    ['-NoProfile', '-NoLogo', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'win-session.ps1')],
    { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true },
  );
  child.stdout.on('data', onData);
  child.stderr.on('data', () => {});
  child.on('exit', () => {
    pushLine('ERR\thelper exited');
    child = null;
    ready = null;
  });
  const started = nextLine();
  child.stdin.write('ping\n');
  ready = started.then((line) => {
    if (line !== 'PONG') throw new Error(line.startsWith('ERR\t') ? line.slice(4) : 'Windows study helper did not start');
  }).catch((err) => {
    ready = null;
    throw err;
  });
  return ready;
}

function enqueue(fn) {
  const run = chain.then(fn);
  chain = run.then(() => {}, () => {});
  return run;
}

async function send(command) {
  await startHelper();
  const pending = nextLine();
  child.stdin.write(command + '\n');
  return pending;
}

function parseAppLine(line) {
  if (!line.startsWith('APP')) return null;
  const parts = line.split('\t');
  if (parts.length < 4 || !parts[1]) return null;
  const pid = Number(parts[2]);
  return { id: parts[1], name: parts.slice(3).join('\t'), pid: Number.isFinite(pid) ? pid : null };
}

async function foregroundApp() {
  try {
    const line = await enqueue(() => send('front'));
    return parseAppLine(line);
  } catch {
    return null;
  }
}

async function runningApps(ownPid) {
  try {
    return await enqueue(async () => {
      const line = await send(`list ${ownPid}`);
      if (line !== 'APPS') return [];
      const apps = [];
      for (;;) {
        const next = await nextLine();
        if (next === 'APPS-END' || next.startsWith('ERR')) break;
        if (!next.startsWith('ITEM\t')) continue;
        const parts = next.split('\t');
        apps.push({ id: parts[1], name: parts.slice(2).join('\t') });
      }
      return presentWindowsApps(apps);
    });
  } catch {
    return [];
  }
}

// True once this session is the one that turned Do Not Disturb on, so stopping
// the session turns it back off. Left alone when it was already on.
let quietOwned = false;

async function readLevel() {
  const line = await send('level');
  const parts = line.split('\t');
  if (parts[0] !== 'LEVEL') return null;
  const status = Number(parts[1]);
  const level = Number(parts[2]);
  if (status !== 0 || !Number.isFinite(level)) return null;
  return level;
}

// Turns Do Not Disturb on (alarms only) or, if this session turned it on,
// back off. Resolves with whether notifications are silenced afterwards.
async function setDoNotDisturb(on) {
  try {
    return await enqueue(async () => {
      if (on) {
        const level = await readLevel();
        if (level === null) return false;
        if (level > 0) {
          quietOwned = false;
          return true;
        }
        const line = await send('dnd-on');
        const parts = line.split('\t');
        const status = Number(parts[1]);
        const now = Number(parts[2]);
        quietOwned = parts[0] === 'SET' && status === 0 && now > 0;
        return quietOwned;
      }
      if (!quietOwned) return true;
      quietOwned = false;
      const line = await send('dnd-off');
      return line.startsWith('SET');
    });
  } catch {
    return false;
  }
}

// Swallows the Windows keys, Alt+Tab and the other shortcuts that leave Focus.
// Resolves with whether that block is in place afterwards. Ctrl+Alt+Del still
// works, because Windows handles it before any app can see it.
async function setKeyLock(on) {
  try {
    return await enqueue(async () => {
      const line = await send(on ? 'keys-on' : 'keys-off');
      return line === 'KEYS\t1';
    });
  } catch {
    return false;
  }
}

// Pulls the Electron window in front of whatever just stole it. Always-on-top
// is only held for a moment so an allowed study app can still be used.
function stealFocus(win) {
  if (!win || win.isDestroyed()) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.setAlwaysOnTop(true);
  win.moveTop();
  win.focus();
  setTimeout(() => {
    // Fullscreen Focus stays above the taskbar. Dropping always-on-top here
    // would let the taskbar draw over it again.
    if (!win.isDestroyed() && !win.isKiosk() && !win.isFullScreen()) win.setAlwaysOnTop(false);
  }, 250);
}

let strictTimer = null;

// While strict lock-in is on, bring the window back whenever it loses focus.
// The key lock blocks Alt+Tab and the Windows key; this covers anything that
// still gets in front another way.
function watchStrict(win, on) {
  clearInterval(strictTimer);
  strictTimer = null;
  if (!on) return;
  strictTimer = setInterval(() => {
    if (win.isDestroyed()) {
      watchStrict(win, false);
      return;
    }
    if (win.isFocused() && win.isVisible()) return;
    if (win.isMinimized()) win.restore();
    win.show();
    win.moveTop();
    win.focus();
  }, 400);
}

function shutdownWindowsSession() {
  clearInterval(strictTimer);
  strictTimer = null;
  quietOwned = false;
  if (child && child.exitCode === null && !child.killed) {
    try { child.stdin.write('exit\n'); } catch { /* already gone */ }
    child.kill();
  }
  child = null;
  ready = null;
}

module.exports = {
  SKIP_PICKER,
  presentWindowsApps,
  foregroundApp,
  runningApps,
  setDoNotDisturb,
  setKeyLock,
  stealFocus,
  watchStrict,
  shutdownWindowsSession,
};
