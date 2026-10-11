const { test, mock } = require('node:test');
const assert = require('node:assert/strict');
const session = require('../src/desktop/session');

// The logged-in user's access token, or null to act as if nobody is logged in.
let token = 'dud-access-token';

// groups.js picks up getAccessToken when it loads, so swap it out first.
mock.method(session, 'getAccessToken', async () => token);
const {
  createGroup, listGroups, deleteGroup, leaveGroup, addMember, groupRoster, searchUsernames,
  inviteMember, listInvites, acceptInvite, declineInvite, groupInvites,
} = require('../src/desktop/groups');

const GROUP = { id: 1, name: 'Biology revision', leader_id: '00000000-0000-4000-8000-000000000001' };

// Stands in for Supabase so the test never touches the real database. Each
// path maps to the response it returns. Returns the requests that were made.
function mockSupabase(responses) {
  const requests = [];

  mock.method(globalThis, 'fetch', async (url, options) => {
    const { pathname, search } = new URL(url);
    requests.push({
      pathname,
      search: decodeURIComponent(search),
      method: options.method,
      headers: options.headers,
      body: options.body === undefined ? undefined : JSON.parse(options.body),
    });

    const respond = responses[pathname];
    if (respond) return respond();
    return Response.json({ message: `Unexpected request to ${pathname}` }, { status: 404 });
  });

  return requests;
}

function reset(t) {
  token = 'dud-access-token';
  t.after(() => mock.restoreAll());
}

test('createGroup creates a group as the logged-in user', async (t) => {
  reset(t);
  const requests = mockSupabase({ '/rest/v1/study_groups': () => Response.json([GROUP], { status: 201 }) });

  assert.deepEqual(await createGroup('  Biology revision  '), GROUP);

  const [request] = requests;
  assert.equal(request.method, 'POST');
  assert.equal(request.search, '?select=id,name,leader_id');
  assert.deepEqual(request.body, { name: 'Biology revision' });
  assert.equal(request.headers.Authorization, 'Bearer dud-access-token');
  assert.equal(request.headers.Prefer, 'return=representation');
});

test('createGroup refuses a blank name without asking Supabase', async (t) => {
  reset(t);
  const requests = mockSupabase({});

  await assert.rejects(createGroup('   '), /A study session name is required/);
  assert.equal(requests.length, 0);
});

test('listGroups lists the groups sorted by name', async (t) => {
  reset(t);
  const requests = mockSupabase({ '/rest/v1/study_groups': () => Response.json([GROUP]) });

  assert.deepEqual(await listGroups(), [GROUP]);
  assert.equal(requests[0].method, 'GET');
  assert.equal(requests[0].search, '?select=id,name,leader_id&order=name');
});

test('deleteGroup deletes the group by id', async (t) => {
  reset(t);
  const requests = mockSupabase({ '/rest/v1/study_groups': () => Response.json([{ id: 1 }]) });

  await deleteGroup(1);

  assert.equal(requests[0].method, 'DELETE');
  assert.equal(requests[0].search, '?id=eq.1&select=id');
  assert.equal(requests[0].headers.Prefer, 'return=representation');
});

test('deleteGroup says so when the group was not deleted', async (t) => {
  reset(t);
  // What Supabase returns when row level security hides the group.
  mockSupabase({ '/rest/v1/study_groups': () => Response.json([]) });

  await assert.rejects(deleteGroup(1), /Only the group leader can delete a study group/);
});

test('leaveGroup calls leave_group with the group', async (t) => {
  reset(t);
  const requests = mockSupabase({ '/rest/v1/rpc/leave_group': () => new Response(null, { status: 204 }) });

  await leaveGroup(1);

  assert.equal(requests[0].method, 'POST');
  assert.deepEqual(requests[0].body, { gid: 1 });
});

test("leaveGroup passes on Supabase's reason for refusing", async (t) => {
  reset(t);
  mockSupabase({
    '/rest/v1/rpc/leave_group': () =>
      Response.json({ code: 'P0001', message: "you lead this group, so you can't leave it" }, { status: 400 }),
  });

  await assert.rejects(leaveGroup(1), { message: "you lead this group, so you can't leave it" });
});

