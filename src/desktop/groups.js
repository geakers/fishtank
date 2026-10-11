const { request, rpc } = require('./supabase');
const { currentUser } = require('./session');
const { deleteGroupNotes } = require('./notes');

// Group study sessions. The code calls them groups, since "session" already
// means the login session.

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

// Deletes the group along with its notes and their files, its members and its
// invites. Only the group's leader can. The notes go first (the database would
// otherwise turn them into their authors' personal notes); if any can't be
// deleted, the group is kept so it can be tried again.
async function deleteGroup(groupId) {
  if (!Number.isInteger(groupId)) throw new Error('A study group is required');

  // Checked before anything is deleted, so nobody else starts removing notes.
  const [group] = await request(`/rest/v1/study_groups?id=eq.${groupId}&select=leader_id`);
  const user = currentUser();
  if (!group || !user || group.leader_id !== user.uid) throw new Error('Only the group leader can delete a study group');

  await deleteGroupNotes(groupId);

  // Row level security hides the group from anyone else's delete, so nothing
  // coming back means nothing was deleted.
  const deleted = await request(`/rest/v1/study_groups?id=eq.${groupId}&select=id`, {
    method: 'DELETE',
    headers: { Prefer: 'return=representation' },
  });
  if (!deleted?.length) throw new Error('Only the group leader can delete a study group');
}

// Takes the logged-in user out of a group they're a member of. Supabase
// answers PGRST202 for a function it doesn't have, which means the leave SQL
// hasn't been run yet.
async function leaveGroup(groupId) {
  try {
    await rpc('leave_group', { gid: groupId });
  } catch (err) {
    if (err.code === 'PGRST202') throw new Error("Leaving groups isn't set up in the database yet");
    throw err;
  }
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
  createGroup, listGroups, deleteGroup, leaveGroup, addMember, groupRoster, searchUsernames,
  inviteMember, listInvites, acceptInvite, declineInvite, groupInvites,
};
