const { request, rpc } = require('./supabase');

// Group study sessions. The code calls them groups, since "session" already
// means the login session.

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
