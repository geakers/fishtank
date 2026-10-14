const { execFile } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { promisify } = require('node:util');
const { app, screen } = require('electron');

const run = promisify(execFile);
const windows = process.platform === 'win32' ? require('./win-session') : null;

// Study mode: Focus. The window fills whichever display it is on, with no
// title bar and (on Windows) no taskbar. Notifications are silenced. On
// Windows the Windows key, Alt+Tab, three- and four-finger trackpad swipes,
// and the other app-switching shortcuts are swallowed until the session ends. Only the apps on the user's list may stay
// in front; anything else brings Fishtank back.
//
// macOS uses lsappinfo plus two Shortcuts that switch a Focus on and off.
// Windows uses the foreground window, a keyboard hook and Do Not Disturb.
// Elsewhere, study mode runs the timer and nothing else.

// How often to check which app is in front.
const CHECK_MS = 1000;

// macOS can't have its notifications turned off by an app directly, but the
// Shortcuts app can switch a Focus on and off. The user makes one shortcut
// with each of these names and study mode runs them.
const FOCUS_SHORTCUTS = { on: 'Fishtank Focus On', off: 'Fishtank Focus Off' };

// System apps that take over the screen by themselves (the lock screen,
// password prompts and the like). Never treated as a distraction.
const ALWAYS_ALLOWED = [
  'com.apple.loginwindow',
  'com.apple.SecurityAgent',
  'com.apple.ScreenSaver.Engine',
  'com.apple.UserNotificationCenter',
  'com.apple.coreservices.uiagent',
  // Windows: lock screen, UAC and the touch keyboard. Not distractions.
  'lockapp',
  'logonui',
  'consent',
  'credentialuibroker',
  'textinputhost',
];

// The running session's timer, or null when study mode is off.
let watcher = null;
// Whether this session switched the Focus on, and so has to switch it off.
let silenced = false;
// Whether this session is holding the Windows key and Alt+Tab lock.
let keysLocked = false;
// Where the window was before this session filled the display, so it can be
// put back. Null when study mode isn't covering the screen.
let screenCover = null;

// --- Reading lsappinfo ---

// Reads one app out of lsappinfo's text, e.g.
//   "Safari" ASN:0x0-0x1b01b:
//       bundleID="com.apple.Safari"
//       pid = 812 ... type="Foreground" ...
// Returns { id, name, pid, type }, or null if there is no app in the text. id is the
// bundle ID, or the name for the few apps without one.
function parseApp(text) {
  const name = text.match(/^\s*(?:\d+\)\s*)?"(.*)" ASN:/m)?.[1];
  if (!name) return null;
  const bundleId = text.match(/bundleID="([^"]*)"/)?.[1];
  const pid = text.match(/\bpid = (\d+)/)?.[1];
  return {
    id: bundleId || name,
    name,
    pid: pid === undefined ? null : Number(pid),
    type: text.match(/\btype="([^"]*)"/)?.[1] ?? null,
  };
}

