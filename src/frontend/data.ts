// Body outline. 'slender' to 'deep' are side-on fish of increasing height.
export type FishBody = 'slender' | 'oval' | 'deep' | 'puffer' | 'jelly';
export type FishTail = 'forked' | 'rounded' | 'fan' | 'veil' | 'lyre';
// Dorsal and anal fins: 'short' rounded, 'spiny' long and low, 'flowing'
// long trailing (betta), 'sail' tall swept-back (angelfish).
export type FishFins = 'short' | 'spiny' | 'flowing' | 'sail';

// Markings are placed in body coordinates: x runs 0 (tail end) to 1 (snout),
// y runs -1 (back) to 1 (belly). They're clipped to the body outline.
export type FishMarking =
  // A vertical band at x, `width` wide, optionally outlined.
  | { kind: 'bar'; x: number; width: number; color: string; edge?: string }
  // A horizontal band at y from x `from` to `to`; `curve` bows it upward.
  | { kind: 'stripe'; y: number; width: number; from: number; to: number; color: string; curve?: number; glow?: boolean }
  // An irregular blotch.
  | { kind: 'patch'; x: number; y: number; r: number; color: string }
  // Small dots scattered over the back.
  | { kind: 'spots'; color: string };

// How FishSprite draws a fish: anatomy plus countershaded colors.
export interface FishLook {
  body: FishBody;
  tail: FishTail;
  fins: FishFins;
  // Darker back fading to a lighter belly.
  back: string;
  belly: string;
  fin: string;
  // Defaults to `fin`.
  tailColor?: string;
  // A darker margin on the fins and tail.
  finEdge?: string;
  // Iris color.
  eye?: string;
  markings?: FishMarking[];
  // Whiskers by the mouth, like a koi.
  barbels?: boolean;
}

export interface Fish {
  id: string;
  name: string;
  price: number;
  look: FishLook;
  // Multipliers around 1.0 for the aquarium.
  speed: number;
  size: number;
}

