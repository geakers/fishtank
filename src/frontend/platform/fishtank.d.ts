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
  }

  interface FishtankBridge {
    // Turns kiosk lockdown on/off. Resolves with the window's actual kiosk state.
    lockDown(enabled: boolean): Promise<boolean>;
    // Creates an account. needsConfirmation is true when the user must confirm
    // their email before they can log in.
    createAccount(account: { username: string; email: string; password: string }): Promise<{ needsConfirmation: boolean }>;
    // Resolves with the profile for that uid, or null if there is none.
    getProfile(uid: string): Promise<FishtankProfile | null>;
    // Resolves with the user's points, or null if there is no such profile.
    getPoints(uid: string): Promise<number | null>;
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
