import { useEffect, useState } from 'react';
import { COMMIT_PRESETS, MAX_COMMIT_MINUTES, MIN_COMMIT_MINUTES, type LockMode } from '../../useFishtank';
import { AeroButton } from './AeroButton';
import { GlassPanel } from './GlassPanel';

export interface CommitPickerProps {
  mode: LockMode;
  initialMinutes: number;
  whitelistOn: boolean;
  onWhitelistChange: (on: boolean) => void;
  onEditWhitelist: () => void;
  onStart: (minutes: number) => void;
  onClose: () => void;
}

// Asked before every focus session: how long the user commits to. The session
// runs for exactly that long, and only earns points if the user stays for all
// of it.
export function CommitPicker({ mode, initialMinutes, whitelistOn, onWhitelistChange, onEditWhitelist, onStart, onClose }: CommitPickerProps) {
  // Kept as typed so the box can be cleared while typing a new number.
  const [text, setText] = useState(String(initialMinutes));
  const minutes = Number(text);
  const valid = Number.isInteger(minutes) && minutes >= MIN_COMMIT_MINUTES && minutes <= MAX_COMMIT_MINUTES;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onPointerDown={(event) => event.target === event.currentTarget && onClose()}>
      <GlassPanel variant="raised" className="modal commit" role="dialog" aria-labelledby="commit-title">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (valid) onStart(minutes);
          }}
        >
          <div className="modal__header">
            <h2 id="commit-title" className="panel-title">
              {mode === 'strict' ? 'Strict lock-in' : 'Focus'}
            </h2>
          </div>
          <div className="commit__presets" role="group" aria-label="Common lengths">
            {COMMIT_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className={`commit__preset ${minutes === preset ? 'is-active' : ''}`}
                aria-pressed={minutes === preset}
                onClick={() => setText(String(preset))}
              >
                {preset} min
              </button>
            ))}
          </div>

          <label className="field-label" htmlFor="commit-minutes">
            Or type the minutes ({MIN_COMMIT_MINUTES} to {MAX_COMMIT_MINUTES})
          </label>
          <input
            id="commit-minutes"
            className="aero-input commit__input"
            type="number"
            inputMode="numeric"
            min={MIN_COMMIT_MINUTES}
            max={MAX_COMMIT_MINUTES}
            step={1}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />

          <div className="commit__whitelist">
            <button
              type="button"
              className={`home__switch${whitelistOn ? ' is-on' : ''}`}
              aria-pressed={whitelistOn}
              onClick={() => onWhitelistChange(!whitelistOn)}
            >
              <span>Whitelist</span>
              <span className="home__switch-state">{whitelistOn ? 'On' : 'Off'}</span>
            </button>
            <AeroButton variant="glass" onClick={onEditWhitelist}>
              Edit list
            </AeroButton>
          </div>
          <p className="commit__note">
            {whitelistOn
              ? 'On: only the apps on your whitelist can stay open.'
              : 'Off: you can’t open any other software during Focus.'}{' '}
            The Windows key, Alt+Tab, trackpad swipes that switch apps or desktops, and the other switching shortcuts stay blocked until Focus ends.
          </p>

          <div className="form-actions">
            <AeroButton variant="glass" onClick={onClose}>
              Cancel
            </AeroButton>
            <AeroButton type="submit" disabled={!valid}>
              Start {valid ? `${minutes} min` : ''}
            </AeroButton>
          </div>
        </form>
      </GlassPanel>
    </div>
  );
}