// Reads `lsappinfo list` and returns [{ id, name }] for the ordinary apps (the
// ones with a Dock icon), sorted by name.
function parseAppList(text) {
  return text
    .split(/^\s*\d+\) (?=")/m)
    .map(parseApp)
    .filter((found) => found && found.type === 'Foreground' && found.pid !== process.pid)
    .map(({ id, name }) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Returns { id, name, pid } for the app in front, or null if that can't be
// found out.
async function frontApp() {
  if (windows) return windows.foregroundApp();
  try {
    const { stdout: asn } = await run('lsappinfo', ['front']);
    if (!asn.trim()) return null;
    const { stdout } = await run('lsappinfo', ['info', '-only', 'name,bundleid,pid', asn.trim()]);
    return parseApp(stdout);
  } catch {
    return null;
  }
}

// Returns [{ id, name }] for the apps that are open right now, other than
// Fishtank, for the user to pick their study apps from.
async function listRunningApps() {
  if (windows) return windows.runningApps(process.pid);
  try {
    const { stdout } = await run('lsappinfo', ['list']);
    return parseAppList(stdout);
  } catch {
    return [];
  }
}

// --- The user's study apps ---

function allowedAppsFile() {
  return path.join(app.getPath('userData'), 'study-apps.json');
}

// Keeps only well-formed { id, name } entries, one per app.
function cleanApps(apps) {
  if (!Array.isArray(apps)) return [];
  const seen = new Set();
  return apps
    .filter((a) => a && typeof a.id === 'string' && a.id && typeof a.name === 'string')
    .filter((a) => !seen.has(a.id) && seen.add(a.id))
    .map(({ id, name }) => ({ id, name }));
}

// Returns [{ id, name }] for the apps the user may use in study mode.
function getAllowedApps() {
  try {
    return cleanApps(JSON.parse(fs.readFileSync(allowedAppsFile(), 'utf8')));
  } catch {
    return [];
  }
}

// Saves the apps the user may use in study mode and returns what was saved.
// Refused during a study session, so the list can't be loosened part-way.
function setAllowedApps(apps) {
  if (watcher) throw new Error("Study apps can't be changed during a study session");
  const cleaned = cleanApps(apps);
  fs.writeFileSync(allowedAppsFile(), JSON.stringify(cleaned, null, 2));
  return cleaned;
}

// Whether the given front app may stay in front during study mode.
function isAllowed(front, allowedApps) {
  const id = typeof front.id === 'string' ? front.id : '';
  const idLower = id.toLowerCase();
  return (
    front.pid === process.pid ||
    ALWAYS_ALLOWED.includes(id) ||
    ALWAYS_ALLOWED.includes(idLower) ||
    allowedApps.some((allowed) => allowed.id === id || allowed.id.toLowerCase() === idLower)
  );
}

// --- Notifications ---

// Runs the user's shortcut that switches their Focus on or off. Resolves with
// false if it couldn't be run, which is what happens until they have made it.
async function runFocusShortcut(name) {
  try {
    // Checked first because running a shortcut that doesn't exist hangs
    // rather than failing.
    const { stdout } = await run('shortcuts', ['list'], { timeout: 10_000 });
    if (!stdout.split('\n').includes(name)) return false;
    await run('shortcuts', ['run', name], { timeout: 15_000 });
    return true;
  } catch {
    return false;
  }
}

// --- Filling the display ---

// The monitor the window is mostly on, including the taskbar strip.
// bounds are in DIP, so this follows that screen's resolution and scale,
// and a window on a second monitor stays on that monitor.
function displayBounds(win) {
  return screen.getDisplayMatching(win.getBounds()).bounds;
}

// True when the window already fills the monitor, within a pixel or two.
// The taskbar is much taller than that, so a work-area window does not pass.
function coversDisplay(win, next) {
  const current = win.getBounds();
  return (
    Math.abs(current.x - next.x) <= 2 &&
    Math.abs(current.y - next.y) <= 2 &&
    Math.abs(current.width - next.width) <= 2 &&
    Math.abs(current.height - next.height) <= 2
  );
}

// Hides the title bar and stretches over the taskbar on the current display.
function fillDisplay(win) {
  if (!win || win.isDestroyed()) return;
  try {
    if (process.platform === 'win32') {
      const next = displayBounds(win);
      // Fullscreen can stop at the work area and leave the taskbar showing.
      // Leave fullscreen before resizing, or Windows ignores the new bounds.
      if (!coversDisplay(win, next)) {
        if (win.isFullScreen()) win.setFullScreen(false);
        win.setBounds(next);
      }
      if (win.isFocused()) win.setAlwaysOnTop(true, 'screen-saver');
    }
    if (!win.isFullScreen()) win.setFullScreen(true);
  } catch {
    // A session that can't take the whole display still runs the timer.
  }
}

function onCoverFocus() {
  if (!screenCover || screenCover.win.isDestroyed()) return;
  const win = screenCover.win;
  if (process.platform === 'win32' && win.isFullScreen() && coversDisplay(win, displayBounds(win))) {
    win.setAlwaysOnTop(true, 'screen-saver');
    return;
  }
  fillDisplay(win);
}

function onCoverBlur() {
  // An allowed study app has to be able to come forward. The taskbar may
  // show while that app is in front; Focus covers it again when it returns.
  if (!screenCover || screenCover.win.isDestroyed() || process.platform !== 'win32') return;
  screenCover.win.setAlwaysOnTop(false);
}

function onDisplayMetrics() {
  if (!screenCover || screenCover.win.isDestroyed()) return;
  fillDisplay(screenCover.win);
}

function watchCover(win) {
  win.on('focus', onCoverFocus);
  win.on('blur', onCoverBlur);
  screen.on('display-metrics-changed', onDisplayMetrics);
}

function unwatchCover(win) {
  if (win && !win.isDestroyed()) {
    win.removeListener('focus', onCoverFocus);
    win.removeListener('blur', onCoverBlur);
  }
  screen.removeListener('display-metrics-changed', onDisplayMetrics);
}

function enterScreenCover(win) {
  if (!win || win.isDestroyed()) return;
  screenCover = {
    win,
    wasMaximized: win.isMaximized(),
    wasFullScreen: win.isFullScreen(),
    bounds: win.getNormalBounds(),
  };
  fillDisplay(win);
  watchCover(win);
  // Windows sometimes applies the work area a moment after fullscreen.
  setTimeout(() => {
    if (!screenCover || screenCover.win !== win || win.isDestroyed()) return;
    fillDisplay(win);
  }, 200);
}

function leaveScreenCover() {
  const saved = screenCover;
  screenCover = null;
  if (!saved) return;
  unwatchCover(saved.win);
  const win = saved.win;
  if (!win || win.isDestroyed()) return;
  if (process.platform === 'win32') win.setAlwaysOnTop(false);
  if (saved.wasFullScreen) return;
  let restored = false;
  const restore = () => {
    if (restored || win.isDestroyed()) return;
    restored = true;
    if (saved.wasMaximized) win.maximize();
    else win.setBounds(saved.bounds);
  };
  if (win.isFullScreen()) {
    win.once('leave-full-screen', restore);
    win.setFullScreen(false);
    // macOS leaves fullscreen asynchronously; other platforms can restore now.
    if (process.platform !== 'darwin') restore();
  } else {
    restore();
  }
}

// --- Starting and stopping ---

// Starts study mode for the given window. When enforceWhitelist is false,
// no other software may stay in front. When it is true, only the saved
// whitelist may. onBlocked is called with the name of each app sent back.
async function startStudy(win, onBlocked, enforceWhitelist = true) {
  await stopStudy();
  enterScreenCover(win);
  if (windows) keysLocked = await windows.setKeyLock(true);

  let checking = false;
  watcher = setInterval(async () => {
    // Nothing to check while Fishtank itself is in front.
    if (checking || win.isDestroyed() || win.isFocused()) return;
    checking = true;
    try {
      const front = await frontApp();
      // Fishtank may have come to the front while that was being looked up.
      if (!watcher || win.isDestroyed() || win.isFocused()) return;
      const allowed = enforceWhitelist ? getAllowedApps() : [];
      if (!front || isAllowed(front, allowed)) return;
      if (windows) windows.stealFocus(win);
      else {
        if (win.isMinimized()) win.restore();
        win.show();
        app.focus({ steal: true });
        win.focus();
      }
      onBlocked(front.name);
    } finally {
      checking = false;
    }
  }, CHECK_MS);

  silenced = windows ? await windows.setDoNotDisturb(true) : await runFocusShortcut(FOCUS_SHORTCUTS.on);
  return { notificationsSilenced: silenced };
}

// Stops study mode: puts the window back how it was and lets
// notifications through again. Safe to call when study mode isn't running.
// Overlapping calls share one run, so quitting can't restore notifications
// twice or tear the helper down halfway through.
let stopping = null;

async function stopStudy() {
  if (stopping) return stopping;
  stopping = finishStudy().finally(() => {
    stopping = null;
  });
  return stopping;
}

async function finishStudy() {
  clearInterval(watcher);
  watcher = null;
  leaveScreenCover();
  if (windows && keysLocked) {
    keysLocked = false;
    await windows.setKeyLock(false);
  }
  if (!silenced) return;
  silenced = false;
  if (windows) await windows.setDoNotDisturb(false);
  else await runFocusShortcut(FOCUS_SHORTCUTS.off);
}

module.exports = {
  FOCUS_SHORTCUTS,
  parseApp, parseAppList, isAllowed,
  listRunningApps, getAllowedApps, setAllowedApps, startStudy, stopStudy,
};
