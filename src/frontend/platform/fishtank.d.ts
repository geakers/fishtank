// Types for the API that src/desktop/preload.js exposes on `window`.
// Keep this in sync with preload.js.
export {};

declare global {
  interface FishtankBridge {
    // Turns kiosk lockdown on/off. Resolves with the window's actual kiosk state.
    lockDown(enabled: boolean): Promise<boolean>;
  }

  interface Window {
    // Undefined when the page runs outside Electron (e.g. in a plain browser).
    fishtank?: FishtankBridge;
  }
}
