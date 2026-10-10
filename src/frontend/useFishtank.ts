import { useCallback, useEffect, useState } from 'react';
import { EMPTY_STATS, FISH, type Fish } from './data';

export const START_POINTS = 100_000;
export const NOTE_REWARD = 25;
export const BONUS_REWARD = 50;
export const MIN_NOTE_LENGTH = 20;
export const MAX_NAME_LENGTH = 24;
// TEMPORARY: what the P key gives (see useFishtank).
const CHEAT_POINTS = 1000;

export type Screen = 'home' | 'store' | 'lockIn';
export interface Toast {
  tone: 'success' | 'error' | 'info';
  text: string;
}
export interface Session {
  startedAt: number;
  endedAt?: number;
  // What the finished session earned, as reported by the desktop app. Missing
  // outside Electron.
  reward?: FishtankSessionResult;
}

const GUEST_NAME = 'Aquarist';
const NO_BRIDGE = 'Accounts need the desktop app.';

// Electron prefixes IPC errors with "Error invoking remote method ...".
function errorText(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
}

// All app state and actions in one place. The logged-in account's name, points
// and study time come from the desktop app; everything else lives in memory.
export function useFishtank() {
  const [screen, setScreen] = useState<Screen>('home');
  const [points, setPoints] = useState(START_POINTS);
  const [ownedIds, setOwnedIds] = useState<string[]>([]);
  // The owned fish currently swimming in the tank.
  const [tankIds, setTankIds] = useState<string[]>([]);
  const [name, setName] = useState(GUEST_NAME);
  const [account, setAccount] = useState<FishtankUser | null>(null);
  const [avatarId, setAvatarId] = useState<string | null>(null);
  const [stats, setStats] = useState(EMPTY_STATS);
  const [toast, setToast] = useState<Toast | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [lockError, setLockError] = useState<string | null>(null);

  const owned = FISH.filter((f) => ownedIds.includes(f.id));
  const tank = owned.filter((f) => tankIds.includes(f.id));
  const avatar = owned.find((f) => f.id === avatarId) ?? null;
  const notify = (tone: Toast['tone'], text: string) => setToast({ tone, text });
  const dismissToast = useCallback(() => setToast(null), []);

  const earn = (amount: number) => {
    setPoints((p) => p + amount);
    setStats((s) => ({ ...s, pointsEarned: s.pointsEarned + amount }));
  };

  const buy = (fish: Fish) => {
    if (points < fish.price || ownedIds.includes(fish.id)) return;
    setPoints(points - fish.price);
    setOwnedIds([...ownedIds, fish.id]);
    setTankIds([...tankIds, fish.id]);
    notify('success', `${fish.name} joined your tank!`);
  };

  // Puts an owned fish in the tank or takes it out.
  const setInTank = (fish: Fish, inTank: boolean) => {
    if (!ownedIds.includes(fish.id)) return;
    setTankIds((ids) => (inTank ? [...ids.filter((id) => id !== fish.id), fish.id] : ids.filter((id) => id !== fish.id)));
  };

  // Returns an error message, or null when the note was accepted.
  const shareNote = (title: string, body: string): string | null => {
    if (!title.trim()) return 'Give your note a title.';
    if (body.trim().length < MIN_NOTE_LENGTH) return `Notes need at least ${MIN_NOTE_LENGTH} characters.`;
    earn(NOTE_REWARD);
    setStats((s) => ({ ...s, notes: s.notes + 1 }));
    notify('success', `+${NOTE_REWARD} points for “${title.trim()}”`);
    return null;
  };

  const rename = (newName: string): boolean => {
    const trimmed = newName.trim();
    if (!trimmed) return false;
    setName(trimmed);
    return true;
  };

  // TEMPORARY: press P for free points while testing. Remove before release.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'p' && e.key !== 'P') return;
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      // Don't fire while typing a name, note or password.
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select, [contenteditable]')) return;
      setPoints((p) => p + CHEAT_POINTS);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const grantBonus = () => {
    earn(BONUS_REWARD);
    notify('success', `+${BONUS_REWARD} bonus points`);
  };

  // --- Account ---

  // Shows the given user's saved name, points and study time, or goes back to
  // a fresh guest when user is null.
  const showAccount = async (user: FishtankUser | null) => {
    setAccount(user);
    if (!user) {
      setName(GUEST_NAME);
      setPoints(START_POINTS);
      setStats(EMPTY_STATS);
      return;
    }
    setName(user.username || user.email);

    const bridge = window.fishtank;
    if (!bridge) return;
    try {
      const profile = await bridge.getProfile(user.uid);
      if (!profile) return;
      setName(profile.username || user.email);
      setPoints(profile.points);
      setStats((s) => ({ ...s, totalFocusMs: (profile.minutes_studied ?? 0) * 60_000 }));
    } catch {
      notify('error', "Couldn't load your saved progress.");
      return;
    }

    // A check that can't run is not a failed check, so errors here stay quiet.
    const check = await bridge.verifyPoints(user.uid).catch(() => null);
    if (check && !check.valid) notify('error', "Your points don't match your study time.");
  };

  // Pick up a login kept from a previous run.
  useEffect(() => {
    void window.fishtank?.getCurrentUser().then((user) => user && showAccount(user));
  }, []);

  // Returns an error message, or null when the user is logged in.
  const logIn = async (email: string, password: string): Promise<string | null> => {
    const bridge = window.fishtank;
    if (!bridge) return NO_BRIDGE;
    try {
      const user = await bridge.logIn({ email, password });
      // Before showAccount, so a warning from loading the account isn't replaced.
      notify('success', `Welcome back, ${user.username || user.email}!`);
      await showAccount(user);
      return null;
    } catch (err) {
      return errorText(err);
    }
  };

  // Returns an error message, or null when the account was created.
  const createAccount = async (username: string, email: string, password: string): Promise<string | null> => {
    const bridge = window.fishtank;
    if (!bridge) return NO_BRIDGE;
    if (!username.trim()) return 'Choose a username.';
    try {
      const { needsConfirmation } = await bridge.createAccount({ username: username.trim(), email, password });
      notify('success', needsConfirmation ? 'Account created. Confirm your email, then log in.' : 'Account created. You can log in now.');
      return null;
    } catch (err) {
      return errorText(err);
    }
  };

  const logOut = async () => {
    await window.fishtank?.logOut();
    await showAccount(null);
    notify('info', 'Logged out.');
  };

  // --- Lock-in ---

  const startLock = async () => {
    setLockError(null);
    try {
      // Outside Electron there is nothing to lock.
      const bridge = window.fishtank;
      if (bridge && !(await bridge.lockDown(true))) throw new Error('lockdown failed');
      setSession({ startedAt: Date.now() });
    } catch {
      setLockError("Couldn't enter focus mode. Please try again.");
    }
  };

  const enterLockIn = () => {
    setScreen('lockIn');
    void startLock();
  };

  const endLock = async () => {
    let reward: FishtankSessionResult | undefined;
    try {
      // The desktop app unlocks the window and saves the points and minutes.
      reward = await window.fishtank?.endSession();
      if (reward?.locked) throw new Error('lockdown failed');
    } catch {
      setLockError("Couldn't leave focus mode. Try again in a moment.");
      return;
    }
    if (!session) return;
    const endedAt = Date.now();
    const duration = endedAt - session.startedAt;
    const today = new Date(endedAt).toDateString();
    const yesterday = new Date(endedAt - 24 * 60 * 60 * 1000).toDateString();
    setStats((s) => ({
      ...s,
      totalFocusMs: s.totalFocusMs + duration,
      sessions: s.sessions + 1,
      longestSessionMs: Math.max(s.longestSessionMs, duration),
      streakDays: s.lastFocusDay === today ? s.streakDays : s.lastFocusDay === yesterday ? s.streakDays + 1 : 1,
      lastFocusDay: today,
    }));
    if (reward?.saved) earn(reward.pointsEarned);
    setLockError(null);
    setSession({ ...session, endedAt, reward });
  };

  const leaveLockIn = () => {
    setSession(null);
    setLockError(null);
    setScreen('home');
  };

  return {
    screen, setScreen, points, owned, tank, name, avatar, stats, toast, dismissToast,
    account, logIn, createAccount, logOut,
    buy, setInTank, shareNote, rename, setAvatarId, grantBonus,
    session, lockError, enterLockIn, startLock, endLock, leaveLockIn,
  };
}

export type App = ReturnType<typeof useFishtank>;
