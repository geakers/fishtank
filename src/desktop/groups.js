const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY } = require('../db');
const { getAccessToken } = require('./session');

// Group study sessions. The code calls them groups, since "session" already
// means the login session.

// Sends a request to Supabase as the logged-in user and returns the parsed
// response, throwing Supabase's error message if it fails. Row level security
// and the group functions decide what that user may see and change.
async function request(path, { method = 'GET', body, headers } = {}) {
  const token = await getAccessToken();
  if (!token) throw new Error('Log in first');

  const res = await fetch(`${NEXT_PUBLIC_SUPABASE_URL}${path}`, {
    method,
    headers: {
      apikey: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const error = new Error(data?.message || `Supabase request failed (${res.status})`);
    error.code = data?.code;
    throw error;
  }
  return data;
}

// Calls one of the Postgres functions from the study groups SQL.
function rpc(name, args = {}) {
  return request(`/rest/v1/rpc/${name}`, { method: 'POST', body: args });
}

// Calls one of the functions from the invites SQL. Supabase answers PGRST202
// for a function it doesn't have, which means that SQL hasn't been run yet.
async function inviteRpc(name, args) {
  try {
    return await rpc(name, args);
  } catch (err) {
    if (err.code === 'PGRST202') throw new Error("Invites aren't set up in the database yet");
    throw err;
  }
}

// Creates a group led by the logged-in user and returns
// { id, name, leader_id }.
async function createGroup(name) {
  if (typeof name !== 'string' || !name.trim()) throw new Error('A study session name is required');

  const [created] = await request('/rest/v1/study_groups?select=id,name,leader_id', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: { name: name.trim() },
  });
  return created;
}

// Returns [{ id, name, leader_id }] for the groups the logged-in user leads or
// is a member of, sorted by name.
function listGroups() {
  return request('/rest/v1/study_groups?select=id,name,leader_id&order=name');
}

// Adds the user with this username to the group. Only the group's leader can.
async function addMember(groupId, username) {
  await rpc('add_member', { gid: groupId, member_username: username });
}

// Returns [{ username, role }] for everyone in the group, where role is
// 'leader' or 'member'.
function groupRoster(groupId) {
  return rpc('group_roster', { gid: groupId });
}

// Returns up to 10 usernames containing the search text.
async function searchUsernames(query) {
  const rows = await rpc('search_usernames', { query });
  return rows.map((row) => row.username);
}

// Invites the user with this username to the group. They join once they
// accept. Only the group's leader can.
async function inviteMember(groupId, username) {
  await inviteRpc('invite_member', { gid: groupId, member_username: username });
}

// Returns [{ group_id, group_name, leader }] for the invites waiting for the
// logged-in user, oldest first. leader is the leader's username.
function listInvites() {
  return inviteRpc('my_invites');
}

// Accepts the logged-in user's invite to the group, making them a member.
async function acceptInvite(groupId) {
  await inviteRpc('accept_invite', { gid: groupId });
}

// Turns down the logged-in user's invite to the group.
async function declineInvite(groupId) {
  await inviteRpc('decline_invite', { gid: groupId });
}

// Returns the usernames of the people invited to the group who haven't
// answered yet. Empty unless the logged-in user leads the group.
async function groupInvites(groupId) {
  const rows = await inviteRpc('group_invites', { gid: groupId });
  return rows.map((row) => row.username);
}

module.exports = {
  createGroup, listGroups, addMember, groupRoster, searchUsernames,
  inviteMember, listInvites, acceptInvite, declineInvite, groupInvites,
};
