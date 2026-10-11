import { useState } from 'react';
import type { App } from '../../useFishtank';
import { AeroButton } from './AeroButton';
import { GlassPanel } from './GlassPanel';
import { NoteComposer } from './NoteComposer';

export interface NotesPanelProps {
  app: App;
  className?: string;
}

const STATUS_LABELS: Record<FishtankNote['status'], string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  reviewing: 'Reviewing',
  reviewed: 'Reviewed',
  failed: 'Review failed',
};

// The home screen's notes panel: upload study notes, and see your own notes and
// your study groups' notes with their files.
export function NotesPanel({ app, className = '' }: NotesPanelProps) {
  const [composerOpen, setComposerOpen] = useState(false);
  // The note whose Delete was clicked once and is waiting for a second click.
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);

  const groupName = (id: number) => app.groups.find((group) => group.id === id)?.name ?? 'Study group';

  return (
    <>
      <GlassPanel variant="raised" className={`notes-panel ${className}`} aria-label="Study notes">
        <div className="notes-panel__header">
          <h2 className="panel-title">Study notes</h2>
          {app.account ? (
            <>
              <AeroButton variant="glass" onClick={() => void app.refreshNotes()}>
                Refresh
              </AeroButton>
              <AeroButton onClick={() => setComposerOpen(true)}>Upload</AeroButton>
            </>
          ) : null}
        </div>

        {!app.account ? (
          <p className="muted">Log in to upload PDFs, screenshots and typed notes.</p>
        ) : app.notes.length === 0 ? (
          <p className="muted">No notes yet. Upload a PDF, a screenshot or some typed notes.</p>
        ) : (
          <ul className="notes-panel__list">
            {app.notes.map((note) => {
              const mine = note.owner_id === app.account?.uid;
              return (
                <li key={note.id} className="notes-panel__note">
                  <div className="notes-panel__title-row">
                    <span className="notes-panel__title">{note.title}</span>
                    <span className={`notes-panel__status notes-panel__status--${note.status}`}>{STATUS_LABELS[note.status]}</span>
                  </div>
                  <div className="muted">
                    {note.group_id === null ? 'Just me' : groupName(note.group_id)} · {mine ? 'by you' : 'by a group member'} ·{' '}
                    {new Date(note.created_at).toLocaleDateString()}
                  </div>
                  {note.body ? <p className="notes-panel__body">{note.body}</p> : null}
                  {note.note_files.length > 0 ? (
                    <div className="notes-panel__files">
                      {note.note_files.map((file) => (
                        <button
                          key={file.id}
                          type="button"
                          className="notes-panel__file"
                          title="Open"
                          onClick={() => void app.openNoteFile(file.storage_path)}
                        >
                          {file.mime_type === 'application/pdf' ? 'PDF' : 'Image'} · {fileName(file.storage_path)}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {mine ? (
                    <button
                      type="button"
                      className="notes-panel__delete"
                      onClick={() => {
                        if (confirmingDelete !== note.id) return setConfirmingDelete(note.id);
                        setConfirmingDelete(null);
                        void app.deleteNote(note);
                      }}
                    >
                      {confirmingDelete === note.id ? 'Click again to delete' : 'Delete'}
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </GlassPanel>

      {/* Outside the panel so the modal covers the whole screen. */}
      {composerOpen ? <NoteComposer groups={app.groups} onSubmit={app.uploadNote} onCancel={() => setComposerOpen(false)} /> : null}
    </>
  );
}

// The name a file was uploaded with, without the number added to keep paths unique.
function fileName(storagePath: string): string {
  return (storagePath.split('/').pop() ?? storagePath).replace(/^\d+-/, '');
}
