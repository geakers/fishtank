# Fishtank

A desktop study app. You lock your screen into a focus session, and the time you study earns points for stocking a virtual aquarium.

Fishtank is an Electron app with a React front end and a Supabase database. It is an early prototype: accounts, focus sessions and study points are saved to the database, while the fish shop, notes and most stats still live in memory and reset when the app closes.

## Getting started

You need [Node.js](https://nodejs.org) (which includes npm). On a Mac with Homebrew, `brew install node` installs it.

```
npm install
npm run dev
```

`npm run dev` opens the app with hot reload, so front-end changes appear as you save. Changes under `src/desktop` or `src/database` need a restart.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Runs the app with hot reload. |
| `npm start` | Builds the front end, then runs the app from the build. |
| `npm run build` | Builds the front end into `dist/frontend`. |
| `npm run dev:web` | Runs the front end alone in a browser. Focus sessions, accounts, groups and notes do nothing there. |
| `npm run typecheck` | Type-checks the front end. |
| `npm test` | Runs every `.js` file in `tests/`. |

## What you can do

- **Focus.** Choose how long you commit to, and the big Focus button starts a study session of that length that keeps you to the apps you chose. Strict lock-in locks the whole screen to Fishtank instead. You only earn points if you stay for the whole session.
- **Keep fish.** Spend points in the Fish Shop, choose which fish swim in your tank, and pick one as your avatar.
- **Study in groups.** Create a study group, invite people by username, accept invites, leave a group, or delete one you lead.
- **Share notes.** Upload typed notes, PDFs and screenshots, either for yourself or to a study group.

Groups and notes need an account. Without one you are a guest: you can run sessions and buy fish, but nothing is saved.

## How it fits together

The app has two halves that run in separate processes:

- **Desktop side** (`src/desktop`, `src/database`): plain Node.js code that runs in Electron's main process. It controls the window, talks to Supabase and holds the login session.
- **Front end** (`src/frontend`): the React page shown in the window. It cannot reach Supabase or the window directly.

The front end calls the desktop side through `window.fishtank`, a set of functions defined in `src/desktop/preload.js`. To add one, write the function on the desktop side, register it with `ipcMain.handle` in `main.js`, expose it in `preload.js`, and add its type to `src/frontend/platform/fishtank.d.ts`.

### Project layout

```
src/
  db.js                 Supabase URL and public key
  database/
    accounts.js         Sign up, log in, refresh and log out calls
    *.sql               Database setup, run by hand in Supabase (see Database)
  desktop/
    main.js             Window, kiosk mode, session timing, IPC handlers
    preload.js          The window.fishtank bridge
    session.js          The saved login session
    supabase.js         Sends requests to Supabase as the logged-in user
    profiles.js         Reading and updating profile rows, points rules
    study-mode.js       Study mode: study apps, front-app watching, notifications
    fish.js             Owned fish, buying, the tank and the avatar
    groups.js           Study groups, members and invites
    notes.js            Study notes and their files
  frontend/             React UI (see src/frontend/README.md)
  mobile/               FocusFlip, the Android companion app (see src/mobile/README.md)
  ios/                  FocusFlip for iPhone (see src/ios/README.md)
scripts/dev.mjs         Starts Vite and Electron together for npm run dev
tests/                  Tests, run with Node's built-in test runner
```

### The `window.fishtank` bridge

Every function returns a promise except `onStudyAppBlocked`. Calls that need an account reject with "Log in first" when nobody is logged in.

**Focus sessions**

| Function | Returns |
| --- | --- |
| `startStudy(commitMinutes)` | Starts study mode for a session the user commits `commitMinutes` to. Resolves with `{ notificationsSilenced }`. |
| `lockDown(enabled, commitMinutes)` | Turns kiosk mode (strict lock-in) on or off; turning it on starts a session the user commits `commitMinutes` to. Resolves with the window's actual kiosk state. |
| `endSession()` | Ends the session, whichever mode it is, and saves its minutes, and its points if it lasted the full commitment. Resolves with `{ locked, completed, commitMinutes, minutes, pointsEarned, saved, error }`. |
| `listRunningApps()` | The apps open right now, as `[{ id, name }]`. |
| `getAllowedApps()` | The user's study apps, as `[{ id, name }]`. |
| `setAllowedApps(apps)` | Saves the study apps and resolves with what was saved. Rejects during a study session. |
| `onStudyAppBlocked(callback)` | Calls back with the name of each app study mode sends to the back. Returns a function that stops the calls. |

**Accounts and points**

| Function | Returns |
| --- | --- |
| `createAccount({ username, email, password })` | `{ needsConfirmation }` |
| `logIn({ email, password })` | The user: `{ uid, email, username }` |
| `logOut()` | Nothing. |
| `getCurrentUser()` | The logged-in user, or `null`. |
| `getProfile(uid)` | The user's `profiles` row, or `null`. |
| `getPoints(uid)` | The user's points, or `null`. |
| `verifyPoints(uid)` | `{ valid, points, minutesStudied, maxPoints }`, or `null`. |

**Fish**

| Function | Returns |
| --- | --- |
| `listFish()` | The user's fish, as `[{ fish_id, in_tank, adopted_at }]`. |
| `buyFish(fishId, price)` | Takes the price off the user's points and adds the fish. Resolves with the new balance. |
| `setFishInTank(fishId, inTank)` | Nothing. |
| `setAvatarFish(fishId)` | Nothing. Pass `null` to clear the avatar. |

**Study groups**

| Function | Returns |
| --- | --- |
| `createGroup(name)` | The new group: `{ id, name, leader_id }` |
| `listGroups()` | The groups the user leads or is in. |
| `deleteGroup(groupId)` | Nothing. Leader only. |
| `leaveGroup(groupId)` | Nothing. Members only; the leader deletes the group instead. |
| `groupRoster(groupId)` | Everyone in the group, as `[{ username, role }]`. |
| `searchUsernames(query)` | Up to 10 matching usernames. |
| `inviteMember(groupId, username)` | Nothing. Leader only. The person joins once they accept. |
| `listInvites()` | The user's unanswered invites, as `[{ group_id, group_name, leader }]`. |
| `acceptInvite(groupId)`, `declineInvite(groupId)` | Nothing. |
| `groupInvites(groupId)` | Usernames invited to the group who have not answered. Empty unless the user leads it. |
| `addMember(groupId, username)` | Nothing. Adds someone with no invite. The app does not use it. |

**Notes**

| Function | Returns |
| --- | --- |
| `listNotes()` | The notes the user can see, newest first, each with its files. |
| `submitNote({ title, body, groupId, files })` | The new note's id. `groupId` is `null` for a personal note. |
| `deleteNote(noteId)` | Nothing. Deletes one of the user's own notes and its files. |
| `openNoteFile(storagePath)` | Nothing. Opens the file in the default browser or viewer. |

## Accounts and login

Accounts use Supabase Auth with an email and password. The project has email confirmation switched on, so a new account cannot log in until its email is confirmed.

The login session is kept by `src/desktop/session.js`. It is saved to disk encrypted through the operating system's keychain, restored when the app starts, and renewed automatically, so a user stays logged in until they log out. The tokens never reach the front end.

## Focus sessions

Every session starts by asking how long the user commits to: 15, 25, 45, 60 or 90 minutes, or any whole number of minutes from 1 to 240. The screen counts down, and the session ends by itself when the time is up. Ending it early asks first, and earns no points (see Points).

There are two kinds of session. Both run the same timer and earn the same points.

**Study mode** is what the Focus button starts. It is the softer one:

- The window grows to fill the screen without going full screen, and goes back to its old size when the session ends.
- Once a second it checks which app is in front. If that app is not Fishtank or one of your study apps, Fishtank comes back to the front and tells you which app it sent away.
- You choose your study apps from the Study apps button on the home screen. The list shows the apps that are open, is saved on your computer, and cannot be changed during a session.
- It can silence notifications, with some setup. macOS does not let an app switch notifications off, so study mode runs two shortcuts you make in the Shortcuts app: `Fishtank Focus On` when a session starts and `Fishtank Focus Off` when it ends. Each should turn a Focus on or off. Without them the session still runs and the screen says notifications are still on.

Study mode only works on macOS. It reads the front app with `lsappinfo` and runs shortcuts with `shortcuts`, and both come with macOS. On Windows and Linux the timer runs but no app is ever sent away.

**Strict lock-in** puts the window in kiosk mode, so nothing else can be used until you end the session.

## Points

A session starts when study mode or kiosk mode is switched on, with the minutes the user committed to, and ends with `endSession()`. The rules are `sessionEarnings` in `src/desktop/profiles.js`, and the mobile apps follow the same ones:

- Every session adds the whole minutes it ran to the user's `minutes_studied`.
- Only a session that lasted its full commitment earns points: 1/60 of a point per committed minute, which is one point per hour. Running past the commitment earns no more, and ending early earns nothing.

The main process keeps its own start time and commitment, so the front end can't claim a session ran longer than it did. Nothing is saved if nobody is logged in.

`verifyPoints` checks that a user's points are no more than their minutes studied allow. The app trusts its own writes, so this catches a balance that was changed on its own, not deliberate tampering.

For testing, `TEST_POINT_PER_SECOND` at the top of `src/desktop/profiles.js` makes a session earn one point per second. It is currently `true`. Set it to `false` for the real rate.

## Fish

The catalog of 47 fish lives in `src/frontend/data.ts`. Prices run from 200 to 110,000 points and grow with rarity.

For a logged-in user, buying a fish calls `buy_fish` in the database, which takes the points and adds the fish in one step. You never pay without getting the fish, and you cannot own the same fish twice. Which fish are in the tank and which one is your avatar are saved too.

A guest starts with 100,000 points and can buy fish, but their tank lasts only until the app closes.

## Study groups

Study groups live in the Groups tab on the home screen. The search box at the top filters your groups and finds people by username, and the + button creates a group. Whoever creates a group is its leader.

Clicking a group drops down the people in it. What you can do there depends on who you are:

- **The leader** sees who has been invited but has not answered, can invite more people with Add, and can delete the group.
- **A member** can leave the group. To come back, the leader has to invite them again.

Invites wait at the top of the panel until you accept or decline. The panel checks for new invites every 30 seconds.

You only ever see groups you lead or are in, so there is no way to find someone else's group and ask to join.

## Notes

Notes live in the Notes tab on the home screen, and each group's drop-down shows the notes shared with it.

A note has a title and typed text, files, or both. A note with no files needs at least 20 characters of text. Files can be PDFs or images (PNG, JPEG, WebP, GIF), up to 10 files of 10 MB each. A note is either personal or shared with one of your study groups, where everyone in the group can see it.

Files are kept in a private Supabase storage bucket and opened through a link that works for 5 minutes. Deleting a note deletes its files. You can only delete your own notes.

Notes do not earn points yet.

## Database

The database is set up by running the SQL files in `src/database` by hand, in the Supabase SQL editor. Run them in this order:

| File | What it sets up |
| --- | --- |
| (not in the repo) | The `public.profiles` table, described below. |
| `study-groups.sql` | Study groups, members, the roster and username search. |
| `study-group-invites.sql` | Invites to study groups. |
| `study-group-leave.sql` | Lets members leave a group. |
| `notes.sql` | Notes, their files and the storage bucket. |
| `owned-fish.sql` | Owned fish, `buy_fish` and the avatar. |

`notes-delete-fixes.sql` is only for a database that was set up from an older `notes.sql`. New setups do not need it.

The `public.profiles` table needs these columns:

| Column | Notes |
| --- | --- |
| `uid` | The user's id from Supabase Auth. |
| `username` | |
| `email` | |
| `created_at` | |
| `points` | Must be `numeric` to hold fractional points at the real rate. |
| `minutes_studied` | Whole minutes, default `0`. |
| `avatar_fish_id` | Added by `owned-fish.sql`. One of the user's own fish, or empty. |

It also needs:

- **A signup trigger.** `on_auth_user_created` on `auth.users` creates the profile row for each new account, taking the username from the signup metadata. The app does not insert profiles itself.
- **Access rules.** A logged-in user must be able to read and update their own profile row.

## Known gaps

- `TEST_POINT_PER_SECOND` is switched on, so sessions earn one point per second.
- Pressing P gives 1,000 free points for testing. They are not saved.
- Display-name edits and session stats (streak, session count, longest session) are not saved.
- Fish prices (200 to 110,000 points) and the study rate (one point per hour) have not been balanced against each other.
- `buy_fish` takes the price from the app, so the database does not check it against the catalog.
- Study mode only works on macOS, and gives no warning elsewhere.
- Study mode is easy to get around: you can quit Fishtank. Strict lock-in is the one that holds you.
- Notes are not reviewed and earn no points. `notes.sql` leaves room for a later step that does both.
- The tests cover the desktop side against a faked Supabase. Nothing tests the front end or the SQL.
