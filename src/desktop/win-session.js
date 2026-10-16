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
    ['-NoProfile', '-NoLogo', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'win-session.ps1'), String(process.pid)],
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

let user32 = null;

function win32() {
  if (user32) return user32;
  const koffi = require('koffi');
  const lib = koffi.load('user32.dll');
  user32 = {
    // Win32 BOOL is a 4-byte int. A restored window is only restored, never resized.
    setForegroundWindow: lib.func('int __stdcall SetForegroundWindow(uintptr_t hWnd)'),
    showWindow: lib.func('int __stdcall ShowWindow(uintptr_t hWnd, int nCmdShow)'),
    isIconic: lib.func('int __stdcall IsIconic(uintptr_t hWnd)'),
    getForegroundWindow: lib.func('uintptr_t __stdcall GetForegroundWindow()'),
    bringWindowToTop: lib.func('int __stdcall BringWindowToTop(uintptr_t hWnd)'),
  };
  return user32;
}

function hwndValue(value) {
  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
}

// Raises hwnd. A minimized window is restored to the size it already had.
// No keystrokes and no thread attach: those were closing Edge.
function activateWindow(api, hwnd) {
  if (api.isIconic(hwnd) !== 0) {
    api.showWindow(hwnd, 9);
    if (api.isIconic(hwnd) !== 0) api.showWindow(hwnd, 1);
  }
  api.bringWindowToTop(hwnd);
  const raised = api.setForegroundWindow(hwnd) !== 0;
  return raised || hwndValue(api.getForegroundWindow()) === hwndValue(hwnd);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Puts a running app's own window in front. A minimized window is restored
// to the size it already had. The click that asked for this has to finish
// first: attaching that click to the app can land on its close button.
async function focusApp(appId, beforeActivate) {
  const id = String(appId || '').trim().toLowerCase();
  if (!id || /[\r\n\t]/.test(id)) return false;
  let hwnd = 0n;
  try {
    const line = await enqueue(() => send(`focus ${id}`));
    const parts = line.split('\t');
    if (parts[1] === 'miss') return 'miss';
    if (parts[1] !== 'hwnd') return false;
    hwnd = hwndValue(parts[2]);
    if (hwnd <= 0n) return false;
  } catch {
    return false;
  }
  // The click that chose this app has to finish first, or its mouse-up can
  // land on the app and close it.
  await sleep(160);
  try {
    if (typeof beforeActivate === 'function') beforeActivate();
  } catch {
    // Focusing the bubble is only a way in. The activate below still runs.
  }
  await sleep(40);
  let brought = false;
  try {
    const api = win32();
    brought = activateWindow(api, hwnd);
    if (!brought) {
      await sleep(80);
      brought = activateWindow(api, hwnd);
    }
  } catch {
    brought = false;
  }
  try {
    await setTaskbarVisible(false);
  } catch {
    // Hiding the bar must not report the switch as a failure.
  }
  return brought;
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
        const app = { id: parts[1], name: parts[2] || parts[1] };
        const exe = parts.slice(3).join('\t').trim();
        if (exe) app.path = exe;
        apps.push(app);
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

// Turns Do Not Disturb on (alarms only) or, if this session turned it on,
// back off. One helper command does the read and the write. Resolves with
// whether notifications are silenced afterwards.
async function setDoNotDisturb(on) {
  try {
    return await enqueue(async () => {
      if (on) {
        const line = await send('dnd-on');
        const parts = line.split('\t');
        const status = Number(parts[1]);
        const level = Number(parts[2]);
        if (parts[0] !== 'SET' || status !== 0 || !Number.isFinite(level)) return false;
        quietOwned = parts[3] === '1';
        return level > 0;
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

// True while the helper is holding the shortcut hook. A second request for
// the same state does not take another trip.
let keysHeld = false;

// Swallows the Windows keys, Alt+Tab and the other shortcuts that leave Focus.
// Resolves with whether that block is in place afterwards. Ctrl+Alt+Del still
// works, because Windows handles it before any app can see it.
async function setKeyLock(on) {
  const want = Boolean(on);
  try {
    return await enqueue(async () => {
      if (want === keysHeld) return true;
      const line = await send(want ? 'keys-on' : 'keys-off');
      const ok = line === 'KEYS\t1';
      if (want) keysHeld = ok;
      else if (ok) keysHeld = false;
      return want ? keysHeld : ok;
    });
  } catch {
    return false;
  }
}

// Holds the taskbar down, or puts it back. Hiding is repeated on purpose:
// Windows shows the bar again when a study app becomes the foreground window.
async function setTaskbarVisible(visible) {
  try {
    const line = await enqueue(() => send(visible ? 'taskbar-on' : 'taskbar-off'));
    return line === 'TASKBAR\t1';
  } catch {
    return false;
  }
}

// Compiles the helper before a session needs it. The first PowerShell start
// is the slow part of entering Focus; doing it at launch takes it off that path.
function prepare() {
  void startHelper().catch(() => {});
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
  keysHeld = false;
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
  focusApp,
  setTaskbarVisible,
  runningApps,
  setDoNotDisturb,
  setKeyLock,
  prepare,
  stealFocus,
  watchStrict,
  shutdownWindowsSession,
};
