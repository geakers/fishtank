const { test, mock } = require('node:test');
const assert = require('node:assert/strict');
const { createAccount } = require('../src/database/accounts');

const DUD_ACCOUNT = {
  username: 'dud-user',
  email: 'dud@example.com',
  password: 'dud-password',
};

// Stands in for Supabase so the test never creates a real account or sends a
// confirmation email. Returns the requests createAccount made.
function mockSupabase() {
  const requests = [];

  mock.method(globalThis, 'fetch', async (url, options) => {
    const { pathname } = new URL(url);
    requests.push({ pathname, body: JSON.parse(options.body) });

    if (pathname === '/auth/v1/signup') {
      // Shape Supabase returns when email confirmation is on: a user, no session.
      return Response.json({
        id: '00000000-0000-4000-8000-000000000000',
        email: DUD_ACCOUNT.email,
        created_at: '2026-01-01T00:00:00Z',
      });
    }
    if (pathname === '/rest/v1/profiles') {
      return new Response(null, { status: 201 });
    }
    return Response.json({ message: `Unexpected request to ${pathname}` }, { status: 404 });
  });

  return requests;
}

test('creates an account with a dud email and password', async (t) => {
  const requests = mockSupabase();
  t.after(() => mock.restoreAll());

  const result = await createAccount(DUD_ACCOUNT);

  assert.deepEqual(result, { needsConfirmation: true });

  const signup = requests.find((request) => request.pathname === '/auth/v1/signup');
  assert.ok(signup, 'expected a signup request');
  assert.equal(signup.body.email, DUD_ACCOUNT.email);
  assert.equal(signup.body.password, DUD_ACCOUNT.password);
});
