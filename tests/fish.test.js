const { test, mock } = require('node:test');
const assert = require('node:assert/strict');
const session = require('../src/desktop/session');

const USER = { uid: '00000000-0000-4000-8000-000000000001', email: 'dud@example.com', username: 'dud-user' };

// The logged-in user, or null to act as if nobody is logged in.
let user = USER;

// fish.js picks these up when it loads, so swap them out first.
mock.method(session, 'getAccessToken', async () => (user ? 'dud-access-token' : null));
mock.method(session, 'currentUser', () => user);
const { listFish, buyFish, setFishInTank, setAvatarFish } = require('../src/desktop/fish');

// Stands in for Supabase so the test never touches the real database. Each
// "METHOD /path" maps to the response it returns; the requests made are
// returned in order.
function mockSupabase(responses) {
  const requests = [];
  mock.method(globalThis, 'fetch', async (url, options) => {
    const { pathname, search } = new URL(url);
    const key = `${options.method} ${pathname}`;
    requests.push({ key, search: decodeURIComponent(search), headers: options.headers, body: options.body && JSON.parse(options.body) });
    const respond = responses[key];
    if (respond) return respond();
    return Response.json({ message: `Unexpected request to ${key}` }, { status: 404 });
  });
  return requests;
}

function reset(t) {
  user = USER;
  // Only undo the fetch stand-in; the session swaps must stay.
  t.after(() => globalThis.fetch.mock?.restore());
}

test('listFish asks for the user\'s fish, oldest first', async (t) => {
  reset(t);
  const rows = [{ fish_id: 'goldfish', in_tank: true, adopted_at: '2026-10-10T00:00:00Z' }];
  const requests = mockSupabase({ 'GET /rest/v1/owned_fish': () => Response.json(rows) });

  assert.deepEqual(await listFish(), rows);
  assert.equal(requests[0].search, '?select=fish_id,in_tank,adopted_at&order=adopted_at');
  assert.equal(requests[0].headers.Authorization, 'Bearer dud-access-token');
});

test('buyFish pays with the saved points in one step and returns the new balance', async (t) => {
  reset(t);
  const requests = mockSupabase({ 'POST /rest/v1/rpc/buy_fish': () => Response.json(150) });

  assert.equal(await buyFish('neon-tetra', 50), 150);
  assert.deepEqual(requests[0].body, { fish: 'neon-tetra', price: 50 });
});

test("buyFish passes on Supabase's reason for refusing", async (t) => {
  reset(t);
  mockSupabase({
    'POST /rest/v1/rpc/buy_fish': () => Response.json({ code: 'P0001', message: 'not enough points' }, { status: 400 }),
  });

  await assert.rejects(buyFish('koi', 260), { message: 'not enough points' });
});

test('setFishInTank updates that fish, and fails when it isn\'t yours', async (t) => {
  reset(t);
  let rows = [{ fish_id: 'goldfish' }];
  const requests = mockSupabase({ 'PATCH /rest/v1/owned_fish': () => Response.json(rows) });

  await setFishInTank('goldfish', false);
  assert.equal(requests[0].search, '?fish_id=eq.goldfish&select=fish_id');
  assert.deepEqual(requests[0].body, { in_tank: false });

  rows = [];
  await assert.rejects(setFishInTank('koi', true), /You don't own that fish/);
});

test('setAvatarFish sets or clears the avatar on the user\'s profile', async (t) => {
  reset(t);
  const requests = mockSupabase({ 'PATCH /rest/v1/profiles': () => Response.json([{ avatar_fish_id: null }]) });

  await setAvatarFish('goldfish');
  await setAvatarFish(null);
  assert.equal(requests[0].search, `?uid=eq.${USER.uid}&select=avatar_fish_id`);
  assert.deepEqual(requests.map((r) => r.body), [{ avatar_fish_id: 'goldfish' }, { avatar_fish_id: null }]);
});

test('fish ids are checked before asking Supabase', async (t) => {
  reset(t);
  const requests = mockSupabase({});

  await assert.rejects(buyFish('Gold Fish', 50), /A fish id is required/);
  await assert.rejects(buyFish('goldfish&owner_id=neq.x', 50), /A fish id is required/);
  await assert.rejects(buyFish('goldfish', -5), /A price is required/);
  await assert.rejects(buyFish('goldfish', 2.5), /A price is required/);
  await assert.rejects(setFishInTank('goldfish', 'yes'), /inTank must be true or false/);
  await assert.rejects(setAvatarFish(''), /A fish id is required/);
  assert.equal(requests.length, 0);
});

test('fish need someone logged in', async (t) => {
  reset(t);
  user = null;
  const requests = mockSupabase({});

  await assert.rejects(listFish(), /Log in first/);
  await assert.rejects(buyFish('goldfish', 50), /Log in first/);
  await assert.rejects(setAvatarFish(null), /Log in first/);
  assert.equal(requests.length, 0);
});
