import { useEffect, useRef, useState } from 'react';
import type { App } from '../../useFishtank';
import { AeroButton } from '../components/AeroButton';
import { Aquarium } from '../components/Aquarium';
import { GlassPanel } from '../components/GlassPanel';
import { Toast } from '../components/Toast';
import { formatClock, formatDuration, formatPoints } from '../format';

export interface LockInScreenProps {
  app: App;
}

// Focus mode: the user's fish tank on a stand, with the time left on their
// commitment above it. The session ends by itself when that runs out. In
// strict mode the window is locked to this screen; in study mode the user can
// switch to their study apps and come back.
export function LockInScreen({ app }: LockInScreenProps) {
  const { session, lockError } = app;
  const [now, setNow] = useState(Date.now());
  // Shown when the user taps the fish too fast.
  const [tapWarning, setTapWarning] = useState(false);
  // Shown when the user tries to end before their commitment is up.
  const [confirmingEnd, setConfirmingEnd] = useState(false);
  // The session the timer already ended, so a failed end isn't retried every second.
  const autoEnded = useRef<number | null>(null);

  // Re-render once a second while the session is running.
  const running = session !== null && session.endedAt === undefined;
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [running]);

  const elapsed = session ? (session.endedAt ?? now) - session.startedAt : 0;
  const commitMs = session ? session.commitMinutes * 60_000 : 0;
  const remaining = Math.max(0, commitMs - elapsed);
  const committed = session !== null && remaining === 0;
  const failedToStart = !session && lockError !== null;

  // The commitment is up: end the session, which earns its points.
  useEffect(() => {
    if (!running || !committed || autoEnded.current === session.startedAt) return;
    autoEnded.current = session.startedAt;
    setConfirmingEnd(false);
    void app.endLock();
  }, [running, committed, session, app]);

  const endPressed = () => (committed ? void app.endLock() : setConfirmingEnd(true));

  return (
    <div className="screen lockin">
      <div className="lockin__stage">
        {/* Kept in the layout when hidden so the tank doesn't jump. */}
        <div className={`lockin__timer ${running ? '' : 'is-hidden'}`}>{formatClock(remaining)}</div>
        <p className={`lockin__goal muted ${running ? '' : 'is-hidden'}`}>
          {session ? `${session.commitMinutes}-minute focus · ends at ${endTime(session.startedAt + commitMs)}` : ' '}
        </p>
        <div className="lockin__tank-wrap">
          <Aquarium
            fish={app.tank}
            fishSize={130}
            className="lockin__tank"
            onTapTooFast={running ? () => setTapWarning(true) : undefined}
          />
          {running && app.tank.length === 0 ? (
            <p className="lockin__empty">Your tank is empty. Adopt fish in the Fish Shop!</p>
          ) : null}
        </div>
        <div className="tank-stand" aria-hidden="true" />
      </div>

      {running ? (
        <div className="lockin__controls">
          {lockError ? <p className="error-text error-text--on-water">{lockError}</p> : null}
          {session.mode === 'study' && session.notificationsSilenced === false ? (
            <p className="lockin__note muted">Notifications are still on</p>
          ) : null}
          <AeroButton variant="glass" onClick={endPressed}>
            {committed ? 'End session' : 'End early'}
          </AeroButton>
        </div>
      ) : null}

      {running && tapWarning ? (
        <GlassPanel className="lockin__dialog" variant="raised" role="alertdialog" aria-label="Stop tapping the glass">
          <h2 className="panel-title">Stop tapping the glass!</h2>
          <p>You're scaring your fish. Get back to studying.</p>
          <AeroButton onClick={() => setTapWarning(false)}>Sorry!</AeroButton>
        </GlassPanel>
      ) : null}

      {running && confirmingEnd ? (
        <GlassPanel className="lockin__dialog" variant="raised" role="alertdialog" aria-label="End early?">
          <h2 className="panel-title">End early?</h2>
          <p>
            You committed to {session.commitMinutes} minutes and have {formatDuration(remaining)} to go. If you stop now your
            study time still counts, but you won't earn any points.
          </p>
          <div className="form-actions">
            <AeroButton
              variant="glass"
              onClick={() => {
                setConfirmingEnd(false);
                void app.endLock();
              }}
            >
              End without points
            </AeroButton>
            <AeroButton onClick={() => setConfirmingEnd(false)}>Keep focusing</AeroButton>
          </div>
        </GlassPanel>
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
          <span className="lockin__summary-kicker">{session.reward?.completed === false ? 'Ended early' : 'Session complete'}</span>
          <span className="lockin__summary-time">{formatDuration(elapsed)}</span>
          <p className="muted">
            of focused study · {app.stats.streakDays}-day streak · {app.stats.sessions} sessions total
          </p>
          <SessionReward reward={session.reward} loggedIn={app.account !== null} />
          <AeroButton onClick={app.leaveLockIn}>Back home</AeroButton>
        </GlassPanel>
      ) : null}

      <Toast notice={app.toast} onDismiss={app.dismissToast} />
    </div>
  );
}

// What the session earned, or why it earned nothing.
function SessionReward({ reward, loggedIn }: { reward?: FishtankSessionResult; loggedIn: boolean }) {
  if (!reward) return null;
  if (reward.error) return <p className="error-text">Your session wasn't saved: {reward.error}</p>;
  if (!reward.completed) {
    return (
      <p className="muted">
        You ended before your {reward.commitMinutes}-minute commitment, so this session earned no points.
        {reward.saved ? ' Your study time still counts.' : ''}
      </p>
    );
  }
  if (reward.saved) return <p className="ok-text">+{formatPoints(reward.pointsEarned)} points added to your account</p>;
  if (!loggedIn) return <p className="muted">Log in to earn points for your study time.</p>;
  return <p className="muted">This session was too short to earn points.</p>;
}

// When the session will end, as a time of day ("3:45 PM").
function endTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
