import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { errorText } from '../../useFishtank';
import { AeroButton } from './AeroButton';
import { GlassPanel } from './GlassPanel';
import { NoteList } from './NoteList';

const MAX_GROUP_NAME_LENGTH = 40;
// How often to check for new invites and groups.
const REFRESH_MS = 30_000;
// How long to wait after the last keystroke before searching usernames.
const SEARCH_DELAY_MS = 250;

export interface StudyGroupsProps {
  // The logged-in user, or null for a guest.
  account: FishtankUser | null;
  className?: string;
  // When given, an open group also shows its study notes and an upload button.
  notes?: GroupNotesSource;
}

// The study notes shown inside groups, and what to do with them.
export interface GroupNotesSource {
  // The notes the user can see; each group shows the ones shared with it.
  items: FishtankNote[];
  // Called when a group is opened, to load its latest notes.
  onShow: () => void;
  onUpload: (group: FishtankGroup) => void;
  onOpenFile: (storagePath: string) => void;
  onDelete: (note: FishtankNote) => void;
}

interface Notice {
  tone: 'ok' | 'error';
  text: string;
}

// The home screen's study groups panel: a search box and "new group" button at
// the top, then invites waiting for an answer and the user's groups. Clicking
// a group drops down the people in it, and lets its leader invite more.
export function StudyGroups({ account, className = '', notes }: StudyGroupsProps) {
  const bridge = window.fishtank;
  if (!bridge || !account) {
    return (
      <GlassPanel variant="raised" className={`groups ${className}`}>
        <h2 className="panel-title">Study groups</h2>
        <p className="groups__empty muted">
          {bridge ? 'Log in from the profile menu to study with friends.' : 'Study groups need the desktop app.'}
        </p>
      </GlassPanel>
    );
  }
  // Keyed by user so nothing from one account is left on screen for the next.
  return <GroupsPanel key={account.uid} bridge={bridge} account={account} className={className} notes={notes} />;
}

