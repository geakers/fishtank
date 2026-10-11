import { useEffect, useState, type FormEvent } from 'react';
import { errorText } from '../../useFishtank';
import { AeroButton } from './AeroButton';
import { GlassPanel } from './GlassPanel';

interface Skill {
  // Matches the skill's id in src/desktop/study-skills.
  id: string;
  label: string;
  // Shown in the empty text box. Skills that pick notes have no text box.
  placeholder?: string;
  // What the button says, and what it says while Claude is working.
  action: string;
  working: string;
  // Whether the skill is about one of the user's study groups.
  needsGroup?: boolean;
  // Whether the skill works on some of the user's own notes, picked from a list.
  needsNotes?: boolean;
}

const SKILLS: Skill[] = [
  {
    id: 'group-study-plan',
    label: 'Make a group study plan',
    placeholder: 'What should the plan cover? e.g. "Chapters 4 to 6, exam on Friday"',
    action: 'Make study plan',
    working: 'Reading your notes…',
    needsGroup: true,
  },
  { id: 'critique-notes', label: 'Critique my notes', action: 'Critique my notes', working: 'Reading your notes…', needsNotes: true },
  { id: 'ask-question', label: 'Ask a question', placeholder: 'What do you want to know?', action: 'Ask Claude', working: 'Thinking…' },
];

export interface StudySkillsProps {
  className?: string;
}

// The home screen's Study Skills panel: three things to ask Claude for. Picking
// one opens its form (a text box, a study group, or a list of notes to pick
// from); once it's sent, the answer takes over the panel.
export function StudySkills({ className = '' }: StudySkillsProps) {
  const [skill, setSkill] = useState<Skill | null>(null);

  return (
    <GlassPanel variant="raised" className={`skills ${className}`}>
      <h2 className="panel-title">
        {skill ? (
          <button type="button" className="skills__back" aria-label="Back to study skills" onClick={() => setSkill(null)}>
            ‹
          </button>
        ) : null}
        {skill ? skill.label : 'Study Skills'}
      </h2>

      {skill ? (
        // Keyed by skill so each one starts with an empty box.
        <SkillRunner key={skill.id} skill={skill} />
      ) : (
        <ul className="skills__options">
          {SKILLS.map((s) => (
            <li key={s.id}>
              <button type="button" className="skills__option" onClick={() => setSkill(s)}>
                <span>{s.label}</span>
                <span className="skills__chevron" aria-hidden="true">
                  ›
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </GlassPanel>
  );
}

// The last part of a file path, whichever way its slashes go.
function baseName(filePath: string) {
  return filePath.split(/[\\/]/).pop() ?? filePath;
}

function SkillRunner({ skill }: { skill: Skill }) {
  const bridge = window.fishtank;
  const [input, setInput] = useState('');
  // The user's study groups, for skills that need one. null until loaded.
  const [groups, setGroups] = useState<FishtankGroup[] | null>(null);
  const [groupId, setGroupId] = useState<number | null>(null);
  // The user's own notes, for skills that work on notes, and the ones ticked.
  const [notes, setNotes] = useState<FishtankNote[] | null>(null);
  const [noteIds, setNoteIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ text: string; pdfPath?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!skill.needsGroup || !bridge) return;
    let stale = false;
    bridge.listGroups().then(
      (found) => {
        if (stale) return;
        setGroups(found);
        setGroupId(found[0]?.id ?? null);
      },
      (err) => !stale && setError(errorText(err) === 'Log in first' ? 'Log in to use your study groups.' : "Couldn't load your study groups."),
    );
    return () => {
      stale = true;
    };
  }, [bridge, skill.needsGroup]);

  useEffect(() => {
    if (!skill.needsNotes || !bridge) return;
    let stale = false;
    Promise.all([bridge.getCurrentUser(), bridge.listNotes()]).then(
      ([user, found]) => {
        if (stale) return;
        // listNotes also returns study groups' notes; a critique is of your own.
        setNotes(found.filter((note) => note.owner_id === user?.uid && note.status !== 'draft'));
      },
      (err) => !stale && setError(errorText(err) === 'Log in first' ? 'Log in to use your notes.' : "Couldn't load your notes."),
    );
    return () => {
      stale = true;
    };
  }, [bridge, skill.needsNotes]);

  const toggleNote = (id: string, picked: boolean) => setNoteIds((ids) => (picked ? [...ids, id] : ids.filter((other) => other !== id)));

  const ready = skill.needsNotes ? noteIds.length > 0 : input.trim() !== '' && (!skill.needsGroup || groupId !== null);

  const run = async (event: FormEvent) => {
    event.preventDefault();
    if (!bridge) {
      setError('Study skills need the desktop app.');
      return;
    }
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const request = skill.needsNotes ? { noteIds } : skill.needsGroup && groupId !== null ? { prompt: input, groupId } : input;
      setResult(await bridge.runStudySkill(skill.id, request));
    } catch (err) {
      setError(errorText(err));
    }
    setBusy(false);
  };

  // Once the request is sent, the form gives way to the output, which gets the
  // whole panel. An error brings the form back with what was typed still in it.
  if (busy || result) {
    return (
      <div className="skills__runner">
        {result ? (
          <div className="skills__answer">
            {result.pdfPath ? <p className="ok-text">Saved to Downloads and opened: {baseName(result.pdfPath)}</p> : null}
            {result.text}
          </div>
        ) : (
          <p className="skills__working muted" role="status">
            {skill.working}
          </p>
        )}
        {result ? (
          <AeroButton variant="glass" className="skills__again" onClick={() => setResult(null)}>
            Ask something else
          </AeroButton>
        ) : null}
      </div>
    );
  }

  return (
    <form className="skills__runner" onSubmit={(e) => void run(e)}>
      {skill.needsGroup ? (
        <label className="skills__group">
          <span className="muted">Study group</span>
          <select
            className="aero-select"
            value={groupId ?? ''}
            disabled={!groups?.length}
            onChange={(e) => setGroupId(Number(e.target.value))}
          >
            {groups === null ? <option value="">Loading…</option> : null}
            {groups?.length === 0 ? <option value="">No study groups yet</option> : null}
            {groups?.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {skill.needsNotes ? (
        <div className="skills__notes">
          <span className="muted">Pick the notes to critique</span>
          {notes === null && !error ? <p className="muted">Loading…</p> : null}
          {notes?.length === 0 ? <p className="muted">You haven't uploaded any notes yet. Add some in the Notes tab.</p> : null}
          <ul className="skills__note-list">
            {notes?.map((note) => (
              <li key={note.id}>
                <label className="skills__note">
                  <input type="checkbox" checked={noteIds.includes(note.id)} onChange={(e) => toggleNote(note.id, e.target.checked)} />
                  <span className="skills__note-title">{note.title}</span>
                  {note.note_files.length > 0 ? (
                    <span className="muted">
                      {note.note_files.length} {note.note_files.length === 1 ? 'file' : 'files'}
                    </span>
                  ) : null}
                </label>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <textarea
          className="aero-input skills__input"
          placeholder={skill.placeholder}
          aria-label={skill.label}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          autoFocus
        />
      )}
      <AeroButton type="submit" disabled={!ready}>
        {skill.action}
      </AeroButton>
      {error ? <p className="error-text">{error}</p> : null}
    </form>
  );
}
