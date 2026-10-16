const { execFile } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { promisify } = require('node:util');
const { app, screen, BrowserWindow, shell } = require('electron');

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
// True while a study app has been brought forward, so the tank does not
// jump back to fullscreen over it.
let handingOff = false;
// True after this session hid the taskbar so a study app could sit in front.
let taskbarHidden = false;
// The edge bubble that brings a study app forward during Focus. Null when
// that list isn't in use.
let studyBubble = null;

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
    .map(({ id, name, path: exe }) => {
      const row = { id, name };
      if (typeof exe === 'string' && exe.trim()) row.path = exe.trim();
      return row;
    });
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
      // Size first, then enter fullscreen once. Leaving fullscreen to resize
      // and entering it again plays the transition twice, which is most of
      // the wait when a session starts.
      if (!win.isFullScreen() && !coversDisplay(win, next)) win.setBounds(next);
      win.setAlwaysOnTop(true, 'screen-saver');
      if (!win.isFullScreen()) win.setFullScreen(true);
      raiseStudyBubble();
      return;
    }
    if (!win.isFullScreen()) win.setFullScreen(true);
  } catch {
    // A session that can't take the whole display still runs the timer.
  }
  raiseStudyBubble();
}

function onCoverFocus() {
  if (!screenCover || screenCover.win.isDestroyed()) return;
  handingOff = false;
  const win = screenCover.win;
  if (process.platform === 'win32' && win.isFullScreen() && coversDisplay(win, displayBounds(win))) {
    win.setAlwaysOnTop(true, 'screen-saver');
    raiseStudyBubble();
    return;
  }
  fillDisplay(win);
}

function onCoverLeaveFullScreen() {
  // Opening the bubble must not uncover the taskbar. A study app that was
  // asked to the front is allowed to leave the tank's fullscreen; the bar
  // stays down until the session ends.
  if (handingOff && windows) void windows.setTaskbarVisible(false);
  const win = screenCover && screenCover.win;
  if (handingOff || !win || win.isDestroyed()) return;
  setTimeout(() => {
    if (handingOff || !screenCover || screenCover.win !== win || win.isDestroyed() || win.isFullScreen()) return;
    win.setFullScreen(true);
    raiseStudyBubble();
  }, 0);
}

function onCoverBlur() {
  // An allowed study app has to be able to come forward. The taskbar may
  // show while that app is in front; Focus covers it again when it returns.
  // While the bubble is up, only picking a study app lowers the tank, so
  // clicking the bubble itself does not uncover the desktop.
  if (!screenCover || screenCover.win.isDestroyed() || process.platform !== 'win32') return;
  if (studyBubble && !studyBubble.isDestroyed()) return;
  screenCover.win.setAlwaysOnTop(false);
}

function onDisplayMetrics() {
  if (!screenCover || screenCover.win.isDestroyed()) return;
  fillDisplay(screenCover.win);
}

function watchCover(win) {
  win.on('focus', onCoverFocus);
  win.on('blur', onCoverBlur);
  win.on('leave-full-screen', onCoverLeaveFullScreen);
  screen.on('display-metrics-changed', onDisplayMetrics);
}

