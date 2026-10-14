import { useEffect, useState } from 'react';
import { AeroButton } from './AeroButton';
import { GlassPanel } from './GlassPanel';

// The shortcuts study mode runs. Keep in sync with FOCUS_SHORTCUTS in
// src/desktop/study-mode.js.
const FOCUS_ON = 'Fishtank Focus On';
const FOCUS_OFF = 'Fishtank Focus Off';

export interface StudyAppsProps {
  onClose: () => void;
}

// Modal for choosing the apps that may be used in study mode. Lists the apps
// that are open right now along with the ones already chosen; ticking one
// saves straight away.
export function StudyApps({ onClose }: StudyAppsProps) {
  const bridge = window.fishtank;
  // null until loaded.
  const [allowed, setAllowed] = useState<FishtankStudyApp[] | null>(null);
  const [running, setRunning] = useState<FishtankStudyApp[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bridge) return;
    let stale = false;
    Promise.all([bridge.getAllowedApps(), bridge.listRunningApps()]).then(
      ([nextAllowed, nextRunning]) => {
        if (stale) return;
        setAllowed(nextAllowed);
        setRunning(nextRunning);
      },
      () => !stale && setError("Couldn't load your apps."),
    );
    return () => {
      stale = true;
    };
  }, [bridge]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const toggle = async (app: FishtankStudyApp, allow: boolean) => {
    if (!bridge || !allowed) return;
    const next = allow ? [...allowed, app] : allowed.filter((a) => a.id !== app.id);
    try {
      setAllowed(await bridge.setAllowedApps(next));
      setError(null);
    } catch {
      setError("Couldn't save your study apps.");
    }
  };

  // Chosen apps stay listed even when they aren't open.
  const apps = [...(allowed ?? []), ...running.filter((r) => !allowed?.some((a) => a.id === r.id))].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  return (
    <div className="modal-backdrop modal-backdrop--front" onPointerDown={(event) => event.target === event.currentTarget && onClose()}>
      <GlassPanel variant="raised" className="modal study-apps" role="dialog" aria-labelledby="study-apps-title">
        <div className="modal__header">
          <h2 id="study-apps-title" className="panel-title">
            Whitelist
          </h2>
        </div>

        {!bridge ? <p className="muted">The whitelist needs the desktop app.</p> : null}
        {bridge ? (
          <p className="muted">
            Tick the apps you study with. While the whitelist is on, switching to any other app during Focus brings Fishtank back to the front.
          </p>
        ) : null}
        {bridge && allowed !== null && apps.length === 0 ? <p className="muted">Open an app to see it here.</p> : null}
        <ul className="study-apps__list">
          {apps.map((app) => (
            <li key={app.id}>
              <label className="study-apps__app">
                <input
                  type="checkbox"
                  checked={allowed?.some((a) => a.id === app.id) ?? false}
                  onChange={(e) => void toggle(app, e.target.checked)}
                />
                <span className="study-apps__name">{app.name}</span>
                {running.some((r) => r.id === app.id) ? null : <span className="muted">Not open</span>}
              </label>
            </li>
          ))}
        </ul>
        {error ? <p className="error-text">{error}</p> : null}

        {bridge?.platform === 'darwin' ? (
          <p className="study-apps__section muted">
            To silence notifications too, make two shortcuts in the Shortcuts app that turn a Focus on and off, named “{FOCUS_ON}” and
            “{FOCUS_OFF}”. Fishtank runs them when a Focus session starts and ends.
          </p>
        ) : null}
        {bridge?.platform === 'win32' ? (
          <p className="study-apps__section muted">
            On Windows, a Focus session turns on Do Not Disturb and blocks the Windows key, Alt+Tab, three- and four-finger trackpad
            swipes, and the other shortcuts that switch apps. An app that isn’t ticked is sent back if it still gets in front. Do Not Disturb and those keys are restored when the
            session ends. Do Not Disturb is left on if it was already on.
          </p>
        ) : null}

        <div className="form-actions">
          <AeroButton onClick={onClose}>Done</AeroButton>
        </div>
      </GlassPanel>
    </div>
  );
}
