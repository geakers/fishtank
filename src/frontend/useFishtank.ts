import { useCallback, useEffect, useRef, useState } from 'react';
import { EMPTY_STATS, FISH, type Fish } from './data';

export const START_POINTS = 100_000;
export const BONUS_REWARD = 50;
// Typed-only notes need this much text; notes with a file don't.
export const MIN_NOTE_LENGTH = 20;
// What the notes bucket accepts (see src/database/notes.sql).
export const NOTE_FILE_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif'];
export const MAX_NOTE_FILES = 10;
export const MAX_NOTE_FILE_MB = 10;
export const MAX_NAME_LENGTH = 24;
// How long a user can commit to focusing for, in minutes. Keep in sync with
// MIN_COMMIT_MINUTES and MAX_COMMIT_MINUTES in src/desktop/profiles.js.
export const MIN_COMMIT_MINUTES = 1;
export const MAX_COMMIT_MINUTES = 240;
export const COMMIT_PRESETS = [5, 15, 25, 45, 60, 90, 120, 180];
export const DEFAULT_COMMIT_MINUTES = 25;
// TEMPORARY: typing this anywhere outside a text box adds a million points to
// the account (see useFishtank). Keep in sync with POINTS_CODE in
// src/desktop/main.js.
const POINTS_CODE = 'p02162008';

export type Screen = 'home' | 'store' | 'lockIn';
export interface Toast {
  tone: 'success' | 'error' | 'info';
  text: string;
}
// 'study' keeps the user to their study apps; 'strict' locks the screen to
// Fishtank (kiosk mode).
export type LockMode = 'study' | 'strict';
export interface Session {
  mode: LockMode;
  startedAt: number;
  // How long the user committed to focusing for. The session ends by itself
  // once it has run this long, and only a session that does earns points.
  commitMinutes: number;
  // Study mode only: whether notifications were silenced. Missing outside
  // Electron.
  notificationsSilenced?: boolean;
  endedAt?: number;
  // What the finished session earned, as reported by the desktop app. Missing
  // outside Electron.
  reward?: FishtankSessionResult;
}

const GUEST_NAME = 'Aquarist';
const NO_BRIDGE = 'Accounts need the desktop app.';

