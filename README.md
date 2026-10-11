# Fish Lock

Fish Lock (F-Lock) is a study tool that locks you into focused work and rewards you for it. You commit to a length of time, F-Lock keeps you to your study apps until it's up, and finished sessions earn points for stocking an aquarium of fish. The look is Frutiger Aero, per the HackNC theme, and takes inspiration from the Wii for UI/UX design. 

> **Naming:** F-Lock is the project's new name. It hasn't reached the code yet: the desktop app is still called **Fishtank** and the phone apps **FocusFlip**.

F-Lock is an early prototype, built by a small team with help from Claude via Claude Code.

## What's in it

- **Committed focus sessions.** Choose a length up to 4 hours. Study mode keeps you to the apps you allow, and strict lock-in locks the whole screen. Only a session you finish earns points.
- **The aquarium.** 54 fish across six rarity tiers, each with its own body, fins, colours and markings, drawn as vector art rather than reused sprites. One lets you draw its pattern yourself. Buy fish with points, choose which swim in your tank, and pick one as your avatar.
- **Study groups.** Create a group, invite people by username, and share notes with it.
- **Notes.** Typed notes, PDFs and images, kept for yourself or shared with a group.
- **Study skills (AI).** Claude answers study questions, critiques how your notes are taken, and writes a study plan for a group from the notes its members have shared. Critiques and plans come back as PDFs.
- **Phone apps.** Android and iOS companions that run focus sessions on the same account.

## Architecture

| Part | Where | Built with |
| --- | --- | --- |
| Desktop app | `src/desktop`, `src/frontend` | Electron, React, TypeScript, Vite |
| Database and auth | `src/database`, `src/db.js` | Supabase (Postgres, Auth, Storage) |
| AI study skills | `src/desktop/claude.js`, `src/desktop/study-skills` | Claude API (`@anthropic-ai/sdk`) |
| Android app | `src/mobile` | Kotlin, Jetpack Compose |
| iOS app | `src/ios` | Swift, SwiftUI |

The desktop app runs in two processes:

- **Main process** (`src/desktop`). Owns the window, focus session timing, the login session and every call to Supabase and Claude. Secrets, tokens and the points rules stay here.
- **Renderer** (`src/frontend`). The React UI. It reaches the main process only through the `window.fishtank` bridge, defined in `src/desktop/preload.js` and typed in `src/frontend/platform/fishtank.d.ts`.

Point-bearing actions run in the main process or in the database, never in the UI. The main process times sessions itself, and `buy_fish` charges points and grants the fish in one transaction.

## Getting started

[Node.js](https://nodejs.org).

```
npm install
npm run dev
```

For the study skills, put an Anthropic API key in a `.env` file at the project root (it's git-ignored):

```
ANTHROPIC_API_KEY=sk-ant-...
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Runs the desktop app with hot reload. Changes in `src/desktop` need a restart. |
| `npm start` | Builds the UI, then runs the app from the build. |
| `npm run dev:web` | Runs the UI alone in a browser, with no sessions, accounts, groups or notes. |
| `npm run typecheck` | Type-checks the UI. |
| `npm test` | Runs the tests in `tests/` (Node's test runner, against a faked Supabase and Claude). |

The phone apps build separately: see `src/mobile/README.md` and `src/ios/README.md`.

## Focus sessions

| Mode | How it holds you | Platforms |
| --- | --- | --- |
| Study mode | Brings F-Lock back to the front whenever an app you didn't allow takes over. It can also turn on a Focus through two Shortcuts (`Fishtank Focus On` / `Off`) to silence notifications. | macOS |
| Strict lock-in | Kiosk mode: nothing else can be used until the session ends. | All desktops |
| Android | Full-screen flip-phone lock screen in 45-minute blocks, opening only your allowed apps. | Android |
| iOS | Screen Time (FamilyControls) blocks every app you didn't allow. Needs a paid Apple Developer account, so it's switched off in the build for now. | iOS |

**Points.** Every session adds the minutes it ran to your study time. A session that lasts its full commitment also earns points for the time committed: one point per hour. Ending early earns nothing. The rules live in `sessionEarnings` (`src/desktop/profiles.js`). The iOS app follows the same rules. The Android app runs fixed 45-minute blocks and records study time only.

## Database

Supabase is set up by running the SQL in `src/database` by hand in the SQL editor, in this order:

1. The `public.profiles` table (not in the repo): `uid`, `username`, `email`, `created_at`, `points` (numeric), `minutes_studied`, plus a signup trigger that creates the row and rules that let users read and update their own row.
2. `study-groups.sql`, `study-group-invites.sql`, `study-group-leave.sql`, `study-group-member-ids.sql`
3. `notes.sql`, which also creates the private storage bucket for note files
4. `owned-fish.sql`
5. `profiles-focus-ms.sql`, for the phone apps

`notes-delete-fixes.sql`, `owned-fish-fixes.sql` and `group-delete-notes.sql` only update databases set up from older versions of those files.

## Known gaps

- **Some settings aren't saved.** Display-name edits and session stats such as streaks are lost when the app closes.
- **Notes don't earn anything.** They aren't reviewed and don't earn points yet.
- **Test coverage is partial.** The tests cover the desktop's main process, not the UI or the SQL.
- **Assymetric OS Functionality.** The app runs noticeably better on MacOS and iOS with more errors on Windows and Android devices. 