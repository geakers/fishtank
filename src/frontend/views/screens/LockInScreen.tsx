import { useEffect, useState } from 'react';
import type { App } from '../../useFishtank';
import { AeroButton } from '../components/AeroButton';
import { Aquarium } from '../components/Aquarium';
import { GlassPanel } from '../components/GlassPanel';
import { formatClock, formatDuration } from '../format';

export interface LockInScreenProps {
  app: App;
}

// Focus mode: the user's fish tank on a stand, with the timer above it.
export function LockInScreen({ app }: LockInScreenProps) {
  const { session, lockError } = app;
  const [now, setNow] = useState(Date.now());

  // Re-render once a second while the session is running.
  const running = session !== null && session.endedAt === undefined;
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [running]);

  const elapsed = session ? (session.endedAt ?? now) - session.startedAt : 0;
  const failedToStart = !session && lockError !== null;

  return (
    <div className="screen lockin">
      <div className="lockin__stage">
        {/* Kept in the layout when hidden so the tank doesn't jump. */}
        <div className={`lockin__timer ${running ? '' : 'is-hidden'}`}>{formatClock(elapsed)}</div>
        <div className="lockin__tank-wrap">
          <Aquarium fish={app.owned} fishSize={130} className="lockin__tank" />
          {running && app.owned.length === 0 ? (
            <p className="lockin__empty">Your tank is empty. Share notes to earn points and adopt fish!</p>
          ) : null}
        </div>
        <div className="tank-stand" aria-hidden="true" />
      </div>

      {running ? (
        <div className="lockin__controls">
          {lockError ? <p className="error-text error-text--on-water">{lockError}</p> : null}
          <AeroButton variant="glass" onClick={() => void app.endLock()}>
            End session
          </AeroButton>
        </div>
      ) : null}

      {!session && !failedToStart ? (
        <GlassPanel className="lockin__dialog" variant="raised">
          <p>Entering focus mode…</p>
        </GlassPanel>
      ) : null}

      {failedToStart ? (
        <GlassPanel className="lockin__dialog" variant="raised">
          <h2 className="panel-title">Couldn't lock in</h2>
          <p className="error-text">{lockError}</p>
          <div className="form-actions">
            <AeroButton variant="glass" onClick={app.leaveLockIn}>
              Back home
            </AeroButton>
            <AeroButton onClick={() => void app.startLock()}>Try again</AeroButton>
          </div>
        </GlassPanel>
      ) : null}

      {session?.endedAt ? (
        <GlassPanel className="lockin__dialog lockin__summary" variant="raised">
          <span className="lockin__summary-kicker">Session complete</span>
          <span className="lockin__summary-time">{formatDuration(elapsed)}</span>
          <p className="muted">
            of focused study · {app.stats.streakDays}-day streak · {app.stats.sessions} sessions total
          </p>
          <AeroButton onClick={app.leaveLockIn}>Back home</AeroButton>
        </GlassPanel>
      ) : null}
    </div>
  );
}
