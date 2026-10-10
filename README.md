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
| `npm run dev:web` | Runs the front end alone in a browser. Lock-in and accounts do nothing there. |
| `npm run typecheck` | Type-checks the front end. |
| `npm test` | Runs every `.js` file in `tests/`. |

## How it fits together

The app has two halves that run in separate processes:

- **Desktop side** (`src/desktop`, `src/database`): plain Node.js code that runs in Electron's main process. It controls the window, talks to Supabase and holds the login session.
- **Front end** (`src/frontend`): the React page shown in the window. It cannot reach Supabase or the window directly.

The front end calls the desktop side through `window.fishtank`, a small set of functions defined in `src/desktop/preload.js`. To add one, write the function on the desktop side, register it with `ipcMain.handle` in `main.js`, expose it in `preload.js`, and add its type to `src/frontend/platform/fishtank.d.ts`.

### Project layout

```
src/
  db.js                 Supabase URL and public key
  database/accounts.js  Sign up, log in, refresh and log out calls
  desktop/
    main.js             Window, kiosk mode, session timing, IPC handlers
    preload.js          The window.fishtank bridge
    profiles.js         Reading and updating profile rows, points rules
    session.js          The saved login session
  frontend/             React UI (see src/frontend/README.md)
  mobile/               Empty placeholder
scripts/dev.mjs         Starts Vite and Electron together for npm run dev
tests/                  Tests, run with Node's built-in test runner
```

### The `window.fishtank` bridge

| Function | Returns |
| --- | --- |
| `lockDown(enabled)` | Turns kiosk mode on or off; resolves with the window's actual kiosk state. |
| `endSession()` | Ends the focus session and saves its minutes and points. Resolves with `{ locked, minutes, pointsEarned, saved, error }`. |
| `createAccount({ username, email, password })` | `{ needsConfirmation }` |
| `logIn({ email, password })` | The user: `{ uid, email, username }` |
| `logOut()` | Nothing. |
| `getCurrentUser()` | The logged-in user, or `null`. |
| `getProfile(uid)` | The user's `profiles` row, or `null`. |
| `getPoints(uid)` | The user's points, or `null`. |
| `verifyPoints(uid)` | `{ valid, points, minutesStudied, maxPoints }`, or `null`. |

## Accounts and login

Accounts use Supabase Auth with an email and password. The project has email confirmation switched on, so a new account cannot log in until its email is confirmed.

The login session is kept by `src/desktop/session.js`. It is saved to disk encrypted through the operating system's keychain, restored when the app starts, and renewed automatically, so a user stays logged in until they log out. The tokens never reach the front end.

## Points

A focus session starts when kiosk mode is switched on and ends with `endSession()`. Ending a session adds its whole minutes to the user's `minutes_studied` and 1/60 of a point per minute to their `points`, which is one point per hour. Nothing is saved if nobody is logged in.

`verifyPoints` checks that a user's points are no more than their minutes studied allow. The app trusts its own writes, so this catches a balance that was changed on its own, not deliberate tampering.

For testing, `TEST_POINT_PER_SECOND` at the top of `src/desktop/profiles.js` makes a session earn one point per second. Leave it `false` in anything you commit.

## Database

The Supabase project needs a `public.profiles` table with these columns:

| Column | Notes |
| --- | --- |
| `uid` | The user's id from Supabase Auth. |
| `username` | |
| `email` | |
| `created_at` | |
| `points` | Must be `numeric` to hold fractional points at the real rate. |
| `minutes_studied` | Whole minutes, default `0`. |

It also needs:

- **A signup trigger.** `on_auth_user_created` on `auth.users` creates the profile row for each new account, taking the username from the signup metadata. The app does not insert profiles itself.
- **Access rules.** A logged-in user must be able to read and update their own profile row.

## Known gaps

- Fish purchases, note rewards, the avatar, display-name edits and most stats are not saved.
- The shop's prices (50 to 400 points) and the study rate (one point per hour) have not been balanced against each other.
- Spending points is not implemented on the desktop side.
- There is one test, covering account creation against a faked Supabase.
