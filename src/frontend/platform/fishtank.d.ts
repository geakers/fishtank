// Types for the API that src/desktop/preload.js exposes on `window`.
// Keep this in sync with preload.js.
export {};

declare global {
  // The logged-in user, as returned by logIn and getCurrentUser.
  interface FishtankUser {
    uid: string;
    email: string;
    username: string | null;
  }

  // A row of the profiles table.
  interface FishtankProfile {
    uid: string;
    username: string;
    email: string;
    created_at: string;
    points: number;
    // Total whole minutes spent in lockdown sessions.
    minutes_studied: number;
  }

  // What endSession reports. saved is false when nobody is logged in or the
  // session ran under a minute; error is set when saving failed.
  interface FishtankSessionResult {
    locked: boolean;
    minutes: number;
    pointsEarned: number;
    saved: boolean;
    error: string | null;
  }

  // What verifyPoints reports. valid is false when the user has more points
  // than their minutes studied can account for.
  interface FishtankPointsCheck {
    valid: boolean;
    points: number;
    minutesStudied: number;
    maxPoints: number;
  }

  interface FishtankBridge {
    // Turns kiosk lockdown on/off. Resolves with the window's actual kiosk state.
    lockDown(enabled: boolean): Promise<boolean>;
    // Ends the lockdown session: turns kiosk mode off and adds the minutes and
    // points it earned to the logged-in user's profile.
    endSession(): Promise<FishtankSessionResult>;
    // Creates an account. needsConfirmation is true when the user must confirm
    // their email before they can log in.
    createAccount(account: { username: string; email: string; password: string }): Promise<{ needsConfirmation: boolean }>;
    // Resolves with the profile for that uid, or null if there is none.
    getProfile(uid: string): Promise<FishtankProfile | null>;
    // Resolves with the user's points, or null if there is no such profile.
    getPoints(uid: string): Promise<number | null>;
    // Resolves with null if there is no such profile.
    verifyPoints(uid: string): Promise<FishtankPointsCheck | null>;
    // Logs in and keeps the session, including across restarts.
    logIn(credentials: { email: string; password: string }): Promise<FishtankUser>;
    logOut(): Promise<void>;
    // Resolves with the logged-in user, or null if nobody is logged in.
    getCurrentUser(): Promise<FishtankUser | null>;
  }

  interface Window {
    // Undefined when the page runs outside Electron (e.g. in a plain browser).
    fishtank?: FishtankBridge;
  }
}
