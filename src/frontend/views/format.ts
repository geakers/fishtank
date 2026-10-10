// Display formatting only. No rules live here.

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

// 4_500_000 -> "1h 15m", 1_500_000 -> "25m", 30_000 -> "30s"
export function formatDuration(ms: number): string {
  if (ms < MINUTE) return `${Math.floor(ms / 1000)}s`;
  const hours = Math.floor(ms / HOUR);
  const minutes = Math.floor((ms % HOUR) / MINUTE);
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}

// Stopwatch style: "25:03" or "1:02:03"
export function formatClock(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = String(m).padStart(h > 0 ? 2 : 1, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatPoints(points: number): string {
  return points.toLocaleString();
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Small deterministic hash, so random-looking layouts stay stable between renders.
export function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
