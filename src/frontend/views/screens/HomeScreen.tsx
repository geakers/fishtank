import { useEffect, useState } from 'react';
import type { App } from '../../useFishtank';
import { AeroButton } from '../components/AeroButton';
import { Aquarium } from '../components/Aquarium';
import { CommitPicker } from '../components/CommitPicker';
import { NoteComposer } from '../components/NoteComposer';
import { NotesPanel } from '../components/NotesPanel';
import { PointsBadge } from '../components/PointsBadge';
import { ProfileMenu } from '../components/ProfileMenu';
import { StudyApps } from '../components/StudyApps';
import { StudyGroups } from '../components/StudyGroups';
import { Toast } from '../components/Toast';

export interface HomeScreenProps {
  app: App;
}

// Layout:
//   top bar - points and profile, floating at the top right
//   main    - three columns. Left: Groups | Notes. Middle: a quiet clock just
//             above the tank, then the tank on a short cabinet. Right: Focus.
//   corner  - Fish Shop peeks out of the bottom right and slides out on hover
type SideTab = 'groups' | 'notes';

const SIDE_TABS: { id: SideTab; label: string }[] = [
  { id: 'groups', label: 'Groups' },
  { id: 'notes', label: 'Notes' },
];

const WHITELIST_KEY = 'fishtank-whitelist';

function readWhitelist(): boolean {
  try {
    return localStorage.getItem(WHITELIST_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function HomeScreen({ app }: HomeScreenProps) {
  const openShop = () => app.setScreen('store');
  const [choosingApps, setChoosingApps] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [whitelistOn, setWhitelistOn] = useState(readWhitelist);
  const [sideTab, setSideTab] = useState<SideTab>('groups');
  // The note composer, open with the group "Share with" starts on (null = just me).
  const [composer, setComposer] = useState<{ groupId: number | null } | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(WHITELIST_KEY, whitelistOn ? 'on' : 'off');
    } catch {
      // A private window can refuse storage; the switch still works this visit.
    }
  }, [whitelistOn]);

  const openSideTab = (tab: SideTab) => {
    setSideTab(tab);
    // Picks up groups just made or joined in the Groups tab for "Share with".
    if (tab === 'notes') void app.refreshNotes();
  };

  // "Upload to this group" inside a study group. Refreshes first so a group
  // made a moment ago is in the composer's "Share with" list.
  const uploadToGroup = async (group: FishtankGroup) => {
    await app.refreshNotes();
    setComposer({ groupId: group.id });
  };

  return (
    <div className="screen home">
      <header className="topbar">
        <div className="topbar__actions">
          <PointsBadge balance={app.points} />
          <ProfileMenu
            displayName={app.name}
            avatarFish={app.avatar}
            ownedFish={app.owned}
            stats={app.stats}
            account={app.account}
            onLogIn={app.logIn}
            onCreateAccount={app.createAccount}
            onLogOut={() => void app.logOut()}
            onRename={app.rename}
            onSetAvatar={app.setAvatarId}
            onGrantBonus={import.meta.env.DEV ? app.grantBonus : undefined}
          />
        </div>
      </header>

      <main className="home__main">
        <aside className="home__left">
          <div className="home__side-panel">
            <div className="segmented home__tabs" role="tablist" aria-label="Study groups and notes">
              {SIDE_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={sideTab === tab.id}
                  className={`segmented__option ${sideTab === tab.id ? 'is-active' : ''}`}
                  onClick={() => openSideTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {/* Both stay mounted so switching tabs keeps an open group or a half-typed search. */}
            <StudyGroups
              account={app.account}
              className={`home__panel ${sideTab === 'groups' ? '' : 'is-hidden'}`}
              notes={{
                items: app.notes,
                onShow: () => void app.refreshNotes(),
                onUpload: (group) => void uploadToGroup(group),
                onOpenFile: (path) => void app.openNoteFile(path),
                onDelete: (note) => void app.deleteNote(note),
              }}
            />
            <NotesPanel
              app={app}
              className={`home__panel ${sideTab === 'notes' ? '' : 'is-hidden'}`}
              onUpload={() => setComposer({ groupId: null })}
            />
          </div>
        </aside>

        <section className="home__tank-panel" aria-label="Your aquarium">
          <TankClock />
          <Aquarium fish={app.tank} fishSize={96} className="home__tank" />
          {app.tank.length === 0 ? (
            <div className="home__tank-empty">
              <p>Your tank is empty.</p>
              <AeroButton onClick={openShop}>Visit the Fish Shop</AeroButton>
            </div>
          ) : null}
          <div className="tank-stand home__stand" aria-hidden="true" />
        </section>

        <aside className="home__side">
          <div className="home__actions">
            <AeroButton variant="hero" onClick={() => setCommitting(true)}>
              Focus
            </AeroButton>
          </div>
        </aside>
      </main>

      <ShopPeek onClick={openShop} />

      {committing ? (
        <CommitPicker
          mode="study"
          initialMinutes={app.lockMinutes}
          whitelistOn={whitelistOn}
          onWhitelistChange={setWhitelistOn}
          onEditWhitelist={() => setChoosingApps(true)}
          onStart={(minutes) => {
            setCommitting(false);
            app.enterLockIn('study', minutes, whitelistOn);
          }}
          onClose={() => {
            if (choosingApps) return;
            setCommitting(false);
          }}
        />
      ) : null}
      {choosingApps ? <StudyApps onClose={() => setChoosingApps(false)} /> : null}
      {composer ? (
        <NoteComposer
          groups={app.groups}
          initialGroupId={composer.groupId}
          onSubmit={app.uploadNote}
          onCancel={() => setComposer(null)}
        />
      ) : null}
      <Toast notice={app.toast} onDismiss={app.dismissToast} />
    </div>
  );
}

// The time sits in its own band above the lid, in the same cyan as the rest of the room.
function TankClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="home__clock">
      <span className="home__clock-time">{now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
    </div>
  );
}

// Tucked into the bottom-right corner. Bubbles give it away; hovering slides
// the label out so it can be clicked.
function ShopPeek({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="shop-peek" onClick={onClick}>
      <span className="shop-peek__bubbles" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span className="shop-peek__orb" aria-hidden="true" />
      <span className="shop-peek__label">Fish Shop</span>
    </button>
  );
}