// The store catalog, in display order. To add a fish, add one entry here;
// the store, the aquarium and the avatar picker all read from this list.
export const FISH: Fish[] = [
  {
    id: 'bubble-guppy', name: 'Bubble Guppy', price: 50, speed: 1.2, size: 0.6,
    look: {
      body: 'slender', tail: 'fan', fins: 'short', back: '#9fa37a', belly: '#eef0e2', fin: '#ff8a3d', tailColor: '#ff6a3d', finEdge: '#ffd23f',
      markings: [{ kind: 'patch', x: 0.22, y: 0.1, r: 0.55, color: '#ff8a3d' }, { kind: 'patch', x: 0.4, y: -0.3, r: 0.3, color: '#3fb0ff' }],
    },
  },
  {
    id: 'neon-tetra', name: 'Neon Tetra', price: 50, speed: 1.4, size: 0.5,
    look: {
      body: 'slender', tail: 'forked', fins: 'short', back: '#56606b', belly: '#eef2f6', fin: '#e6eef5',
      markings: [
        { kind: 'stripe', y: 0.35, width: 0.6, from: 0, to: 0.55, color: '#ff2a45' },
        { kind: 'stripe', y: -0.12, width: 0.38, from: 0.12, to: 0.92, color: '#3ff3ff', glow: true },
      ],
    },
  },
  {
    id: 'zebra-danio', name: 'Zebra Danio', price: 60, speed: 1.5, size: 0.5,
    look: {
      body: 'slender', tail: 'forked', fins: 'short', back: '#cdbb84', belly: '#f6f2e4', fin: '#ece4cc',
      markings: [-0.42, -0.05, 0.32, 0.66].map((y) => ({ kind: 'stripe' as const, y, width: 0.17, from: 0, to: 0.86, color: '#2b3d7a' })),
    },
  },
  {
    id: 'goldfish', name: 'Goldfish', price: 80, speed: 0.9, size: 0.8,
    look: { body: 'oval', tail: 'veil', fins: 'short', back: '#e8650c', belly: '#ffc768', fin: '#ff9a2e', eye: '#f2c14e' },
  },
  {
    id: 'clownfish', name: 'Clownfish', price: 120, speed: 1.0, size: 0.8,
    look: {
      body: 'oval', tail: 'rounded', fins: 'spiny', back: '#f45d00', belly: '#ff9a3a', fin: '#ff7a10', finEdge: '#1a1a1a', eye: '#ff8a1a',
      markings: [
        { kind: 'bar', x: 0.78, width: 0.1, color: '#ffffff', edge: '#1a1a1a' },
        { kind: 'bar', x: 0.47, width: 0.12, color: '#ffffff', edge: '#1a1a1a' },
        { kind: 'bar', x: 0.06, width: 0.06, color: '#ffffff', edge: '#1a1a1a' },
      ],
    },
  },
  {
    id: 'blue-tang', name: 'Blue Tang', price: 120, speed: 1.1, size: 0.9,
    look: {
      body: 'deep', tail: 'lyre', fins: 'spiny', back: '#1d4fd6', belly: '#4a9bff', fin: '#1e3fae', tailColor: '#ffd23f', finEdge: '#0b0f2a',
      markings: [
        { kind: 'stripe', y: -0.35, width: 0.32, from: 0.08, to: 0.8, color: '#0b0f2a', curve: 0.35 },
        { kind: 'patch', x: 0.2, y: 0.05, r: 0.3, color: '#0b0f2a' },
      ],
    },
  },
  {
    id: 'betta', name: 'Betta', price: 150, speed: 0.7, size: 0.9,
    look: { body: 'oval', tail: 'veil', fins: 'flowing', back: '#9c0f45', belly: '#d8306b', fin: '#d81b60', finEdge: '#5a7dff' },
  },
  {
    id: 'angelfish', name: 'Angelfish', price: 200, speed: 0.8, size: 1.1,
    look: {
      body: 'deep', tail: 'lyre', fins: 'sail', back: '#cfd5e2', belly: '#f7f8fc', fin: '#dfe5f2', eye: '#d63a2f',
      markings: [0.82, 0.55, 0.26].map((x) => ({ kind: 'bar' as const, x, width: 0.07, color: '#2c2c44' })),
    },
  },
  {
    id: 'pufferfish', name: 'Pufferfish', price: 220, speed: 0.6, size: 1.0,
    look: { body: 'puffer', tail: 'rounded', fins: 'short', back: '#9a8a4a', belly: '#fbf7e6', fin: '#d4b25a', eye: '#3fb98a', markings: [{ kind: 'spots', color: '#3e3420' }] },
  },
  {
    id: 'koi', name: 'Sky Koi', price: 260, speed: 0.7, size: 1.3,
    look: {
      body: 'oval', tail: 'forked', fins: 'short', back: '#f4f2ee', belly: '#ffffff', fin: '#fbeae2', barbels: true,
      markings: [
        { kind: 'patch', x: 0.82, y: -0.35, r: 0.32, color: '#e8401c' },
        { kind: 'patch', x: 0.52, y: -0.25, r: 0.48, color: '#e8401c' },
        { kind: 'patch', x: 0.2, y: -0.1, r: 0.3, color: '#e8401c' },
        { kind: 'patch', x: 0.38, y: 0.1, r: 0.18, color: '#1d1d22' },
      ],
    },
  },
  {
    id: 'glass-jelly', name: 'Glass Jellyfish', price: 400, speed: 0.4, size: 1.2,
    look: { body: 'jelly', tail: 'rounded', fins: 'short', back: '#f3e3ff', belly: '#9d7bff', fin: '#c9b2ff' },
  },
];

export interface Stats {
  totalFocusMs: number;
  sessions: number;
  longestSessionMs: number;
  pointsEarned: number;
  streakDays: number;
  // toDateString() of the last finished session, used to count the streak.
  lastFocusDay: string | null;
  notes: number;
}

export const EMPTY_STATS: Stats = {
  totalFocusMs: 0,
  sessions: 0,
  longestSessionMs: 0,
  pointsEarned: 0,
  streakDays: 0,
  lastFocusDay: null,
  notes: 0,
};
