const { execFile } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { promisify } = require('node:util');
const { app } = require('electron');

const run = promisify(execFile);

// Study mode: the softer kind of lock-in. The window isn't locked; instead
// notifications are silenced and only the apps on the user's list may be in
// front. Bringing any other app forward puts Fishtank back on top.
//
// macOS only: other systems have no lsappinfo or shortcuts, so there study
// mode runs the timer and nothing else.

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
];

// The running session's timer, or null when study mode is off.
let watcher = null;
// Whether this session switched the Focus on, and so has to switch it off.
let silenced = false;
// The window this session made as big as the screen allows, to put back to
// its old size afterwards, or null if it was already that big.
let maximized = null;

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
  return (
    front.pid === process.pid ||
    ALWAYS_ALLOWED.includes(front.id) ||
    allowedApps.some((allowed) => allowed.id === front.id)
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

// --- Starting and stopping ---

// Starts study mode for the given window, growing it to fill the screen (short
// of full screen). onBlocked is called with the name of each app that gets
// sent to the back. Resolves with { notificationsSilenced }, which is false
// when the Focus shortcut is missing.
async function startStudy(win, onBlocked) {
  await stopStudy();

  if (!win.isMaximized()) {
    win.maximize();
    maximized = win;
  }

  let checking = false;
  watcher = setInterval(async () => {
    // Nothing to check while Fishtank itself is in front.
    if (checking || win.isDestroyed() || win.isFocused()) return;
    checking = true;
    try {
      const front = await frontApp();
      // Fishtank may have come to the front while that was being looked up.
      if (!watcher || win.isDestroyed() || win.isFocused()) return;
      if (!front || isAllowed(front, getAllowedApps())) return;
      if (win.isMinimized()) win.restore();
      win.show();
      app.focus({ steal: true });
      win.focus();
      onBlocked(front.name);
    } finally {
      checking = false;
    }
  }, CHECK_MS);

  silenced = await runFocusShortcut(FOCUS_SHORTCUTS.on);
  return { notificationsSilenced: silenced };
}

// Stops study mode: puts the window back to its old size and lets
// notifications through again. Safe to call when study mode isn't running.
async function stopStudy() {
  clearInterval(watcher);
  watcher = null;
  if (maximized && !maximized.isDestroyed()) maximized.unmaximize();
  maximized = null;
  if (!silenced) return;
  silenced = false;
  await runFocusShortcut(FOCUS_SHORTCUTS.off);
}

module.exports = {
  FOCUS_SHORTCUTS,
  parseApp, parseAppList, isAllowed,
  listRunningApps, getAllowedApps, setAllowedApps, startStudy, stopStudy,
};
