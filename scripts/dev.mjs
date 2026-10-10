// `npm run dev`: starts the Vite dev server for src/frontend, then opens
// Electron pointed at it. Closing the Electron window stops both.
import { spawn } from 'node:child_process';
import electronPath from 'electron';
import { createServer } from 'vite';

const server = await createServer({ configFile: 'src/frontend/vite.config.mts' });
await server.listen();
const url = server.resolvedUrls?.local[0] ?? 'http://localhost:5173/';
server.printUrls();

// Some editors (e.g. VS Code) set ELECTRON_RUN_AS_NODE for child processes,
// which would start Electron as plain Node with no window.
const { ELECTRON_RUN_AS_NODE, ...env } = process.env;
const electron = spawn(electronPath, ['.'], {
  stdio: 'inherit',
  env: { ...env, FISHTANK_DEV_SERVER_URL: url },
});

electron.on('close', async (code) => {
  await server.close();
  process.exit(code ?? 0);
});
