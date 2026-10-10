const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY } = require('../db');

// POSTs JSON to Supabase and returns the parsed response, throwing Supabase's
// error message if the request fails.
async function post(path, body, token = NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
  const res = await fetch(`${NEXT_PUBLIC_SUPABASE_URL}${path}`, {
    method: 'POST',
    headers: {
      apikey: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = data?.msg || data?.error_description || data?.message;
    const error = new Error(message || `Supabase request failed (${res.status})`);
    error.status = res.status;
    throw error;
  }
  return data;
}

// Creates a Supabase Auth account (which stores the password securely). The
// on_auth_user_created trigger in Supabase then adds the matching profiles row,
// reading username from the user metadata sent here.
async function createAccount({ username, email, password }) {
  const signup = await post('/auth/v1/signup', { email, password, data: { username } });

  // With email confirmation on, signup returns no session.
  return { needsConfirmation: !signup.access_token };
}

// Exchanges an email and password for a Supabase session (access token, refresh
// token and user). Throws if the credentials are wrong or the email has not
// been confirmed yet.
function logIn({ email, password }) {
  return post('/auth/v1/token?grant_type=password', { email, password });
}

// Trades a refresh token for a fresh session. Each refresh token works once.
function refreshSession(refreshToken) {
  return post('/auth/v1/token?grant_type=refresh_token', { refresh_token: refreshToken });
}

// Ends the session the access token belongs to, so its refresh token stops
// working. Sessions on the user's other devices are left alone.
function logOut(accessToken) {
  return post('/auth/v1/logout?scope=local', {}, accessToken);
}

module.exports = { createAccount, logIn, refreshSession, logOut };
