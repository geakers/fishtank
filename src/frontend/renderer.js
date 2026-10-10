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
const classesButton = document.getElementById('classes-button');
const classesPanel = document.getElementById('classes');

// The logged-in user ({ uid, email, username }), or null.
let currentUser = null;

// Shows the "logged in" line plus the log out and classes buttons for a user,
// or the forms when user is null.
function showSession(user) {
  currentUser = user;
  sessionStatus.textContent = user ? `Logged in as ${user.username || user.email}` : '';
  sessionStatus.hidden = !user;
  logout.hidden = !user;
  classesButton.hidden = !user;
  if (!user) classesPanel.hidden = true;
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

const classForm = document.getElementById('class-form');
const classStatus = document.getElementById('class-status');
const classSubmit = classForm.querySelector('button[type="submit"]');
const studentForm = document.getElementById('student-form');
const classPicker = studentForm.classId;
const roster = document.getElementById('roster');
const addStudentSection = document.getElementById('add-student');
const searchResults = document.getElementById('search-results');
const studentStatus = document.getElementById('student-status');

// The classes the user teaches or is in, as [{ id, class_name, teacher_id }].
let myClasses = [];
let searchTimer;

classesButton.addEventListener('click', () => {
  classesPanel.hidden = !classesPanel.hidden;
  if (!classesPanel.hidden) loadClasses();
});

// Fills the class picker with the user's classes, choosing selectId if given
// (otherwise keeping the current choice), and shows the chosen class.
async function loadClasses(selectId = classPicker.value) {
  try {
    myClasses = await window.fishtank.listClasses();
  } catch (err) {
    classStatus.textContent = errorMessage(err);
    return;
  }
  classPicker.replaceChildren(...myClasses.map((c) => new Option(c.class_name, c.id)));
  classPicker.value = String(selectId);
  if (!classPicker.value && myClasses.length) classPicker.selectedIndex = 0;
  showClass();
}

// Shows the chosen class's roster, plus the student search if the user is its
// teacher. Hides the class card when the user has no classes.
function showClass() {
  const chosen = myClasses.find((c) => String(c.id) === classPicker.value);
  studentForm.hidden = !chosen;
  if (!chosen) return;

  addStudentSection.hidden = chosen.teacher_id !== currentUser?.uid;
  studentForm.search.value = '';
  searchResults.replaceChildren();
  studentStatus.textContent = '';
  loadRoster();
}

// Lists everyone in the chosen class, marking the teacher.
async function loadRoster() {
  const classId = classPicker.value;
  try {
    const people = await window.fishtank.classRoster(Number(classId));
    // Another class was picked while this one loaded.
    if (classPicker.value !== classId) return;
    roster.replaceChildren(...people.map(({ username, role }) => {
      const item = document.createElement('li');
      item.textContent = role === 'teacher' ? `${username} (teacher)` : username;
      return item;
    }));
  } catch (err) {
    studentStatus.textContent = errorMessage(err);
  }
}

classPicker.addEventListener('change', showClass);

classForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  classSubmit.disabled = true;
  classStatus.textContent = 'Creating class...';
  try {
    // classForm.className would be the form's CSS class, so go through elements.
    const created = await window.fishtank.createClass(classForm.elements.className.value);
    classForm.reset();
    classStatus.textContent = `Created ${created.class_name}`;
    await loadClasses(created.id);
  } catch (err) {
    classStatus.textContent = errorMessage(err);
  } finally {
    classSubmit.disabled = false;
  }
});

// Searches once typing pauses, so every keystroke doesn't hit Supabase.
studentForm.search.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(searchStudents, 250);
});

// Lists usernames matching the search box, each as a button that adds that
// user to the chosen class. Leaves out the teacher (the user), who can't be a
// student in their own class.
async function searchStudents() {
  const query = studentForm.search.value.trim();
  studentStatus.textContent = '';
  if (!query) {
    searchResults.replaceChildren();
    return;
  }
  try {
    const usernames = (await window.fishtank.searchUsernames(query))
      .filter((username) => username !== currentUser?.username);
    // The search box changed while this search ran; a newer one is coming.
    if (studentForm.search.value.trim() !== query) return;
    searchResults.replaceChildren(...usernames.map((username) => {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = username;
      button.addEventListener('click', () => addToClass(username));
      item.append(button);
      return item;
    }));
    if (!usernames.length) studentStatus.textContent = 'No matching usernames';
  } catch (err) {
    studentStatus.textContent = errorMessage(err);
  }
}

// Pressing Enter in the search box adds that exact username.
studentForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const username = studentForm.search.value.trim();
  if (username) addToClass(username);
});

async function addToClass(username) {
  clearTimeout(searchTimer);
  studentStatus.textContent = `Adding ${username}...`;
  try {
    await window.fishtank.addStudent(Number(classPicker.value), username);
    studentForm.search.value = '';
    searchResults.replaceChildren();
    studentStatus.textContent = `Added ${username}`;
    await loadRoster();
  } catch (err) {
    studentStatus.textContent = errorMessage(err);
  }
}
