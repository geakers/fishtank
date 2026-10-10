const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY } = require('../db');

// POSTs JSON to Supabase and returns the parsed response, throwing Supabase's
// error message if the request fails.
async function post(path, body) {
  const res = await fetch(`${NEXT_PUBLIC_SUPABASE_URL}${path}`, {
    method: 'POST',
    headers: {
      apikey: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = data?.msg || data?.error_description || data?.message;
    throw new Error(message || `Supabase request failed (${res.status})`);
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

module.exports = { createAccount };
