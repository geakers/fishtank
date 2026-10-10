# Fishtank frontend

React + TypeScript page that runs inside the Electron window (`src/desktop`). The logged-in account's name, points and study time come from the desktop app; everything else lives in memory.

- `data.ts` — the fish catalog and the stats shape.
- `useFishtank.ts` — all app state and actions (points, fish, notes, lock-in) in one hook.
- `views/` — screens and components; they just render what `useFishtank` returns.
- `platform/fishtank.d.ts` — types for the `window.fishtank` bridge from `src/desktop/preload.js`.
- `theme/` — CSS.

Run with `npm run dev` (Vite + Electron) or `npm run dev:web` (browser only, lock-in and accounts do nothing).