function unwatchCover(win) {
  if (win && !win.isDestroyed()) {
    win.removeListener('focus', onCoverFocus);
    win.removeListener('blur', onCoverBlur);
    win.removeListener('leave-full-screen', onCoverLeaveFullScreen);
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
  // Windows sometimes shrinks a fullscreen window to the work area. Nudge the
  // bounds back without leaving fullscreen, so the transition does not play again.
  setTimeout(() => {
    if (!screenCover || screenCover.win !== win || win.isDestroyed()) return;
    if (process.platform !== 'win32') {
      fillDisplay(win);
      return;
    }
    const next = displayBounds(win);
    if (!coversDisplay(win, next)) win.setBounds(next);
    if (win.isFocused()) win.setAlwaysOnTop(true, 'screen-saver');
    raiseStudyBubble();
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

// Keeps the study-app bubble above the tank and above a study app. It stays
// for the whole session, including after a study app has been brought forward.
function raiseStudyBubble() {
  if (!studyBubble || studyBubble.isDestroyed()) return;
  if (!studyBubble.isVisible()) studyBubble.showInactive();
  studyBubble.setAlwaysOnTop(true, 'screen-saver');
  studyBubble.moveTop();
}

// The dot sits on the screen edge. The extra space is only for the round glow,
// so the halo is not clipped into a square by the window.
const BUBBLE_DOT = 64;
const BUBBLE_GLOW = 40;

function bubbleBounds(area, expanded, contentHeight) {
  const width = expanded ? 280 : BUBBLE_DOT + BUBBLE_GLOW * 2;
  // The menu stays in the bottom band. A tall window covers the end-session
  // dialog, and its empty area still takes the click.
  const cap = Math.min(240, Math.round(area.height * 0.3));
  const wanted = expanded ? Math.ceil(Number(contentHeight) || 0) + 8 : 0;
  const height = expanded ? Math.max(BUBBLE_DOT + 88, Math.min(cap, wanted || cap)) : BUBBLE_DOT + BUBBLE_GLOW;
  return {
    x: Math.round(area.x + (area.width - width) / 2),
    y: Math.round(area.y + area.height - height),
    width,
    height,
  };
}

// The window is only as big as the bubble, or the bubble plus its list.
// A full-height click-through strip stopped taking clicks after the first one.
function layoutStudyBubble(expanded, contentHeight) {
  if (!studyBubble || studyBubble.isDestroyed()) return;
  const anchor = screenCover && screenCover.win && !screenCover.win.isDestroyed() ? screenCover.win : studyBubble;
  const area = screen.getDisplayMatching(anchor.getBounds()).bounds;
  studyBubble.setBounds(bubbleBounds(area, expanded, contentHeight));
  raiseStudyBubble();
}

function openStudyBubble(anchor) {
  if (studyBubble && !studyBubble.isDestroyed()) {
    raiseStudyBubble();
    return;
  }
  const display = screen.getDisplayMatching(anchor.getBounds());
  const bounds = bubbleBounds(display.bounds, false, 0);
  studyBubble = new BrowserWindow({
    ...bounds,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    thickFrame: false,
    hasShadow: false,
    show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  studyBubble.setAlwaysOnTop(true, 'screen-saver');
  studyBubble.once('ready-to-show', () => {
    if (studyBubble && !studyBubble.isDestroyed()) {
      studyBubble.showInactive();
      raiseStudyBubble();
    }
  });
  const devUrl = process.env.FISHTANK_DEV_SERVER_URL;
  if (devUrl) {
    const url = new URL(devUrl);
    url.hash = 'study-bubble';
    void studyBubble.loadURL(url.href);
  } else {
    void studyBubble.loadFile(path.join(__dirname, '..', '..', 'dist', 'frontend', 'index.html'), { hash: 'study-bubble' });
  }
}

function closeStudyBubble() {
  handingOff = false;
  if (studyBubble && !studyBubble.isDestroyed()) studyBubble.destroy();
  studyBubble = null;
}

// The tank comes back to the front. The study app that was in front is left
// at whatever size the user had it.
function showTank() {
  handingOff = false;
  const win = screenCover && screenCover.win;
  if (!win || win.isDestroyed()) return false;
  if (win.isMinimized()) win.restore();
  fillDisplay(win);
  win.show();
  win.focus();
  raiseStudyBubble();
  return true;
}

// Brings one saved study app to the front without moving or resizing its window.
async function focusStudyApp(appId) {
  const id = String(appId || '').trim();
  const saved = getAllowedApps().find((item) => item.id.toLowerCase() === id.toLowerCase());
  if (!saved) return false;
  handingOff = true;
  const win = screenCover && screenCover.win;
  // The taskbar comes out as soon as the tank stops being the foreground
  // window. Hold it down first, then let the study app keep its own size.
  if (windows) {
    taskbarHidden = (await windows.setTaskbarVisible(false)) || taskbarHidden;
  }
  if (win && !win.isDestroyed()) win.setAlwaysOnTop(false);
  let opened = false;
  if (windows) {
    const focused = await windows.focusApp(saved.id, () => {
      // The bubble does not take focus on its own, so after one study app is
      // in front Windows will not let us raise the next one. Become the
      // foreground for this click, then hand it to that app.
      const bubble = studyBubble;
      if (!bubble || bubble.isDestroyed()) return;
      bubble.setFocusable(true);
      bubble.focus();
    });
    // 'miss' means it is not running. A running app is never launched again:
    // starting Edge a second time was closing the window already open.
    if (focused === true) {
      opened = true;
      taskbarHidden = true;
    } else if (focused === 'miss' && saved.path) {
      opened = (await shell.openPath(saved.path)) === '';
      if (opened) taskbarHidden = true;
    }
  } else {
    try {
      await run('open', ['-b', saved.id]);
      opened = true;
    } catch {
      opened = false;
    }
  }
  if (studyBubble && !studyBubble.isDestroyed()) studyBubble.setFocusable(false);
  if (!opened) {
    handingOff = false;
    if (win && !win.isDestroyed()) {
      win.setAlwaysOnTop(true, 'screen-saver');
      if (!win.isFullScreen()) win.setFullScreen(true);
    }
  }
  raiseStudyBubble();
  return opened;
}

// --- Starting and stopping ---

// Starts study mode for the given window. When enforceWhitelist is false,
// no other software may stay in front. When it is true, only the saved
// study apps may. onBlocked is called with the name of each app sent back.
async function startStudy(win, onBlocked, enforceWhitelist = true) {
  await stopStudy();
  enterScreenCover(win);
  if (windows) keysLocked = await windows.setKeyLock(true);

  let checking = false;
  watcher = setInterval(async () => {
    // The bubble has to stay on the edge after each study app is opened.
    // Windows puts the taskbar back when that app is in front; push it down.
    raiseStudyBubble();
    if (handingOff && windows) void windows.setTaskbarVisible(false);
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
  if (enforceWhitelist) openStudyBubble(win);
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
  const restoreBar = taskbarHidden;
  taskbarHidden = false;
  closeStudyBubble();
  leaveScreenCover();
  if (windows && keysLocked) {
    keysLocked = false;
    await windows.setKeyLock(false);
  }
  if (restoreBar && windows) await windows.setTaskbarVisible(true);
  if (!silenced) return;
  silenced = false;
  if (windows) await windows.setDoNotDisturb(false);
  else await runFocusShortcut(FOCUS_SHORTCUTS.off);
}

module.exports = {
  FOCUS_SHORTCUTS,
  parseApp, parseAppList, isAllowed,
  listRunningApps, getAllowedApps, setAllowedApps, startStudy, stopStudy,
  focusStudyApp, showTank,
  setStudyBubbleOpen(open, contentHeight) {
    layoutStudyBubble(Boolean(open), Number(contentHeight) || 0);
  },
};
