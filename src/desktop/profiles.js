const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY } = require('../db');
const { getAccessToken } = require('./session');

// Fetches the profiles row for the given uid, limited to the given columns.
// Returns null if there is no such profile, throwing Supabase's error message
// if the request fails.
async function fetchProfile(uid, columns) {
  if (typeof uid !== 'string' || !uid) throw new Error('A uid is required');

  // Reads as the logged-in user when there is one, otherwise anonymously.
  const token = (await getAccessToken()) ?? NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const query = new URLSearchParams({ uid: `eq.${uid}`, select: columns, limit: '1' });
  const res = await fetch(`${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/profiles?${query}`, {
    headers: {
      apikey: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.message || `Supabase request failed (${res.status})`);
  }
  return data?.[0] ?? null;
}

// Returns the user's full profile row (uid, username, email, created_at,
// points), or null if no profile exists for that uid.
function getProfile(uid) {
  return fetchProfile(uid, '*');
}

// Returns the user's points as a number, or null if no profile exists for
// that uid.
async function getPoints(uid) {
  const profile = await fetchProfile(uid, 'points');
  return profile ? profile.points : null;
}

module.exports = { getProfile, getPoints };
