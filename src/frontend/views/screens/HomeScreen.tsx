import { useEffect, useState } from 'react';
import type { App } from '../../useFishtank';
import { AeroButton } from '../components/AeroButton';
import { Aquarium } from '../components/Aquarium';
import { NotesPanel } from '../components/NotesPanel';
import { PointsBadge } from '../components/PointsBadge';
import { ProfileMenu } from '../components/ProfileMenu';
import { StudyApps } from '../components/StudyApps';
import { StudyGroups } from '../components/StudyGroups';
import { Toast } from '../components/Toast';

export interface HomeScreenProps {
  app: App;
}

// Layout, after the Wii menu:
//   top bar - brand on the left; points and profile menu on the right
//   main    - the user's tank on its cabinet on the left; on the right, Groups | Notes tabs
//             switching between the study groups and study notes panels, then the Focus button
//             (study mode) with Study apps and Strict lock-in under it (stats live in the
//             profile menu)
//   dock    - a clock in the middle and a round "Fish Shop" button on the right
type SideTab = 'groups' | 'notes';

const SIDE_TABS: { id: SideTab; label: string }[] = [
  { id: 'groups', label: 'Groups' },
  { id: 'notes', label: 'Notes' },
];

export function HomeScreen({ app }: HomeScreenProps) {
  const openShop = () => app.setScreen('store');
  const [choosingApps, setChoosingApps] = useState(false);
  const [sideTab, setSideTab] = useState<SideTab>('groups');

  const openSideTab = (tab: SideTab) => {
    setSideTab(tab);
    // Picks up groups just made or joined in the Groups tab for "Share with".
    if (tab === 'notes') void app.refreshNotes();
  };

  return (
    <div className="screen home">
      <header className="topbar">
        <Brand />
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
        <section className="home__tank-panel" aria-label="Your aquarium">
          <Aquarium fish={app.tank} fishSize={96} className="home__tank" />
          {app.tank.length === 0 ? (
            <div className="home__tank-empty">
              <p>Your tank is empty.</p>
              <AeroButton onClick={openShop}>Visit the Fish Shop</AeroButton>
            </div>
          ) : null}
          {/* The same cabinet as in focus mode; it runs on down behind the dock. */}
          <div className="tank-stand home__stand" aria-hidden="true" />
        </section>

        <aside className="home__side">
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
            <StudyGroups account={app.account} className={`home__panel ${sideTab === 'groups' ? '' : 'is-hidden'}`} />
            <NotesPanel app={app} className={`home__panel ${sideTab === 'notes' ? '' : 'is-hidden'}`} />
          </div>
          <div className="home__focus">
            <AeroButton variant="hero" onClick={() => app.enterLockIn('study')}>
              Focus
            </AeroButton>
            <div className="home__focus-more">
              <AeroButton variant="glass" onClick={() => setChoosingApps(true)}>
                Study apps
              </AeroButton>
              <AeroButton variant="glass" onClick={() => app.enterLockIn('strict')}>
                Strict lock-in
              </AeroButton>
            </div>
          </div>
        </aside>
      </main>

      <footer className="dock">
        <DockClock />
        <button type="button" className="dock__pod dock__pod--right" onClick={openShop}>
          Fish Shop
        </button>
      </footer>

      {choosingApps ? <StudyApps onClose={() => setChoosingApps(false)} /> : null}
      <Toast notice={app.toast} onDismiss={app.dismissToast} />
    </div>
  );
}

function Brand() {
  return (
    <div className="brand">
      <span className="brand__orb" aria-hidden="true" />
      <span className="brand__name">Fishtank</span>
    </div>
  );
}

// Big grey time and date in the middle of the dock, like the Wii menu.
function DockClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 10_000);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="dock__clock">
      <span className="dock__time">{now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
      <span className="dock__date">{now.toLocaleDateString([], { weekday: 'short', month: 'numeric', day: 'numeric' })}</span>
    </div>
  );
}