// Usernames matching the search text, minus the ones in `exclude`.
function useUsernameSearch(bridge: FishtankBridge, query: string, exclude: string[]) {
  const [names, setNames] = useState<string[]>([]);
  const text = query.trim();
  useEffect(() => {
    if (!text) {
      setNames([]);
      return;
    }
    let stale = false;
    const timer = setTimeout(() => {
      bridge.searchUsernames(text).then(
        (found) => !stale && setNames(found),
        () => !stale && setNames([]),
      );
    }, SEARCH_DELAY_MS);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [bridge, text]);
  return names.filter((name) => !exclude.includes(name));
}

interface GroupsPanelProps {
  bridge: FishtankBridge;
  account: FishtankUser;
  className: string;
  notes?: GroupNotesSource;
}

function GroupsPanel({ bridge, account, className, notes }: GroupsPanelProps) {
  // null until the first load finishes.
  const [groups, setGroups] = useState<FishtankGroup[] | null>(null);
  const [invites, setInvites] = useState<FishtankGroupInvite[]>([]);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [openGroupId, setOpenGroupId] = useState<number | null>(null);
  const [openPerson, setOpenPerson] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  // Goes up after each invite, so the open group reloads its people.
  const [rosterVersion, setRosterVersion] = useState(0);

  const fail = (err: unknown) => {
    const text = errorText(err);
    setNotice({ tone: 'error', text: text.charAt(0).toUpperCase() + text.slice(1) });
  };

  // Resolves with false when the groups couldn't be loaded.
  const refresh = useCallback(async () => {
    try {
      // Invites are an add-on to the groups database, so groups still load
      // when invites can't.
      const [nextGroups, nextInvites] = await Promise.all([bridge.listGroups(), bridge.listInvites().catch(() => [])]);
      setGroups(nextGroups);
      setInvites(nextInvites);
      return true;
    } catch {
      setGroups((current) => current ?? []);
      return false;
    }
  }, [bridge]);

  useEffect(() => {
    void refresh().then((ok) => {
      if (!ok) setNotice({ tone: 'error', text: "Couldn't load your study groups." });
    });
    const timer = setInterval(() => void refresh(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  const createGroup = async (name: string) => {
    try {
      const created = await bridge.createGroup(name);
      setCreating(false);
      setQuery('');
      setOpenGroupId(created.id);
      setNotice({ tone: 'ok', text: `Created ${created.name}.` });
      await refresh();
    } catch (err) {
      fail(err);
    }
  };

  const invite = async (group: FishtankGroup, username: string) => {
    try {
      await bridge.inviteMember(group.id, username);
      setRosterVersion((v) => v + 1);
      setNotice({ tone: 'ok', text: `Invited ${username} to ${group.name}.` });
    } catch (err) {
      fail(err);
    }
  };

  const answerInvite = async (inviteToAnswer: FishtankGroupInvite, accept: boolean) => {
    try {
      if (accept) {
        await bridge.acceptInvite(inviteToAnswer.group_id);
        setOpenGroupId(inviteToAnswer.group_id);
        setNotice({ tone: 'ok', text: `You joined ${inviteToAnswer.group_name}.` });
      } else {
        await bridge.declineInvite(inviteToAnswer.group_id);
        setNotice(null);
      }
    } catch (err) {
      fail(err);
    }
    await refresh();
  };

  const search = query.trim().toLowerCase();
  const matches = (name: string) => name.toLowerCase().includes(search);
  const shownGroups = (groups ?? []).filter((g) => matches(g.name));
  const shownInvites = invites.filter((i) => matches(i.group_name));
  const people = useUsernameSearch(bridge, query, account.username ? [account.username] : []);
  const ledGroups = (groups ?? []).filter((g) => g.leader_id === account.uid);

  return (
    <GlassPanel variant="raised" className={`groups ${className}`}>
      <h2 className="panel-title">Study groups</h2>

      <div className="groups__bar">
        <input
          className="aero-input"
          type="search"
          placeholder="Search people or groups"
          aria-label="Search people or groups"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <AeroButton
          className="groups__round"
          aria-label="New study group"
          title="New study group"
          aria-expanded={creating}
          onClick={() => setCreating(!creating)}
        >
          +
        </AeroButton>
      </div>

      {creating ? <NewGroupForm onCreate={createGroup} onCancel={() => setCreating(false)} /> : null}

      <div className="groups__scroll">
        {shownInvites.length > 0 ? (
          <section>
            <h3 className="groups__heading">Invites</h3>
            <ul className="groups__list">
              {shownInvites.map((i) => (
                <li key={i.group_id} className="groups__invite">
                  <div className="groups__invite-text">
                    <span className="groups__name">{i.group_name}</span>
                    <span className="muted">from {i.leader}</span>
                  </div>
                  <div className="groups__invite-actions">
                    <AeroButton variant="glass" onClick={() => void answerInvite(i, false)}>
                      Decline
                    </AeroButton>
                    <AeroButton onClick={() => void answerInvite(i, true)}>Accept</AeroButton>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section>
          <h3 className="groups__heading">{search ? 'Groups' : 'Your groups'}</h3>
          {groups === null ? <p className="muted">Loading…</p> : null}
          {groups !== null && shownGroups.length === 0 ? (
            <p className="muted">{search ? 'No groups match.' : 'No study groups yet. Press + to start one.'}</p>
          ) : null}
          <ul className="groups__list">
            {shownGroups.map((g) => {
              const open = openGroupId === g.id;
              const isLeader = g.leader_id === account.uid;
              return (
                <li key={g.id} className={`groups__item ${open ? 'is-open' : ''}`}>
                  <button type="button" className="groups__row" aria-expanded={open} onClick={() => setOpenGroupId(open ? null : g.id)}>
                    <span className="groups__name">{g.name}</span>
                    {isLeader ? <span className="groups__tag">Leader</span> : null}
                    <span className="groups__caret" aria-hidden="true">
                      ▾
                    </span>
                  </button>
                  {open ? (
                    <GroupPeople bridge={bridge} group={g} isLeader={isLeader} version={rosterVersion} onInvite={(username) => invite(g, username)} />
                  ) : null}
                  {open && notes ? <GroupNotes group={g} groups={groups ?? []} accountUid={account.uid} notes={notes} /> : null}
                </li>
              );
            })}
          </ul>
        </section>

        {search ? (
          <section>
            <h3 className="groups__heading">People</h3>
            {people.length === 0 ? <p className="muted">No people match.</p> : null}
            <ul className="groups__list">
              {people.map((username) => {
                const open = openPerson === username;
                return (
                  <li key={username} className={`groups__item ${open ? 'is-open' : ''}`}>
                    <button type="button" className="groups__row" aria-expanded={open} onClick={() => setOpenPerson(open ? null : username)}>
                      <span className="groups__name">{username}</span>
                      <span className="groups__caret" aria-hidden="true">
                        ▾
                      </span>
                    </button>
                    {open ? (
                      <div className="groups__drop">
                        {ledGroups.length === 0 ? (
                          <p className="muted">Start a group with + to invite {username}.</p>
                        ) : (
                          <ul className="groups__list">
                            {ledGroups.map((g) => (
                              <li key={g.id} className="groups__person">
                                <span className="groups__name">{g.name}</span>
                                <AeroButton variant="glass" onClick={() => void invite(g, username)}>
                                  Invite
                                </AeroButton>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}
      </div>

      {notice ? (
        <p className={`groups__notice ${notice.tone === 'ok' ? 'ok-text' : 'error-text'}`} role="status">
          {notice.text}
        </p>
      ) : null}
    </GlassPanel>
  );
}

function NewGroupForm({ onCreate, onCancel }: { onCreate: (name: string) => Promise<void>; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    await onCreate(name);
    setBusy(false);
  };

  return (
    <form className="groups__form" onSubmit={(e) => void submit(e)}>
      <input
        className="aero-input"
        placeholder="Name your study group"
        aria-label="Study group name"
        maxLength={MAX_GROUP_NAME_LENGTH}
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
      />
      <div className="groups__form-actions">
        <AeroButton variant="glass" onClick={onCancel}>
          Cancel
        </AeroButton>
        <AeroButton type="submit" disabled={!name.trim() || busy}>
          Create
        </AeroButton>
      </div>
    </form>
  );
}

interface GroupPeopleProps {
  bridge: FishtankBridge;
  group: FishtankGroup;
  isLeader: boolean;
  // Reloads the people each time it changes.
  version: number;
  onInvite: (username: string) => Promise<void>;
}

// The drop-down under a group: everyone in it, anyone invited who hasn't
// answered yet and, for the leader, an Add button to invite more people.
function GroupPeople({ bridge, group, isLeader, version, onInvite }: GroupPeopleProps) {
  const [roster, setRoster] = useState<FishtankGroupMember[] | null>(null);
  const [invited, setInvited] = useState<string[]>([]);
  const [failed, setFailed] = useState(false);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let stale = false;
    const pending = isLeader ? bridge.groupInvites(group.id).catch(() => []) : Promise.resolve([]);
    Promise.all([bridge.groupRoster(group.id), pending]).then(
      ([nextRoster, nextInvited]) => {
        if (stale) return;
        setRoster(nextRoster);
        setInvited(nextInvited);
        setFailed(false);
      },
      () => !stale && setFailed(true),
    );
    return () => {
      stale = true;
    };
  }, [bridge, group.id, isLeader, version]);

  const taken = [...(roster ?? []).map((m) => m.username), ...invited];
  const suggestions = useUsernameSearch(bridge, adding ? query : '', taken);

  return (
    <div className="groups__drop">
      {failed ? <p className="error-text">Couldn't load this group.</p> : null}
      {roster === null && !failed ? <p className="muted">Loading…</p> : null}
      <ul className="groups__list">
        {(roster ?? []).map((m) => (
          <li key={m.username} className="groups__person">
            <span className="groups__name">{m.username}</span>
            {m.role === 'leader' ? <span className="groups__tag">Leader</span> : null}
          </li>
        ))}
        {invited.map((username) => (
          <li key={username} className="groups__person is-pending">
            <span className="groups__name">{username}</span>
            <span className="muted">Invited</span>
          </li>
        ))}
      </ul>

      {isLeader && !adding ? (
        <AeroButton variant="glass" className="groups__add-person" onClick={() => setAdding(true)}>
          + Add
        </AeroButton>
      ) : null}

      {isLeader && adding ? (
        <div className="groups__invite-search">
          <input
            className="aero-input"
            type="search"
            placeholder="Search by username"
            aria-label={`Invite someone to ${group.name}`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          {query.trim() && suggestions.length === 0 ? <p className="muted">No one else matches.</p> : null}
          <ul className="groups__list">
            {suggestions.map((username) => (
              <li key={username} className="groups__person">
                <span className="groups__name">{username}</span>
                <AeroButton variant="glass" onClick={() => void onInvite(username)}>
                  Invite
                </AeroButton>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

interface GroupNotesProps {
  group: FishtankGroup;
  groups: FishtankGroup[];
  accountUid: string;
  notes: GroupNotesSource;
}

// The notes part of the drop-down under a group: the study notes shared with
// it, and a button for anyone in the group to upload one.
function GroupNotes({ group, groups, accountUid, notes }: GroupNotesProps) {
  // Loads the latest notes each time the group is opened. onShow can be a new
  // function on every render, so only the group decides when this runs.
  const onShow = useRef(notes.onShow);
  onShow.current = notes.onShow;
  useEffect(() => onShow.current(), [group.id]);

  const shared = notes.items.filter((note) => note.group_id === group.id);

  return (
    <div className="groups__drop groups__notes">
      <h3 className="groups__heading">Notes</h3>
      {shared.length === 0 ? <p className="muted">No notes yet.</p> : null}
      <NoteList notes={shared} accountUid={accountUid} groups={groups} onOpenFile={notes.onOpenFile} onDelete={notes.onDelete} />
      <AeroButton variant="glass" className="groups__add-person" onClick={() => notes.onUpload(group)}>
        Upload to this group
      </AeroButton>
    </div>
  );
}
