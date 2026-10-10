import { useEffect, useState } from 'react';
import type { App } from '../../useFishtank';
import { AeroButton } from '../components/AeroButton';
import { Aquarium } from '../components/Aquarium';
import { PointsBadge } from '../components/PointsBadge';
import { ProfileMenu } from '../components/ProfileMenu';
import { Toast } from '../components/Toast';

export interface HomeScreenProps {
  app: App;
}

// Layout, after the Wii menu:
//   top bar - brand on the left; points and profile menu on the right
//   main    - the user's tank on the left; a blank panel and the Focus button on
//             the right (stats live in the profile menu)
//   dock    - a clock in the middle and a round "Fish Shop" button on the right
export function HomeScreen({ app }: HomeScreenProps) {
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
            stats={app.stats}
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
          <Aquarium fish={app.tank} fishSize={96} className="home__tank" />
          {app.tank.length === 0 ? (
            <div className="home__tank-empty">
              <p>Your tank is empty.</p>
              <p className="muted">
                {app.owned.length === 0
                  ? 'Adopt your first fish from the Fish Shop.'
                  : 'Put some of your fish back in from the Fish Shop.'}
              </p>
              <AeroButton onClick={openShop}>Visit the Fish Shop</AeroButton>
            </div>
          ) : null}
        </section>

        <aside className="home__side">
          {/* Blank for now. */}
          <div className="home__panel aero-glass aero-glass--raised" />
          <div className="home__focus">
            <AeroButton variant="hero" onClick={() => app.enterLockIn()}>
              Focus
            </AeroButton>
          </div>
        </aside>
      </main>

      <footer className="dock">
        <DockClock />
        <button type="button" className="dock__pod dock__pod--right" onClick={openShop}>
          Fish Shop
        </button>
      </footer>

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