test("leaveGroup says so when the leave SQL hasn't been run", async (t) => {
  reset(t);
  mockSupabase({
    '/rest/v1/rpc/leave_group': () =>
      Response.json({ code: 'PGRST202', message: 'Could not find the function public.leave_group' }, { status: 404 }),
  });

  await assert.rejects(leaveGroup(1), /Leaving groups isn't set up in the database yet/);
});

test('deleteGroup refuses anything but a group id without asking Supabase', async (t) => {
  reset(t);
  const requests = mockSupabase({});

  await assert.rejects(deleteGroup('1 or true'), /A study group is required/);
  assert.equal(requests.length, 0);
});

test('addMember calls add_member with the group and username', async (t) => {
  reset(t);
  // add_member returns void, which Supabase sends as an empty response.
  const requests = mockSupabase({ '/rest/v1/rpc/add_member': () => new Response(null, { status: 204 }) });

  await addMember(1, 'dud-member');

  assert.equal(requests[0].method, 'POST');
  assert.deepEqual(requests[0].body, { gid: 1, member_username: 'dud-member' });
});

test("addMember passes on Supabase's reason for refusing", async (t) => {
  reset(t);
  mockSupabase({
    '/rest/v1/rpc/add_member': () =>
      Response.json({ code: 'P0001', message: 'only the group leader can add members' }, { status: 400 }),
  });

  await assert.rejects(addMember(1, 'dud-member'), { message: 'only the group leader can add members' });
});

test('groupRoster returns everyone in the group with their role', async (t) => {
  reset(t);
  const roster = [
    { username: 'dud-leader', role: 'leader' },
    { username: 'dud-member', role: 'member' },
  ];
  const requests = mockSupabase({ '/rest/v1/rpc/group_roster': () => Response.json(roster) });

  assert.deepEqual(await groupRoster(1), roster);
  assert.deepEqual(requests[0].body, { gid: 1 });
});

test('searchUsernames returns just the usernames', async (t) => {
  reset(t);
  const requests = mockSupabase({
    '/rest/v1/rpc/search_usernames': () => Response.json([{ username: 'dud-member' }, { username: 'dud-member-2' }]),
  });

  assert.deepEqual(await searchUsernames('dud'), ['dud-member', 'dud-member-2']);
  assert.deepEqual(requests[0].body, { query: 'dud' });
});

test('inviteMember calls invite_member with the group and username', async (t) => {
  reset(t);
  const requests = mockSupabase({ '/rest/v1/rpc/invite_member': () => new Response(null, { status: 204 }) });

  await inviteMember(1, 'dud-member');

  assert.equal(requests[0].method, 'POST');
  assert.deepEqual(requests[0].body, { gid: 1, member_username: 'dud-member' });
});

test('listInvites returns the invites waiting for the logged-in user', async (t) => {
  reset(t);
  const invites = [{ group_id: 1, group_name: 'Biology revision', leader: 'dud-leader' }];
  const requests = mockSupabase({ '/rest/v1/rpc/my_invites': () => Response.json(invites) });

  assert.deepEqual(await listInvites(), invites);
  assert.deepEqual(requests[0].body, {});
});

test('acceptInvite and declineInvite answer the invite to that group', async (t) => {
  reset(t);
  const requests = mockSupabase({
    '/rest/v1/rpc/accept_invite': () => new Response(null, { status: 204 }),
    '/rest/v1/rpc/decline_invite': () => new Response(null, { status: 204 }),
  });

  await acceptInvite(1);
  await declineInvite(2);

  assert.deepEqual(requests.map((r) => [r.pathname, r.body]), [
    ['/rest/v1/rpc/accept_invite', { gid: 1 }],
    ['/rest/v1/rpc/decline_invite', { gid: 2 }],
  ]);
});

test('groupInvites returns just the usernames', async (t) => {
  reset(t);
  const requests = mockSupabase({ '/rest/v1/rpc/group_invites': () => Response.json([{ username: 'dud-invitee' }]) });

  assert.deepEqual(await groupInvites(1), ['dud-invitee']);
  assert.deepEqual(requests[0].body, { gid: 1 });
});

test("invite calls say so when the invites SQL hasn't been run", async (t) => {
  reset(t);
  mockSupabase({
    '/rest/v1/rpc/my_invites': () =>
      Response.json({ code: 'PGRST202', message: 'Could not find the function public.my_invites' }, { status: 404 }),
  });

  await assert.rejects(listInvites(), /Invites aren't set up in the database yet/);
});

test('every group call needs someone logged in', async (t) => {
  reset(t);
  token = null;
  const requests = mockSupabase({});

  await assert.rejects(listGroups(), /Log in first/);
  await assert.rejects(addMember(1, 'dud-member'), /Log in first/);
  assert.equal(requests.length, 0);
});
