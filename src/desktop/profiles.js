const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY } = require('../db');
const { getAccessToken } = require('./session');

// TESTING ONLY: while true, a session earns one point per second so points are
// quick to try out. Set to false for the real rate of 1/60 point per minute.
const TEST_POINT_PER_SECOND = true;

const POINTS_PER_MINUTE = TEST_POINT_PER_SECOND ? 60 : 1 / 60;

// How long a user can commit to focusing for, in whole minutes.
const MIN_COMMIT_MINUTES = 1;
const MAX_COMMIT_MINUTES = 240;

// A session ending this close to its commitment still counts as finished, so
// the renderer's timer and this process's clock needn't agree to the second.
const COMMIT_GRACE_SECONDS = 2;

// Whether minutes is a commitment the user may make.
function isValidCommitment(minutes) {
  return Number.isInteger(minutes) && minutes >= MIN_COMMIT_MINUTES && minutes <= MAX_COMMIT_MINUTES;
}

// What a session that ran for seconds, against a commitment of
// commitMinutes, adds to the account. Every session adds the minutes it ran
// to minutes studied, but only one that lasted its full commitment earns
// points, and then for exactly the time committed to.
// Returns { completed, minutes, pointsEarned }.
function sessionEarnings(seconds, commitMinutes) {
  const committed = isValidCommitment(commitMinutes) ? commitMinutes * 60 : 0;
  const completed = committed > 0 && seconds >= committed - COMMIT_GRACE_SECONDS;
  const counted = completed ? committed : Math.max(0, Math.floor(seconds));

  // In test mode every second earns a point, and a part minute still counts.
  const minutes = TEST_POINT_PER_SECOND ? Math.ceil(counted / 60) : Math.floor(counted / 60);
  if (!completed) return { completed, minutes, pointsEarned: 0 };
  const pointsEarned = TEST_POINT_PER_SECOND ? counted : minutes * POINTS_PER_MINUTE;
  return { completed, minutes, pointsEarned };
}

// Sends a request for the profiles row with the given uid and returns that
// row, limited to the given columns. Returns null if no row matched, throwing
// Supabase's error message if the request fails.
async function requestProfile(uid, columns, options = {}) {
  if (typeof uid !== 'string' || !uid) throw new Error('A uid is required');

  // Acts as the logged-in user when there is one, otherwise anonymously.
  const token = (await getAccessToken()) ?? NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const query = new URLSearchParams({ uid: `eq.${uid}`, select: columns });
  const res = await fetch(`${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/profiles?${query}`, {
    ...options,
    headers: {
      apikey: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.message || `Supabase request failed (${res.status})`);
  }
  return data?.[0] ?? null;
}

// Returns the user's full profile row (uid, username, email, created_at,
// points, minutes_studied), or null if no profile exists for that uid.
function getProfile(uid) {
  return requestProfile(uid, '*');
}

// Returns the user's points as a number, or null if no profile exists for
// that uid.
async function getPoints(uid) {
  const profile = await requestProfile(uid, 'points');
  return profile ? profile.points : null;
}

// Sets one numeric column on the user's profile and returns the saved value.
// Throws if no profile was updated, which is what happens when the logged-in
// user isn't allowed to change that profile.
async function setProfileNumber(uid, column, value) {
  if (!Number.isFinite(value)) throw new Error(`${column} must be a number`);

  const profile = await requestProfile(uid, column, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({ [column]: value }),
  });
  if (!profile) throw new Error('No profile was updated');
  return profile[column];
}

// Sets the user's points to the given number and returns the saved value.
function setPoints(uid, points) {
  return setProfileNumber(uid, 'points', points);
}

// Sets the user's total minutes studied and returns the saved value.
function setMinutesStudied(uid, minutes) {
  return setProfileNumber(uid, 'minutes_studied', minutes);
}

// Saves minutes studied and points in one request.
async function setStudyTotals(uid, minutesStudied, points) {
  if (!Number.isFinite(minutesStudied)) throw new Error('minutes_studied must be a number');
  if (!Number.isFinite(points)) throw new Error('points must be a number');
  const profile = await requestProfile(uid, 'minutes_studied,points', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({ minutes_studied: minutesStudied, points }),
  });
  if (!profile) throw new Error('No profile was updated');
  return profile;
}

module.exports = {
  TEST_POINT_PER_SECOND,
  POINTS_PER_MINUTE,
  MIN_COMMIT_MINUTES,
  MAX_COMMIT_MINUTES,
  isValidCommitment,
  sessionEarnings,
  getProfile,
  getPoints,
  setPoints,
  setMinutesStudied,
  setStudyTotals,
};
