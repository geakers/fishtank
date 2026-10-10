const toggle = document.getElementById('toggle');

let locked = false;

toggle.addEventListener('click', async () => {
  toggle.disabled = true;
  try {
    // The main process reports the real kiosk state, so the label can't drift.
    locked = await window.fishtank.lockDown(!locked);
    toggle.textContent = locked ? 'Stop' : 'Start';
  } finally {
    toggle.disabled = false;
  }
});

// Electron prefixes IPC errors with "Error invoking remote method ...".
function errorMessage(err) {
  return err.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
}

const form = document.getElementById('profile-form');
const profileStatus = document.getElementById('profile-status');
const submit = form.querySelector('button[type="submit"]');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  submit.disabled = true;
  profileStatus.textContent = 'Creating account...';
  try {
    const { needsConfirmation } = await window.fishtank.createAccount({
      username: form.username.value,
      email: form.email.value,
      password: form.password.value,
    });
    profileStatus.textContent = needsConfirmation
      ? 'Account created. Check your email to confirm it.'
      : 'Account created';
    form.reset();
  } catch (err) {
    profileStatus.textContent = errorMessage(err);
  } finally {
    submit.disabled = false;
  }
});

const forms = document.getElementById('forms');
const sessionStatus = document.getElementById('session-status');
const loginForm = document.getElementById('login-form');
const loginStatus = document.getElementById('login-status');
const loginSubmit = loginForm.querySelector('button[type="submit"]');
const logout = document.getElementById('logout');
const groupsButton = document.getElementById('groups-button');
const groupsPanel = document.getElementById('groups');

// The logged-in user ({ uid, email, username }), or null.
let currentUser = null;

// Shows the "logged in" line plus the log out and study session buttons for a
// user, or the forms when user is null.
function showSession(user) {
  currentUser = user;
  sessionStatus.textContent = user ? `Logged in as ${user.username || user.email}` : '';
  sessionStatus.hidden = !user;
  logout.hidden = !user;
  groupsButton.hidden = !user;
  if (!user) groupsPanel.hidden = true;
  forms.hidden = Boolean(user);
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginSubmit.disabled = true;
  loginStatus.textContent = 'Logging in...';
  try {
    showSession(await window.fishtank.logIn({
      email: loginForm.email.value,
      password: loginForm.password.value,
    }));
    loginForm.reset();
    loginStatus.textContent = '';
  } catch (err) {
    loginStatus.textContent = errorMessage(err);
  } finally {
    loginSubmit.disabled = false;
  }
});

// Picks up a session saved by a previous run.
window.fishtank.getCurrentUser().then(showSession);

logout.addEventListener('click', async () => {
  logout.disabled = true;
  try {
    await window.fishtank.logOut();
    showSession(null);
  } finally {
    logout.disabled = false;
  }
});

const groupForm = document.getElementById('group-form');
const groupStatus = document.getElementById('group-status');
const groupSubmit = groupForm.querySelector('button[type="submit"]');
const memberForm = document.getElementById('member-form');
const groupPicker = memberForm.groupId;
const roster = document.getElementById('roster');
const addMemberSection = document.getElementById('add-member');
const searchResults = document.getElementById('search-results');
const memberStatus = document.getElementById('member-status');

// The groups the user leads or is in, as [{ id, name, leader_id }].
let myGroups = [];
let searchTimer;

groupsButton.addEventListener('click', () => {
  groupsPanel.hidden = !groupsPanel.hidden;
  if (!groupsPanel.hidden) loadGroups();
});

// Fills the group picker with the user's groups, choosing selectId if given
// (otherwise keeping the current choice), and shows the chosen group.
async function loadGroups(selectId = groupPicker.value) {
  try {
    myGroups = await window.fishtank.listGroups();
  } catch (err) {
    groupStatus.textContent = errorMessage(err);
    return;
  }
  groupPicker.replaceChildren(...myGroups.map((g) => new Option(g.name, g.id)));
  groupPicker.value = String(selectId);
  if (!groupPicker.value && myGroups.length) groupPicker.selectedIndex = 0;
  showGroup();
}

// Shows the chosen group's roster, plus the member search if the user is its
// leader. Hides the group card when the user has no groups.
function showGroup() {
  const chosen = myGroups.find((g) => String(g.id) === groupPicker.value);
  memberForm.hidden = !chosen;
  if (!chosen) return;

  addMemberSection.hidden = chosen.leader_id !== currentUser?.uid;
  memberForm.search.value = '';
  searchResults.replaceChildren();
  memberStatus.textContent = '';
  loadRoster();
}

// Lists everyone in the chosen group, marking the leader.
async function loadRoster() {
  const groupId = groupPicker.value;
  try {
    const people = await window.fishtank.groupRoster(Number(groupId));
    // Another group was picked while this one loaded.
    if (groupPicker.value !== groupId) return;
    roster.replaceChildren(...people.map(({ username, role }) => {
      const item = document.createElement('li');
      item.textContent = role === 'leader' ? `${username} (group leader)` : username;
      return item;
    }));
  } catch (err) {
    memberStatus.textContent = errorMessage(err);
  }
}

groupPicker.addEventListener('change', showGroup);

groupForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  groupSubmit.disabled = true;
  groupStatus.textContent = 'Creating study session...';
  try {
    const created = await window.fishtank.createGroup(groupForm.groupName.value);
    groupForm.reset();
    groupStatus.textContent = `Created ${created.name}`;
    await loadGroups(created.id);
  } catch (err) {
    groupStatus.textContent = errorMessage(err);
  } finally {
    groupSubmit.disabled = false;
  }
});

// Searches once typing pauses, so every keystroke doesn't hit Supabase.
memberForm.search.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(searchMembers, 250);
});

// Lists usernames matching the search box, each as a button that adds that
// user to the chosen group. Leaves out the leader (the user), who can't be a
// member of their own group.
async function searchMembers() {
  const query = memberForm.search.value.trim();
  memberStatus.textContent = '';
  if (!query) {
    searchResults.replaceChildren();
    return;
  }
  try {
    const usernames = (await window.fishtank.searchUsernames(query))
      .filter((username) => username !== currentUser?.username);
    // The search box changed while this search ran; a newer one is coming.
    if (memberForm.search.value.trim() !== query) return;
    searchResults.replaceChildren(...usernames.map((username) => {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = username;
      button.addEventListener('click', () => addToGroup(username));
      item.append(button);
      return item;
    }));
    if (!usernames.length) memberStatus.textContent = 'No matching usernames';
  } catch (err) {
    memberStatus.textContent = errorMessage(err);
  }
}

// Pressing Enter in the search box adds that exact username.
memberForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const username = memberForm.search.value.trim();
  if (username) addToGroup(username);
});

async function addToGroup(username) {
  clearTimeout(searchTimer);
  memberStatus.textContent = `Adding ${username}...`;
  try {
    await window.fishtank.addMember(Number(groupPicker.value), username);
    memberForm.search.value = '';
    searchResults.replaceChildren();
    memberStatus.textContent = `Added ${username}`;
    await loadRoster();
  } catch (err) {
    memberStatus.textContent = errorMessage(err);
  }
}
