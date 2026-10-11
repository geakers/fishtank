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

  // An app the user can allow in study mode. id is its bundle ID.
  interface FishtankStudyApp {
    id: string;
    name: string;
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

  // A group study session (a row of the study_groups table), as returned by
  // createGroup and listGroups.
  interface FishtankGroup {
    id: number;
    name: string;
    leader_id: string;
  }

  // Someone in a group study session, as returned by groupRoster.
  interface FishtankGroupMember {
    username: string;
    role: 'leader' | 'member';
  }

  // An invite to a group study session that the logged-in user hasn't answered
  // yet, as returned by listInvites. leader is the leader's username.
  interface FishtankGroupInvite {
    group_id: number;
    group_name: string;
    leader: string;
  }

  // A file attached to a note (a row of the note_files table).
  interface FishtankNoteFile {
    id: string;
    // Where the file is in the notes bucket: <owner uid>/<note id>/<file name>.
    storage_path: string;
    mime_type: string;
    size_bytes: number;
  }

  // A study note (a row of the notes table) with its files, as returned by
  // listNotes. group_id is null for a personal note.
  interface FishtankNote {
    id: string;
    owner_id: string;
    group_id: number | null;
    title: string;
    body: string | null;
    status: 'draft' | 'submitted' | 'reviewing' | 'reviewed' | 'failed';
    created_at: string;
    submitted_at: string | null;
    note_files: FishtankNoteFile[];
  }

  // A file picked for upload: a PDF or an image, at most 10 MB.
  interface FishtankUploadFile {
    name: string;
    type: string;
    bytes: Uint8Array;
  }

  interface FishtankBridge {
    // Turns kiosk lockdown (strict mode) on/off. Resolves with the window's
    // actual kiosk state.
    lockDown(enabled: boolean): Promise<boolean>;
    // Starts study mode: grows the window to fill the screen, silences
    // notifications and keeps apps that aren't on the user's list from staying
    // in front. notificationsSilenced is false when the user hasn't made the
    // Focus shortcuts.
    startStudy(): Promise<{ notificationsSilenced: boolean }>;
    // Resolves with the apps that are open right now, other than Fishtank.
    listRunningApps(): Promise<FishtankStudyApp[]>;
    // The apps the user may use in study mode. setAllowedApps resolves with
    // what was saved, and rejects during a study session.
    getAllowedApps(): Promise<FishtankStudyApp[]>;
    setAllowedApps(apps: FishtankStudyApp[]): Promise<FishtankStudyApp[]>;
    // Calls back with the name of each app study mode sends to the back.
    // Returns a function that stops the calls.
    onStudyAppBlocked(callback: (appName: string) => void): () => void;
    // Ends the session, whichever mode it is: turns kiosk and study mode off
    // and adds the minutes and points it earned to the logged-in user's profile.
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
    // Creates a group study session led by the logged-in user.
    createGroup(name: string): Promise<FishtankGroup>;
    // Resolves with the groups the logged-in user leads or is a member of,
    // sorted by name.
    listGroups(): Promise<FishtankGroup[]>;
    // Adds the user with this username to the group. Rejects unless the
    // logged-in user leads the group, the username exists and isn't the leader.
    addMember(groupId: number, username: string): Promise<void>;
    // Resolves with everyone in the group; empty if the logged-in user isn't in it.
    groupRoster(groupId: number): Promise<FishtankGroupMember[]>;
    // Resolves with up to 10 usernames containing the search text.
    searchUsernames(query: string): Promise<string[]>;
    // Invites the user with this username to the group; they join once they
    // accept. Rejects unless the logged-in user leads the group, the username
    // exists and isn't already in the group.
    inviteMember(groupId: number, username: string): Promise<void>;
    // Resolves with the invites waiting for the logged-in user, oldest first.
    listInvites(): Promise<FishtankGroupInvite[]>;
    // Accepts the logged-in user's invite to the group, making them a member.
    acceptInvite(groupId: number): Promise<void>;
    declineInvite(groupId: number): Promise<void>;
    // Resolves with the usernames invited to the group who haven't answered
    // yet; empty unless the logged-in user leads it.
    groupInvites(groupId: number): Promise<string[]>;
    // Resolves with the notes the logged-in user can see (their own and their
    // groups'), newest first.
    listNotes(): Promise<FishtankNote[]>;
    // Uploads a note with up to 10 files and submits it. Resolves with its id.
    // groupId null makes it a personal note. It needs typed notes or a file.
    submitNote(note: { title: string; body: string | null; groupId: number | null; files: FishtankUploadFile[] }): Promise<string>;
    // Deletes one of the logged-in user's own notes and its files.
    deleteNote(noteId: string): Promise<void>;
    // Opens a note's file in the default browser or viewer.
    openNoteFile(storagePath: string): Promise<void>;
  }

  interface Window {
    // Undefined when the page runs outside Electron (e.g. in a plain browser).
    fishtank?: FishtankBridge;
  }
}
