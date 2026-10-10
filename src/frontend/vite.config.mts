import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

const root = fileURLToPath(new URL('.', import.meta.url));

// In dev, React Fast Refresh injects an inline script and HMR uses a
// websocket, so the dev server relaxes the page's CSP. Builds keep the strict one.
function devContentSecurityPolicy(): Plugin {
  return {
    name: 'fishtank-dev-csp',
    apply: 'serve',
    transformIndexHtml: (html) =>
      html.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'; connect-src 'self' ws://localhost:*"),
  };
}

export default defineConfig({
  root,
  // Relative asset URLs so Electron can load the build from disk (file://).
  base: './',
  plugins: [react(), devContentSecurityPolicy()],
  build: {
    outDir: fileURLToPath(new URL('../../dist/frontend', import.meta.url)),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