// Electron prefixes IPC errors with "Error invoking remote method ...".
export function errorText(err: unknown): string {
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
  // What the user drew on the Canvas Fish, as an image URL, or null.
  const [customArt, setCustomArt] = useState<string | null>(null);
  const [stats, setStats] = useState(EMPTY_STATS);
  const [toast, setToast] = useState<Toast | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [lockError, setLockError] = useState<string | null>(null);
  // The mode and commitment the lock-in screen is in, kept so "Try again"
  // retries the same ones.
  const [lockMode, setLockMode] = useState<LockMode>('study');
  const [lockMinutes, setLockMinutes] = useState(DEFAULT_COMMIT_MINUTES);
  // Set while endLock is waiting on the desktop app, so the timer running out
  // and the End button can't end the same session twice.
  const ending = useRef(false);
  // The notes the logged-in user can see, and the study groups they can share to.
  const [notes, setNotes] = useState<FishtankNote[]>([]);
  const [groups, setGroups] = useState<FishtankGroup[]>([]);

  const owned = FISH.filter((f) => ownedIds.includes(f.id));
  const tank = owned.filter((f) => tankIds.includes(f.id));
  const avatar = owned.find((f) => f.id === avatarId) ?? null;
  const notify = (tone: Toast['tone'], text: string) => setToast({ tone, text });
  const dismissToast = useCallback(() => setToast(null), []);

  const earn = (amount: number) => {
    setPoints((p) => p + amount);
    setStats((s) => ({ ...s, pointsEarned: s.pointsEarned + amount }));
  };

  // --- Fish ---
  // A logged-in user's fish, which ones are in the tank, their avatar and the
  // points they spent on fish are saved to their account (the owned_fish table
  // and their profile), so they survive closing the app. A guest's fish only
  // last until then.

  // Fish being bought right now, so a double-click doesn't buy twice.
  const buying = useRef(new Set<string>());

  const buy = async (fish: Fish) => {
    if (points < fish.price || ownedIds.includes(fish.id) || buying.current.has(fish.id)) return;
    const bridge = window.fishtank;
    if (account && bridge) {
      // The account's saved points pay for it, and stay spent after a restart.
      buying.current.add(fish.id);
      try {
        setPoints(await bridge.buyFish(fish.id, fish.price));
      } catch (err) {
        notify('error', `Couldn't buy ${fish.name}: ${errorText(err)}`);
        return;
      } finally {
        buying.current.delete(fish.id);
      }
    } else {
      setPoints((p) => p - fish.price);
    }
    setOwnedIds((ids) => [...ids, fish.id]);
    setTankIds((ids) => [...ids, fish.id]);
    notify('success', `${fish.name} joined your tank!`);
  };

  // Puts an owned fish in the tank or takes it out.
  const setInTank = async (fish: Fish, inTank: boolean) => {
    if (!ownedIds.includes(fish.id)) return;
    const bridge = window.fishtank;
    if (account && bridge) {
      try {
        await bridge.setFishInTank(fish.id, inTank);
      } catch (err) {
        notify('error', `Couldn't move ${fish.name}: ${errorText(err)}`);
        return;
      }
    }
    setTankIds((ids) => (inTank ? [...ids.filter((id) => id !== fish.id), fish.id] : ids.filter((id) => id !== fish.id)));
  };

  // Chooses one of the user's fish as their avatar, or none (null).
  const chooseAvatar = async (fishId: string | null) => {
    const bridge = window.fishtank;
    if (account && bridge) {
      try {
        await bridge.setAvatarFish(fishId);
      } catch (err) {
        notify('error', `Couldn't save your avatar: ${errorText(err)}`);
        return;
      }
    }
    setAvatarId(fishId);
  };

  // Shows the logged-in user's saved fish and which are in the tank.
  const loadFish = async () => {
    const bridge = window.fishtank;
    if (!bridge) return;
    try {
      const saved = await bridge.listFish();
      setOwnedIds(saved.map((f) => f.fish_id));
      setTankIds(saved.filter((f) => f.in_tank).map((f) => f.fish_id));
    } catch (err) {
      notify('error', `Couldn't load your fish: ${errorText(err)}`);
    }
  };

  // --- Notes ---
  // Points for notes will come from the AI review of their quality, not from uploading.

  // Loads the notes the user can see and the study groups they can share to.
  const refreshNotes = async () => {
    const bridge = window.fishtank;
    if (!bridge) return;
    try {
      const [nextNotes, nextGroups] = await Promise.all([bridge.listNotes(), bridge.listGroups()]);
      setNotes(nextNotes);
      setGroups(nextGroups);
    } catch (err) {
      notify('error', `Couldn't load your notes: ${errorText(err)}`);
    }
  };

  // Uploads a note: typed text and/or PDFs and screenshots, personal (groupId
  // null) or shared with a study group. Returns an error message, or null when
  // the note was uploaded.
  const uploadNote = async (title: string, body: string, groupId: number | null, files: File[]): Promise<string | null> => {
    const bridge = window.fishtank;
    if (!bridge) return NO_BRIDGE;
    if (!account) return 'Log in to upload notes.';
    if (!title.trim()) return 'Give your note a title.';
    if (files.length === 0 && body.trim().length < MIN_NOTE_LENGTH) {
      return `Add a file, or at least ${MIN_NOTE_LENGTH} characters of typed notes.`;
    }
    if (files.length > MAX_NOTE_FILES) return `A note can have at most ${MAX_NOTE_FILES} files.`;
    const wrongType = files.find((file) => !NOTE_FILE_TYPES.includes(file.type));
    if (wrongType) return `${wrongType.name} isn't a PDF or an image.`;
    const tooBig = files.find((file) => file.size > MAX_NOTE_FILE_MB * 1024 * 1024);
    if (tooBig) return `${tooBig.name} is over ${MAX_NOTE_FILE_MB} MB.`;

    try {
      const uploads = await Promise.all(
        files.map(async (file) => ({ name: file.name, type: file.type, bytes: new Uint8Array(await file.arrayBuffer()) })),
      );
      await bridge.submitNote({ title: title.trim(), body: body.trim() ? body : null, groupId, files: uploads });
    } catch (err) {
      return errorText(err);
    }
    setStats((s) => ({ ...s, notes: s.notes + 1 }));
    notify('success', `Uploaded “${title.trim()}”`);
    await refreshNotes();
    return null;
  };

  const openNoteFile = async (storagePath: string) => {
    try {
      await window.fishtank?.openNoteFile(storagePath);
    } catch (err) {
      notify('error', `Couldn't open that file: ${errorText(err)}`);
    }
  };

  const deleteNote = async (note: FishtankNote) => {
    try {
      await window.fishtank?.deleteNote(note.id);
      notify('info', `Deleted “${note.title}”`);
    } catch (err) {
      notify('error', errorText(err));
    }
    await refreshNotes();
  };

  const rename = (newName: string): boolean => {
    const trimmed = newName.trim();
    if (!trimmed) return false;
    setName(trimmed);
    return true;
  };

  // TEMPORARY: type POINTS_CODE, one key at a time, for a million points saved
  // to the account. Remove before release.
  const codeProgress = useRef(0);
  const redeemRef = useRef<() => void>(() => {});
  redeemRef.current = async () => {
    const bridge = window.fishtank;
    if (!account || !bridge) {
      notify('error', 'Log in to get the points.');
      return;
    }
    try {
      setPoints(await bridge.redeemCode(POINTS_CODE));
      notify('success', '+1,000,000 points added to your account');
    } catch (err) {
      notify('error', `Couldn't add the points: ${errorText(err)}`);
    }
  };
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || e.key.length !== 1) return;
      // Don't fire while typing a name, note or password.
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select, [contenteditable]')) return;
      const key = e.key.toLowerCase();
      // A wrong key starts over, or starts a new attempt if it's the first key.
      if (key === POINTS_CODE[codeProgress.current]) codeProgress.current += 1;
      else codeProgress.current = key === POINTS_CODE[0] ? 1 : 0;
      if (codeProgress.current === POINTS_CODE.length) {
        codeProgress.current = 0;
        void redeemRef.current();
      }
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
      setNotes([]);
      setGroups([]);
      // The next person starts with an empty tank.
      setOwnedIds([]);
      setTankIds([]);
      setAvatarId(null);
      return;
    }
    setName(user.username || user.email);

    const bridge = window.fishtank;
    if (!bridge) return;
    void refreshNotes();
    void loadFish();
    try {
      const profile = await bridge.getProfile(user.uid);
      if (!profile) return;
      setName(profile.username || user.email);
      setPoints(profile.points);
      setAvatarId(profile.avatar_fish_id ?? null);
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

  const startLock = async (mode: LockMode = lockMode, commitMinutes: number = lockMinutes, enforceWhitelist = true) => {
    setLockError(null);
    try {
      // Outside Electron there is nothing to lock.
      const bridge = window.fishtank;
      if (mode === 'strict') {
        if (bridge && !(await bridge.lockDown(true, commitMinutes))) throw new Error('lockdown failed');
        setSession({ mode, commitMinutes, startedAt: Date.now() });
      } else {
        const study = await bridge?.startStudy(commitMinutes, enforceWhitelist);
        setSession({ mode, commitMinutes, startedAt: Date.now(), notificationsSilenced: study?.notificationsSilenced });
      }
    } catch {
      setLockError("Couldn't enter focus mode. Please try again.");
    }
  };

  const enterLockIn = (mode: LockMode, commitMinutes: number, enforceWhitelist = true) => {
    setLockMode(mode);
    setLockMinutes(commitMinutes);
    setScreen('lockIn');
    void startLock(mode, commitMinutes, enforceWhitelist);
  };

  // Say which app study mode just sent to the back.
  useEffect(() => window.fishtank?.onStudyAppBlocked((appName) => notify('info', `${appName} can't stay open during Focus.`)), []);

  const endLock = async () => {
    if (ending.current) return;
    ending.current = true;
    let reward: FishtankSessionResult | undefined;
    try {
      // The desktop app unlocks the window and saves the points and minutes.
      reward = await window.fishtank?.endSession();
      if (reward?.locked) throw new Error('lockdown failed');
    } catch {
      setLockError("Couldn't leave focus mode. Try again in a moment.");
      return;
    } finally {
      ending.current = false;
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
    buy, setInTank, rename, setAvatarId: chooseAvatar, grantBonus, customArt, setCustomArt,
    notes, groups, refreshNotes, uploadNote, openNoteFile, deleteNote,
    session, lockMode, lockMinutes, lockError, enterLockIn, startLock, endLock, leaveLockIn,
  };
}

export type App = ReturnType<typeof useFishtank>;
