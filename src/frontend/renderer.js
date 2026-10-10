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
    // Electron prefixes IPC errors with "Error invoking remote method ...".
    profileStatus.textContent = err.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
  } finally {
    submit.disabled = false;
  }
});
