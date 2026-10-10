import { useEffect, useState } from 'react';
import type { App } from '../../useFishtank';
import { AeroButton } from '../components/AeroButton';
import { Aquarium } from '../components/Aquarium';
import { NoteComposer } from '../components/NoteComposer';
import { PointsBadge } from '../components/PointsBadge';
import { ProfileMenu } from '../components/ProfileMenu';
import { StatsBoard } from '../components/StatsBoard';
import { Toast } from '../components/Toast';

export interface HomeScreenProps {
  app: App;
}

// Layout, after the Wii menu:
//   top bar - brand on the left; points and profile menu on the right
//   main    - the user's tank on the left; stats and the lock-in button on the right
//   dock    - round "Share a note" and "Fish Shop" buttons with a clock between them
export function HomeScreen({ app }: HomeScreenProps) {
  const [composerOpen, setComposerOpen] = useState(false);
  const openShop = () => app.setScreen('store');

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
            account={app.account}
            onLogIn={app.logIn}
            onCreateAccount={app.createAccount}
            onLogOut={() => void app.logOut()}
            onRename={app.rename}
            onSetAvatar={app.setAvatarId}
            onResetProgress={app.resetProgress}
            onGrantBonus={import.meta.env.DEV ? app.grantBonus : undefined}
          />
        </div>
      </header>

      <main className="home__main">
        <section className="home__tank-panel" aria-label="Your aquarium">
          <Aquarium fish={app.owned} fishSize={96} className="home__tank" />
          {app.owned.length === 0 ? (
            <div className="home__tank-empty">
              <p>Your tank is empty.</p>
              <p className="muted">Earn points by sharing notes, then adopt your first fish.</p>
              <AeroButton onClick={openShop}>Visit the Fish Shop</AeroButton>
            </div>
          ) : null}
        </section>

        <aside className="home__side">
          <StatsBoard stats={app.stats} fishOwned={app.owned.length} />
          <div className="home__lockin">
            <AeroButton variant="hero" onClick={() => app.enterLockIn()}>
              Lock In
            </AeroButton>
            <p className="home__lockin-hint">Enter focus mode with your aquarium</p>
          </div>
        </aside>
      </main>

      <footer className="dock">
        <button type="button" className="dock__pod dock__pod--left" onClick={() => setComposerOpen(true)}>
          Share a note
        </button>
        <DockClock />
        <button type="button" className="dock__pod dock__pod--right" onClick={openShop}>
          Fish Shop
        </button>
      </footer>

      {composerOpen ? <NoteComposer onSubmit={app.shareNote} onCancel={() => setComposerOpen(false)} /> : null}

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
