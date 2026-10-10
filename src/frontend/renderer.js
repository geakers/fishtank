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
