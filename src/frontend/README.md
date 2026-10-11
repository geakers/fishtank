# Fishtank frontend

React + TypeScript page that runs inside the Electron window (`src/desktop`). It reaches the database and the window only through `window.fishtank`. A logged-in account's name, points, study time, fish, study groups and notes come from the desktop app; session stats and display-name edits live in memory. A guest's fish and points live in memory too.

- `data.ts` — the fish catalog, fish prices and the stats shape.
- `useFishtank.ts` — app state and actions (account, points, fish, notes, focus sessions) in one hook.
- `views/screens/` — the home screen, the Fish Shop and the focus session screen. They render what `useFishtank` returns.
- `views/components/` — the pieces the screens are built from. `StudyGroups.tsx` and `StudyApps.tsx` load and save their own data through the bridge instead of going through the hook.
- `platform/fishtank.d.ts` — types for the `window.fishtank` bridge from `src/desktop/preload.js`.
- `theme/` — CSS.

Run with `npm run dev` (Vite + Electron) or `npm run dev:web` (browser only; focus sessions, accounts, groups and notes do nothing).
