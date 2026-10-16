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
    // The catalog id of the user's avatar fish (one they own), or null.
    avatar_fish_id: string | null;
  }

  // A fish the logged-in user owns (a row of the owned_fish table), as
  // returned by listFish. fish_id is the catalog id from data.ts.
  interface FishtankOwnedFish {
    fish_id: string;
    // Whether it's swimming in the tank right now.
    in_tank: boolean;
    adopted_at: string;
  }

  // An app the user can allow in study mode. id is its bundle ID, or on
  // Windows the process name. path is the executable, when it is known.
  interface FishtankStudyApp {
    id: string;
    name: string;
    path?: string;
  }

  // What endSession reports. completed is true when the session lasted the
  // minutes the user committed to; only then does it earn points. saved is
  // false when nobody is logged in or the session ran under a minute; error is
  // set when saving failed.
  interface FishtankSessionResult {
    locked: boolean;
    completed: boolean;
    commitMinutes: number | null;
    minutes: number;
    pointsEarned: number;
    saved: boolean;
    error: string | null;
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
    // 'darwin', 'win32', or 'linux'. Study-mode app blocking runs on the first two.
    platform: string;
    // Turns kiosk lockdown (strict mode) on/off. Turning it on starts a
    // session the user commits commitMinutes to. Resolves with the window's
    // actual kiosk state.
    lockDown(enabled: boolean, commitMinutes?: number): Promise<boolean>;
    // Starts a Focus session the user commits commitMinutes to. The window
    // fills the screen and notifications are silenced. When enforceWhitelist
    // is false, no other software may stay in front. When it is true, only
    // the study apps may. notificationsSilenced is false when macOS is missing
    // the Focus shortcuts, or Windows couldn't turn on Do Not Disturb.
    startStudy(commitMinutes: number, enforceWhitelist?: boolean): Promise<{ notificationsSilenced: boolean }>;
    // Resolves with the apps that are open right now, other than Fishtank.
    listRunningApps(): Promise<FishtankStudyApp[]>;
    // The apps the user may use in study mode. setAllowedApps resolves with
    // what was saved, and rejects during a study session.
    getAllowedApps(): Promise<FishtankStudyApp[]>;
    setAllowedApps(apps: FishtankStudyApp[]): Promise<FishtankStudyApp[]>;
    // Brings that study app to the front at its own window size. Resolves
    // false when it isn't one of the saved study apps or it can't be opened.
    focusStudyApp(appId: string): Promise<boolean>;
    // Brings the tank back to the front during Focus.
    showTank(): Promise<boolean>;
    // Grows the screen-edge bubble while its study-app list is open.
    setBubbleOpen(open: boolean, height?: number): void;
    // Calls back with the name of each app study mode sends to the back.
    // Returns a function that stops the calls.
    onStudyAppBlocked(callback: (appName: string) => void): () => void;
    // Ends the session, whichever mode it is: turns kiosk and study mode off
    // and adds the minutes it ran to the logged-in user's profile, and the
    // points too if it lasted the full commitment.
    endSession(): Promise<FishtankSessionResult>;
    // Creates an account. needsConfirmation is true when the user must confirm
    // their email before they can log in.
    createAccount(account: { username: string; email: string; password: string }): Promise<{ needsConfirmation: boolean }>;
    // Resolves with the profile for that uid, or null if there is none.
    getProfile(uid: string): Promise<FishtankProfile | null>;
    // Resolves with the user's points, or null if there is no such profile.
    getPoints(uid: string): Promise<number | null>;
    // TEMPORARY: adds points to the logged-in user's saved points if code is
    // right. Resolves with the new balance.
    redeemCode(code: string): Promise<number>;
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
    // Deletes the group, its members and its invites. Rejects unless the
    // logged-in user leads the group.
    deleteGroup(groupId: number): Promise<void>;
    // Takes the logged-in user out of the group. Rejects if they lead it or
    // aren't in it.
    leaveGroup(groupId: number): Promise<void>;
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
    // Runs a study skill with what its form collected: { prompt, groupId } for
    // 'group-study-plan', { noteIds } (the user's own notes) for
    // 'critique-notes', text for 'ask-question'. Resolves with Claude's
    // reply, plus the path of the PDF when the skill made one (it is saved to
    // Downloads and opened).
    runStudySkill(
      skillId: string,
      input: string | { prompt: string; groupId: number } | { noteIds: string[] },
    ): Promise<{ text: string; pdfPath?: string }>;
    // Resolves with the logged-in user's fish, oldest first.
    listFish(): Promise<FishtankOwnedFish[]>;
    // Buys a fish: takes the price off the user's saved points and adds the
    // fish to their tank in one step. Resolves with the new balance; rejects
    // (changing nothing) with e.g. "not enough points".
    buyFish(fishId: string, price: number): Promise<number>;
    // Puts one of the user's fish in the tank or takes it out.
    setFishInTank(fishId: string, inTank: boolean): Promise<void>;
    // Sets the avatar to one of the user's fish, or clears it with null.
    setAvatarFish(fishId: string | null): Promise<void>;
  }

  interface Window {
    // Undefined when the page runs outside Electron (e.g. in a plain browser).
    fishtank?: FishtankBridge;
  }
}
