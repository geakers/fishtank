const NEXT_PUBLIC_SUPABASE_URL = "https://aakaelrvybduqijgermo.supabase.co"
const NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_A6CBnknUmf150g2eQ9ddew_oYSVlsEt"

// POSTs JSON to Supabase and returns the parsed response, throwing Supabase's
// error message if the request fails.
async function post(path, body, { token = NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, headers = {} } = {}) {
  const res = await fetch(`${NEXT_PUBLIC_SUPABASE_URL}${path}`, {
    method: 'POST',
    headers: {
      apikey: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...headers,
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

// Creates a Supabase Auth account (which stores the password securely), then
// adds the matching profiles row. uid and created_at come from the new account.
async function createAccount({ username, email, password }) {
  const signup = await post('/auth/v1/signup', { email, password });

  // With email confirmation on, signup returns the user directly and no session;
  // with it off, it returns a session holding the user.
  const user = signup.user ?? signup;
  const token = signup.access_token;

  await post(
    '/rest/v1/profiles',
    { uid: user.id, username, email, created_at: user.created_at },
    { token, headers: { Prefer: 'return=minimal' } },
  );

  return { needsConfirmation: !token };
}

module.exports = { createAccount };
