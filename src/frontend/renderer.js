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

// Shows the "logged in" line and log out button for a user, or the forms when
// user is null.
function showSession(user) {
  sessionStatus.textContent = user ? `Logged in as ${user.username || user.email}` : '';
  sessionStatus.hidden = !user;
  logout.hidden = !user;
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
