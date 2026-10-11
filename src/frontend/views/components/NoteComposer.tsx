import { MAX_NOTE_FILE_MB, MAX_NOTE_FILES, MIN_NOTE_LENGTH, NOTE_FILE_TYPES } from '../../useFishtank';
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { AeroButton } from './AeroButton';
import { GlassPanel } from './GlassPanel';

export interface NoteComposerProps {
  // The study groups the note can be shared with.
  groups: FishtankGroup[];
  // Resolves with an error message, or null when the note was uploaded.
  onSubmit: (title: string, body: string, groupId: number | null, files: File[]) => Promise<string | null>;
  onCancel: () => void;
}

// Modal form for uploading a study note: PDFs and screenshots and/or typed
// notes, just for you or shared with a study group.
export function NoteComposer({ groups, onSubmit, onCancel }: NoteComposerProps) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [groupId, setGroupId] = useState<number | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !uploading) onCancel();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onCancel, uploading]);

  const addFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? []);
    setFiles((current) => [...current, ...picked].slice(0, MAX_NOTE_FILES));
    // Lets the same file be picked again after removing it.
    event.target.value = '';
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setUploading(true);
    const message = await onSubmit(title, body, groupId, files);
    setUploading(false);
    if (message) setError(message);
    else onCancel();
  };

  const bodyLength = body.trim().length;

  return (
    <div className="modal-backdrop" onPointerDown={(event) => event.target === event.currentTarget && !uploading && onCancel()}>
      <GlassPanel variant="raised" className="modal note-composer" role="dialog" aria-labelledby="note-title">
        <form onSubmit={submit}>
          <div className="modal__header">
            <h2 id="note-title" className="panel-title">
              Upload a study note
            </h2>
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

          <label className="field-label" htmlFor="note-group-input">
            Share with
          </label>
          <select
            id="note-group-input"
            className="aero-select"
            value={groupId ?? ''}
            onChange={(event) => setGroupId(event.target.value ? Number(event.target.value) : null)}
          >
            <option value="">Just me</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>

          <div className="field-label">PDFs and screenshots</div>
          <div className="note-composer__files">
            {files.map((file, index) => (
              <div key={`${file.name}-${index}`} className="note-composer__file">
                <span className="note-composer__file-name">{file.name}</span>
                <span className="muted">{formatSize(file.size)}</span>
                <button
                  type="button"
                  className="note-composer__remove"
                  aria-label={`Remove ${file.name}`}
                  onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}
                >
                  ×
                </button>
              </div>
            ))}
            <input
              ref={fileInput}
              type="file"
              multiple
              accept={NOTE_FILE_TYPES.join(',')}
              hidden
              onChange={addFiles}
            />
            <AeroButton variant="glass" disabled={files.length >= MAX_NOTE_FILES} onClick={() => fileInput.current?.click()}>
              Add files
            </AeroButton>
            <span className="muted">
              {' '}
              Up to {MAX_NOTE_FILES} PDFs or images, {MAX_NOTE_FILE_MB} MB each
            </span>
          </div>

          <label className="field-label" htmlFor="note-body-input">
            Typed notes {files.length > 0 ? '(optional)' : ''}
          </label>
          <textarea
            id="note-body-input"
            className="aero-input aero-input--multiline"
            placeholder="Write what you learned…"
            rows={5}
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
          {files.length === 0 ? (
            <div className="note-composer__meta">
              <span className={bodyLength >= MIN_NOTE_LENGTH ? 'ok-text' : 'muted'}>
                {bodyLength} / {MIN_NOTE_LENGTH} characters minimum without a file
              </span>
            </div>
          ) : null}

          {error ? <p className="error-text">{error}</p> : null}
          <div className="form-actions">
            <AeroButton variant="glass" disabled={uploading} onClick={onCancel}>
              Cancel
            </AeroButton>
            <AeroButton type="submit" disabled={uploading}>
              {uploading ? 'Uploading…' : 'Upload note'}
            </AeroButton>
          </div>
        </form>
      </GlassPanel>
    </div>
  );
}

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
