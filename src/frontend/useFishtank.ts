import { useCallback, useState } from 'react';
import { EMPTY_STATS, FISH, type Fish } from './data';

export const START_POINTS = 100;
export const NOTE_REWARD = 25;
export const BONUS_REWARD = 50;
export const MIN_NOTE_LENGTH = 20;
export const MAX_NAME_LENGTH = 24;

export type Screen = 'home' | 'store' | 'lockIn';
export interface Toast {
  tone: 'success' | 'error' | 'info';
  text: string;
}
export interface Session {
  startedAt: number;
  endedAt?: number;
}

// Asks Electron to lock or unlock the window. Outside Electron it does nothing.
async function setLockdown(on: boolean) {
  const bridge = window.fishtank;
  if (bridge && (await bridge.lockDown(on)) !== on) throw new Error('lockdown failed');
}

// All app state and actions in one place. Everything lives in memory.
export function useFishtank() {
  const [screen, setScreen] = useState<Screen>('home');
  const [points, setPoints] = useState(START_POINTS);
  const [ownedIds, setOwnedIds] = useState<string[]>([]);
  const [name, setName] = useState('Aquarist');
  const [avatarId, setAvatarId] = useState<string | null>(null);
  const [stats, setStats] = useState(EMPTY_STATS);
  const [toast, setToast] = useState<Toast | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [lockError, setLockError] = useState<string | null>(null);

  const owned = FISH.filter((f) => ownedIds.includes(f.id));
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
    notify('success', `${fish.name} joined your tank!`);
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

  const resetProgress = () => {
    setPoints(START_POINTS);
    setOwnedIds([]);
    setAvatarId(null);
    setStats(EMPTY_STATS);
    notify('info', 'Progress reset. Fresh tank!');
  };

  const grantBonus = () => {
    earn(BONUS_REWARD);
    notify('success', `+${BONUS_REWARD} bonus points`);
  };

  // --- Lock-in ---

  const startLock = async () => {
    setLockError(null);
    try {
      await setLockdown(true);
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
    try {
      await setLockdown(false);
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
    setLockError(null);
    setSession({ ...session, endedAt });
  };

  const leaveLockIn = () => {
    setSession(null);
    setLockError(null);
    setScreen('home');
  };

  return {
    screen, setScreen, points, owned, name, avatar, stats, toast, dismissToast,
    buy, shareNote, rename, setAvatarId, resetProgress, grantBonus,
    session, lockError, enterLockIn, startLock, endLock, leaveLockIn,
  };
}

export type App = ReturnType<typeof useFishtank>;
