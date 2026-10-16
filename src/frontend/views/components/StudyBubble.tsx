import { useEffect, useLayoutEffect, useState } from 'react';

// The screen-edge control shown during Focus. It lists the saved study apps
// and brings the one you pick to the front, at that app's own window size.
export function StudyBubble() {
  const bridge = window.fishtank;
  const [open, setOpen] = useState(false);
  const [apps, setApps] = useState<FishtankStudyApp[]>([]);
  const [note, setNote] = useState<string | null>(null);

  document.body.classList.add('is-study-bubble');

  useEffect(() => {
    document.body.classList.add('is-study-bubble');
    return () => document.body.classList.remove('is-study-bubble');
  }, []);

  useEffect(() => {
    if (!open || !bridge) return;
    let stale = false;
    void bridge.getAllowedApps().then(
      (next) => {
        if (!stale) setApps(next);
      },
      () => {
        if (!stale) setNote("Couldn't load your study apps.");
      },
    );
    return () => {
      stale = true;
    };
  }, [open, bridge]);

  useLayoutEffect(() => {
    const panel = document.querySelector('.study-bubble__panel');
    const dot = document.querySelector('.study-bubble__dot');
    const height = (panel?.offsetHeight ?? 0) + (panel ? 8 : 0) + (dot?.offsetHeight ?? 64);
    bridge?.setBubbleOpen(open, height);
  }, [open, apps, note, bridge]);

  const openApp = async (app: FishtankStudyApp) => {
    setNote(null);
    const ok = await bridge?.focusStudyApp(app.id);
    if (!ok) setNote(`Couldn't switch to ${app.name}.`);
    else setOpen(false);
  };

  return (
    <div className="study-bubble">
      <div className="study-bubble__hit">
        {open ? (
          <div className="study-bubble__panel" role="menu" aria-label="Study apps">
            <p className="study-bubble__title">Study apps</p>
            {apps.map((app) => (
              <button key={app.id} type="button" className="study-bubble__app" onClick={() => void openApp(app)}>
                {app.name}
              </button>
            ))}
            {apps.length === 0 ? <p className="study-bubble__empty">No study apps yet.</p> : null}
            {note ? <p className="study-bubble__empty">{note}</p> : null}
          </div>
        ) : null}
        <button
          type="button"
          className={`study-bubble__dot${open ? ' is-open' : ''}`}
          aria-label="Study apps"
          aria-expanded={open}
          onClick={() => {
            setNote(null);
            setOpen((value) => !value);
          }}
        >
          <span className="study-bubble__shine" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
