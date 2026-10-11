import type { App } from '../../useFishtank';
import { AeroButton } from './AeroButton';
import { GlassPanel } from './GlassPanel';
import { NoteList } from './NoteList';

export interface NotesPanelProps {
  app: App;
  className?: string;
  // Opens the note composer.
  onUpload: () => void;
}

// The home screen's notes panel: upload study notes, and see your own notes and
// your study groups' notes with their files.
export function NotesPanel({ app, className = '', onUpload }: NotesPanelProps) {
  return (
    <GlassPanel variant="raised" className={`notes-panel ${className}`} aria-label="Study notes">
      <div className="notes-panel__header">
        <h2 className="panel-title">Study notes</h2>
        {app.account ? (
          <>
            <AeroButton variant="glass" onClick={() => void app.refreshNotes()}>
              Refresh
            </AeroButton>
            <AeroButton onClick={onUpload}>Upload</AeroButton>
          </>
        ) : null}
      </div>

      {!app.account ? (
        <p className="muted">Log in to upload PDFs, screenshots and typed notes.</p>
      ) : app.notes.length === 0 ? (
        <p className="muted">No notes yet. Upload a PDF, a screenshot or some typed notes.</p>
      ) : (
        <NoteList
          notes={app.notes}
          accountUid={app.account.uid}
          groups={app.groups}
          onOpenFile={(path) => void app.openNoteFile(path)}
          onDelete={(note) => void app.deleteNote(note)}
        />
      )}
    </GlassPanel>
  );
}
