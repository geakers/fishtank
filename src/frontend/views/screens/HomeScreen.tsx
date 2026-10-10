import { useState } from 'react';
import type { App } from '../../useFishtank';
import { AeroButton } from '../components/AeroButton';
import { BubbleField } from '../components/Bubble';
import { FishSidebar } from '../components/FishSidebar';
import { NoteComposer } from '../components/NoteComposer';
import { PointsBadge } from '../components/PointsBadge';
import { ProfileMenu } from '../components/ProfileMenu';
import { StatsBoard } from '../components/StatsBoard';
import { Toast } from '../components/Toast';

export interface HomeScreenProps {
  app: App;
}

// Layout:
//   top bar  - brand on the left; add note, points, store, profile menu on the right
//   left     - FishSidebar
//   center   - StatsBoard with the big lock-in button under it
export function HomeScreen({ app }: HomeScreenProps) {
  const [composerOpen, setComposerOpen] = useState(false);

  return (
    <div className="screen home">
      <BubbleField count={16} seed="home" />

      <header className="topbar">
        <Brand />
        <div className="topbar__actions">
          <AeroButton variant="glass" onClick={() => setComposerOpen(true)}>
            ✎ Share a note
          </AeroButton>
          <PointsBadge balance={app.points} />
          <AeroButton variant="secondary" onClick={() => app.setScreen('store')}>
            🛒 Store
          </AeroButton>
          <ProfileMenu
            displayName={app.name}
            avatarFish={app.avatar}
            ownedFish={app.owned}
            onRename={app.rename}
            onSetAvatar={app.setAvatarId}
            onResetProgress={app.resetProgress}
            onGrantBonus={import.meta.env.DEV ? app.grantBonus : undefined}
          />
        </div>
      </header>

      <aside className="home__sidebar">
        <FishSidebar ownedFish={app.owned} onOpenStore={() => app.setScreen('store')} />
      </aside>

      <main className="home__center">
        <StatsBoard stats={app.stats} fishOwned={app.owned.length} />
        <div className="home__lockin">
          <AeroButton variant="hero" onClick={() => app.enterLockIn()}>
            Lock In
          </AeroButton>
          <p className="home__lockin-hint">Enter focus mode with your aquarium</p>
        </div>
      </main>

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
