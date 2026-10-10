const fs = require('node:fs');
const path = require('node:path');
const { app, safeStorage } = require('electron');
const { logIn, refreshSession, logOut } = require('../database/accounts');

// Refresh this long before the access token actually expires.
const EXPIRY_MARGIN_SECONDS = 60;

// The Supabase session for the logged-in user, or null. Tokens stay in the
// main process; the page only ever sees currentUser().
let session = null;
let refreshing = null;

function sessionFile() {
  return path.join(app.getPath('userData'), 'session');
}

// Keeps the session in memory and writes it, encrypted by the OS keychain, to
// disk so the user is still logged in after a restart.
function store(next) {
  next.expires_at ??= Math.floor(Date.now() / 1000) + next.expires_in;
  session = next;
  if (!safeStorage.isEncryptionAvailable()) return;
  fs.writeFileSync(sessionFile(), safeStorage.encryptString(JSON.stringify(next)), { mode: 0o600 });
}

function clear() {
  session = null;
  fs.rmSync(sessionFile(), { force: true });
}

// Loads the session saved by a previous run, if any. Call once the app is ready.
function restoreSession() {
  try {
    session = JSON.parse(safeStorage.decryptString(fs.readFileSync(sessionFile())));
  } catch {
    session = null;
  }
}

// Logs in with an email and password and keeps the resulting session.
async function startSession(credentials) {
  store(await logIn(credentials));
  return currentUser();
}

// Logs the user out. The saved session is always removed, even if Supabase
// can't be reached to end it on the server.
async function endSession() {
  try {
    const token = await getAccessToken();
    if (token) await logOut(token);
  } catch {
    // Nothing to do: the local session is cleared below either way.
  } finally {
    clear();
  }
}

// Returns { uid, email, username } for the logged-in user, or null.
function currentUser() {
  if (!session) return null;
  const { id, email, user_metadata } = session.user;
  return { uid: id, email, username: user_metadata?.username ?? null };
}

// Returns a valid access token for the logged-in user, or null if nobody is
// logged in. Access tokens are short-lived, so this swaps in a fresh one when
// the current one is about to expire; that is what keeps the user logged in.
async function getAccessToken() {
  if (!session) return null;
  if (session.expires_at - EXPIRY_MARGIN_SECONDS > Date.now() / 1000) return session.access_token;

  // Refresh tokens work once, so concurrent callers share a single refresh.
  refreshing ??= refreshSession(session.refresh_token)
    .then(store, (err) => {
      // Supabase has ended the session, so there is nothing left to keep.
      // Any other failure (e.g. offline) leaves the user logged in.
      if ([400, 401, 403].includes(err.status)) clear();
      throw err;
    })
    .finally(() => {
      refreshing = null;
    });
  await refreshing;
  return session.access_token;
}

module.exports = { restoreSession, startSession, endSession, currentUser, getAccessToken };
