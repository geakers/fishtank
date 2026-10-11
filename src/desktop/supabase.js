const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY } = require('../db');
const { getAccessToken } = require('./session');

// Sends a request to Supabase as the logged-in user and returns the parsed
// response, throwing Supabase's error message if it fails. Row level security
// and the database functions decide what that user may see and change. body is
// sent as JSON, or as-is when it's file bytes (a Uint8Array).
async function request(path, { method = 'GET', body, headers } = {}) {
  const token = await getAccessToken();
  if (!token) throw new Error('Log in first');

  const bytes = body instanceof Uint8Array;
  const res = await fetch(`${NEXT_PUBLIC_SUPABASE_URL}${path}`, {
    method,
    headers: {
      apikey: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${token}`,
      ...(bytes ? {} : { 'Content-Type': 'application/json' }),
      ...headers,
    },
    body: body === undefined || bytes ? body : JSON.stringify(body),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.message || `Supabase request failed (${res.status})`);
  }
  return data;
}

// Calls one of the Postgres functions from the SQL in src/database.
function rpc(name, args) {
  return request(`/rest/v1/rpc/${name}`, { method: 'POST', body: args });
}

module.exports = { request, rpc };
