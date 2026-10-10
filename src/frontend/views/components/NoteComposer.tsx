import { NOTE_REWARD, MIN_NOTE_LENGTH } from '../../useFishtank';
import { useEffect, useState, type FormEvent } from 'react';
import { AeroButton } from './AeroButton';
import { GlassPanel } from './GlassPanel';

export interface NoteComposerProps {
  // Returns an error message, or null when the note was accepted.
  onSubmit: (title: string, body: string) => string | null;
  onCancel: () => void;
}

// Modal form for sharing a study note (which earns points).
export function NoteComposer({ onSubmit, onCancel }: NoteComposerProps) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const message = onSubmit(title, body);
    if (message) setError(message);
    else onCancel();
  };

  const bodyLength = body.trim().length;

  return (
    <div className="modal-backdrop" onPointerDown={(event) => event.target === event.currentTarget && onCancel()}>
      <GlassPanel variant="raised" className="modal note-composer" role="dialog" aria-labelledby="note-title">
        <form onSubmit={submit}>
          <div className="modal__header">
            <h2 id="note-title" className="panel-title">
              Share a study note
            </h2>
            <span className="reward-chip">+{NOTE_REWARD} pts</span>
          </div>
          <label className="field-label" htmlFor="note-title-input">
            Title
          </label>
          <input
            id="note-title-input"
            className="aero-input"
            placeholder="e.g. Krebs cycle summary"
            value={title}
            maxLength={80}
            autoFocus
            onChange={(event) => setTitle(event.target.value)}
          />
          <label className="field-label" htmlFor="note-body-input">
            Note
          </label>
          <textarea
            id="note-body-input"
            className="aero-input aero-input--multiline"
            placeholder="Write what you learned…"
            rows={7}
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
          <div className="note-composer__meta">
            <span className={bodyLength >= MIN_NOTE_LENGTH ? 'ok-text' : 'muted'}>
              {bodyLength} / {MIN_NOTE_LENGTH} characters minimum
            </span>
          </div>
          {error ? <p className="error-text">{error}</p> : null}
          <div className="form-actions">
            <AeroButton variant="glass" onClick={onCancel}>
              Cancel
            </AeroButton>
            <AeroButton type="submit">Share note</AeroButton>
          </div>
        </form>
      </GlassPanel>
    </div>
  );
}
