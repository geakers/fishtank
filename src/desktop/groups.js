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
    throw new Error(data?.message || `Supabase request failed (${res.status})`);
  }
  return data;
}

// Calls one of the Postgres functions from the study groups SQL.
function rpc(name, args) {
  return request(`/rest/v1/rpc/${name}`, { method: 'POST', body: args });
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

module.exports = { createGroup, listGroups, addMember, groupRoster, searchUsernames };
