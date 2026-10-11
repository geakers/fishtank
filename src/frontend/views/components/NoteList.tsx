import { useState } from 'react';

export interface NoteListProps {
  notes: FishtankNote[];
  // The logged-in user's uid, to tell their own notes apart.
  accountUid: string;
  // The study groups the user is in, to show a group note's group by name.
  groups: FishtankGroup[];
  onOpenFile: (storagePath: string) => void;
  onDelete: (note: FishtankNote) => void;
}

const STATUS_LABELS: Record<FishtankNote['status'], string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  reviewing: 'Reviewing',
  reviewed: 'Reviewed',
  failed: 'Review failed',
};

// A list of study notes: title, status, who shared it where, the start of the
// typed notes, its files (click to open) and, on your own notes, Delete.
export function NoteList({ notes, accountUid, groups, onOpenFile, onDelete }: NoteListProps) {
  // The note whose Delete was clicked once and is waiting for a second click.
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);

  const groupName = (id: number) => groups.find((group) => group.id === id)?.name ?? 'Study group';

  return (
    <ul className="notes-panel__list">
      {notes.map((note) => {
        const mine = note.owner_id === accountUid;
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
                  <button key={file.id} type="button" className="notes-panel__file" title="Open" onClick={() => onOpenFile(file.storage_path)}>
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
                  onDelete(note);
                }}
              >
                {confirmingDelete === note.id ? 'Click again to delete' : 'Delete'}
              </button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

// The name a file was uploaded with, without the number added to keep paths unique.
function fileName(storagePath: string): string {
  return (storagePath.split('/').pop() ?? storagePath).replace(/^\d+-/, '');
}
