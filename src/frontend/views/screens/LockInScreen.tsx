import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { Fish } from '../../data';
import type { App } from '../../useFishtank';
import { AeroButton } from '../components/AeroButton';
import { BubbleField } from '../components/Bubble';
import { FishSprite } from '../components/FishSprite';
import { GlassPanel } from '../components/GlassPanel';
import { formatClock, formatDuration, hash } from '../format';

export interface LockInScreenProps {
  app: App;
}

// Full-screen aquarium shown while focus mode is on.
export function LockInScreen({ app }: LockInScreenProps) {
  const { session, lockError } = app;
  const [now, setNow] = useState(Date.now());
  const swimmers = useMemo(() => layoutSwimmers(app.owned), [app.owned]);

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
      <div className="lockin__rays" aria-hidden="true" />
      <BubbleField count={22} seed="tank" maxSize={26} />

      <div className="lockin__tank">
        {swimmers.map((s) => (
          <div key={s.key} className="swimmer" style={s.style}>
            <div className="swimmer__bob">
              <FishSprite fish={s.fish} size={s.size} />
            </div>
          </div>
        ))}
      </div>

      <Seabed />

      {running ? (
        <>
          <GlassPanel className="lockin__timer" variant="raised">
            <span className="lockin__timer-label">Locked in</span>
            <span className="lockin__timer-value">{formatClock(elapsed)}</span>
          </GlassPanel>
          {app.owned.length === 0 ? (
            <GlassPanel className="lockin__empty">
              Your tank is empty. Share notes to earn points and adopt fish!
            </GlassPanel>
          ) : null}
          <div className="lockin__controls">
            {lockError ? <p className="error-text error-text--on-water">{lockError}</p> : null}
            <AeroButton variant="glass" onClick={() => void app.endLock()}>
              End session
            </AeroButton>
          </div>
        </>
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
            of focused study · 🔥 {app.stats.streakDays}-day streak · {app.stats.sessions} sessions total
          </p>
          <AeroButton onClick={app.leaveLockIn}>Back home</AeroButton>
        </GlassPanel>
      ) : null}
    </div>
  );
}

interface Swimmer {
  key: string;
  fish: Fish;
  size: number;
  style: CSSProperties;
}

// Spreads fish across lanes with speeds from fish.behavior. Uses a hash of the
// id so each fish keeps the same lane between renders.
function layoutSwimmers(owned: Fish[]): Swimmer[] {
  return owned.map((fish) => {
    const h = hash(fish.id);
    const duration = 26 / fish.speed;
    return {
      key: fish.id,
      fish,
      size: Math.round(130 * fish.size),
      style: {
        top: `${12 + (h % 58)}%`,
        '--swim-duration': `${duration}s`,
        // Negative delay starts each fish partway through its loop.
        '--swim-delay': `${-((h >>> 6) % Math.round(duration * 10)) / 10}s`,
        '--bob-duration': `${2.4 + ((h >>> 3) % 20) / 10}s`,
      } as CSSProperties,
    };
  });
}

function Seabed() {
  const blades = [6, 14, 22, 71, 79, 88, 94];
  return (
    <div className="seabed" aria-hidden="true">
      {blades.map((left, i) => (
        <span
          key={left}
          className="seaweed"
          style={{ left: `${left}%`, height: `${90 + ((i * 37) % 80)}px`, animationDelay: `${-i * 0.7}s` } as CSSProperties}
        />
      ))}
    </div>
  );
}
