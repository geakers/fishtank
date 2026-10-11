// Body outline. 'slender' to 'deep' are side-on fish of increasing height;
// 'shark' is long with a pointed snout and gill slits. 'dolphin' is long and
// smooth with a rounded forehead and a short beak. 'human' is a person
// swimming front crawl (back = skin, belly = trunks, fin = swim cap).
// 'none' draws nothing.
export type FishBody = 'slender' | 'oval' | 'deep' | 'puffer' | 'shark' | 'dolphin' | 'jelly' | 'human' | 'none';
// 'shark' has a long upper lobe and a short lower one. 'flukes' is a
// dolphin's smooth crescent, without fin rays.
export type FishTail = 'forked' | 'rounded' | 'fan' | 'veil' | 'lyre' | 'shark' | 'flukes';
// Dorsal and anal fins: 'short' rounded, 'spiny' long and low, 'flowing'
// long trailing (betta), 'sail' tall swept-back (angelfish), 'shark' one
// tall triangular dorsal with big pectorals, 'dolphin' one hooked dorsal and
// a flipper, without fin rays.
export type FishFins = 'short' | 'spiny' | 'flowing' | 'sail' | 'shark' | 'dolphin';
// Surface finish: 'scales' (default), 'smooth' skin, or 'metal' plating.
export type FishSkin = 'scales' | 'smooth' | 'metal';

// Extra features drawn on top of the anatomy.
export type FishExtra =
  // Pointed cat ears, a pink nose and long whiskers.
  | 'cat'
  // Long drooping barbels, like a catfish.
  | 'whiskers'
  // An antenna with a blinking light and a glowing eye, for robots.
  | 'robot'
  // A black hood with an eye slit and a red headband with trailing ties.
  | 'ninja'
  // Twinkling glints, for golden fish.
  | 'sparkle'
  // Lunar New Year luck: long dragon whiskers and a gold 福 charm.
  | 'lucky'
  // Stars and stripes: the US flag across the body.
  | 'flag'
  // A slowly turning starburst on the side.
  | 'spark'
  // A slowly turning knot of six interlocking loops on the side.
  | 'knot'
  // A band of navy argyle diamonds along the side, like UNC's uniforms.
  | 'argyle'
  // Salmon nigiri: white fat lines across the salmon back, rice grains on
  // the belly and a strip of nori round the middle.
  | 'sushi'
  // A pickup truck: cab window, grille, headlight, a FISH-150 badge and two
  // spinning wheels.
  | 'truck'
  // A blank fish for the user to draw on; shows their drawing (see
  // CustomArtContext in FishSprite.tsx).
  | 'canvas';

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
  skin?: FishSkin;
  extras?: FishExtra[];
}

// Rarer, more unusual fish cost more; see fishPrice.
export type FishTier = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';
export const TIERS: FishTier[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];

export interface Fish {
  id: string;
  name: string;
  tier: FishTier;
  // Set from the fish's tier and its place within it; see fishPrice.
  price: number;
  look: FishLook;
  // Multipliers around 1.0 for the aquarium.
  speed: number;
  size: number;
}

// Price grows exponentially with rarity: each tier costs TIER_GROWTH times
// the one below it, and fish within a tier step up gently in catalog order.
// Prices are rounded to two significant figures so they read cleanly.
const BASE_PRICE = 200;
const TIER_GROWTH = 3.5;
const RANK_GROWTH = 1.1;

function fishPrice(tier: FishTier, rankInTier: number): number {
  const raw = BASE_PRICE * TIER_GROWTH ** TIERS.indexOf(tier) * RANK_GROWTH ** rankInTier;
  const step = 10 ** Math.max(Math.floor(Math.log10(raw)) - 1, 0);
  return Math.round(raw / step) * step;
}

// The store catalog, grouped by tier from most ordinary to most unusual. To
// add a fish, give it a tier and put it in that group; the more special it
// is, the later it goes. The store, the aquarium and the avatar picker all
// read from this list.
const CATALOG: Omit<Fish, 'price'>[] = [
  // ---- Common ----
  {
    id: 'bubble-guppy', name: 'Bubble Guppy', tier: 'common', speed: 1.2, size: 0.6,
    look: {
      body: 'slender', tail: 'fan', fins: 'short', back: '#9fa37a', belly: '#eef0e2', fin: '#ff8a3d', tailColor: '#ff6a3d', finEdge: '#ffd23f',
      markings: [{ kind: 'patch', x: 0.22, y: 0.1, r: 0.55, color: '#ff8a3d' }, { kind: 'patch', x: 0.4, y: -0.3, r: 0.3, color: '#3fb0ff' }],
    },
  },
  {
    id: 'neon-tetra', name: 'Neon Tetra', tier: 'common', speed: 1.4, size: 0.5,
    look: {
      body: 'slender', tail: 'forked', fins: 'short', back: '#56606b', belly: '#eef2f6', fin: '#e6eef5',
      markings: [
        { kind: 'stripe', y: 0.35, width: 0.6, from: 0, to: 0.55, color: '#ff2a45' },
        { kind: 'stripe', y: -0.12, width: 0.38, from: 0.12, to: 0.92, color: '#3ff3ff', glow: true },
      ],
    },
  },
  {
    id: 'ember-tetra', name: 'Ember Tetra', tier: 'common', speed: 1.4, size: 0.45,
    look: { body: 'slender', tail: 'forked', fins: 'short', back: '#ff6a1a', belly: '#ffb070', fin: '#ff8a3a', tailColor: '#ff5a10', eye: '#ff7a2a' },
  },
  {
    id: 'cherry-barb', name: 'Cherry Barb', tier: 'common', speed: 1.3, size: 0.55,
    look: {
      body: 'slender', tail: 'forked', fins: 'short', back: '#b8283a', belly: '#ff7a6a', fin: '#e8404a', finEdge: '#3a0f14',
      markings: [{ kind: 'stripe', y: 0.05, width: 0.22, from: 0.05, to: 0.85, color: '#6a1420' }],
    },
  },
  {
    id: 'white-cloud', name: 'White Cloud Minnow', tier: 'common', speed: 1.5, size: 0.45,
    look: {
      body: 'slender', tail: 'forked', fins: 'short', back: '#7a8a6a', belly: '#f2efe0', fin: '#ff5a4a', finEdge: '#fff4d0',
      markings: [{ kind: 'stripe', y: -0.05, width: 0.16, from: 0.05, to: 0.85, color: '#ffe8a0', glow: true }],
    },
  },
  {
    id: 'zebra-danio', name: 'Zebra Danio', tier: 'common', speed: 1.5, size: 0.5,
    look: {
      body: 'slender', tail: 'forked', fins: 'short', back: '#cdbb84', belly: '#f6f2e4', fin: '#ece4cc',
      markings: [-0.42, -0.05, 0.32, 0.66].map((y) => ({ kind: 'stripe' as const, y, width: 0.17, from: 0, to: 0.86, color: '#2b3d7a' })),
    },
  },
  {
    id: 'platy', name: 'Sunset Platy', tier: 'common', speed: 1.1, size: 0.6,
    look: { body: 'oval', tail: 'rounded', fins: 'short', back: '#ffb020', belly: '#ffe680', fin: '#ff6a2a', tailColor: '#e8401c', eye: '#3a2a1a' },
  },
  {
    id: 'harlequin-rasbora', name: 'Harlequin Rasbora', tier: 'common', speed: 1.3, size: 0.55,
    look: {
      body: 'slender', tail: 'forked', fins: 'short', back: '#d87a4a', belly: '#ffd4b0', fin: '#ff9a6a', tailColor: '#ff7a4a',
      markings: [{ kind: 'patch', x: 0.3, y: 0.05, r: 0.55, color: '#1a1420' }],
    },
  },
  {
    id: 'rummy-nose', name: 'Rummy-Nose Tetra', tier: 'common', speed: 1.4, size: 0.5,
    look: {
      body: 'slender', tail: 'forked', fins: 'short', back: '#b8c0c8', belly: '#f4f6f8', fin: '#e8eef4', tailColor: '#f4f6f8',
      markings: [{ kind: 'patch', x: 0.92, y: 0, r: 0.6, color: '#e8202a' }, { kind: 'bar', x: 0.04, width: 0.05, color: '#1a1a1a' }],
    },
  },
  {
    id: 'goldfish', name: 'Goldfish', tier: 'common', speed: 0.9, size: 0.8,
    look: { body: 'oval', tail: 'veil', fins: 'short', back: '#e8650c', belly: '#ffc768', fin: '#ff9a2e', eye: '#f2c14e' },
  },
  // ---- Uncommon ----
  {
    id: 'tiger-barb', name: 'Tiger Barb', tier: 'uncommon', speed: 1.3, size: 0.6,
    look: {
      body: 'oval', tail: 'forked', fins: 'short', back: '#d8a43a', belly: '#fff0c0', fin: '#ff4a2a', finEdge: '#1a1a1a', eye: '#ff6a3a',
      markings: [0.86, 0.6, 0.34, 0.08].map((x) => ({ kind: 'bar' as const, x, width: 0.08, color: '#1a1a1a' })),
    },
  },
  {
    id: 'black-molly', name: 'Black Molly', tier: 'uncommon', speed: 1.0, size: 0.7,
    look: { body: 'oval', tail: 'fan', fins: 'short', back: '#141418', belly: '#3a3a46', fin: '#24242c', finEdge: '#ffd23f', eye: '#ffd23f' },
  },
  {
    id: 'bumblebee-goby', name: 'Bumblebee Goby', tier: 'uncommon', speed: 1.0, size: 0.45,
    look: {
      body: 'oval', tail: 'rounded', fins: 'short', back: '#ffd21a', belly: '#ffe86a', fin: '#2a2420', eye: '#ffd21a',
      markings: [0.82, 0.56, 0.3, 0.06].map((x) => ({ kind: 'bar' as const, x, width: 0.12, color: '#1e1a16' })),
    },
  },
  {
    id: 'blue-damsel', name: 'Blue Damselfish', tier: 'uncommon', speed: 1.3, size: 0.6,
    look: { body: 'oval', tail: 'forked', fins: 'spiny', back: '#1a4aff', belly: '#4a9bff', fin: '#2a6aff', tailColor: '#ffd23f', eye: '#1a1a3a' },
  },
  {
    id: 'sergeant-major', name: 'Sergeant Major', tier: 'uncommon', speed: 1.1, size: 0.75,
    look: {
      body: 'deep', tail: 'forked', fins: 'spiny', back: '#e8d24a', belly: '#f4f6f8', fin: '#d8dcc0',
      markings: [0.78, 0.6, 0.42, 0.24, 0.08].map((x) => ({ kind: 'bar' as const, x, width: 0.07, color: '#1e2a2a' })),
    },
  },
  {
    id: 'dwarf-gourami', name: 'Dwarf Gourami', tier: 'uncommon', speed: 0.9, size: 0.75,
    look: {
      body: 'deep', tail: 'rounded', fins: 'spiny', back: '#d8402a', belly: '#ff8a5a', fin: '#3a7aff', finEdge: '#d8402a',
      markings: [0.82, 0.66, 0.5, 0.34, 0.18].map((x) => ({ kind: 'bar' as const, x, width: 0.06, color: '#4a9bff' })),
    },
  },
  {
    id: 'pearl-gourami', name: 'Pearl Gourami', tier: 'uncommon', speed: 0.9, size: 0.75,
    look: {
      body: 'deep', tail: 'rounded', fins: 'spiny', back: '#8a7a6a', belly: '#ff8a4a', fin: '#c8b8a8', eye: '#c84a2a',
      markings: [
        { kind: 'stripe', y: 0.1, width: 0.12, from: 0.05, to: 0.85, color: '#2a2420' },
        { kind: 'spots', color: '#fff6e8' },
      ],
    },
  },
  {
    id: 'clownfish', name: 'Clownfish', tier: 'uncommon', speed: 1.0, size: 0.8,
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
    id: 'catfish', name: 'Catfish', tier: 'uncommon', speed: 0.7, size: 1.0,
    look: {
      body: 'slender', tail: 'forked', fins: 'short', skin: 'smooth', back: '#5a5448', belly: '#e8e0cc', fin: '#7a6e5a', eye: '#d8c890',
      extras: ['whiskers'],
      markings: [{ kind: 'spots', color: '#2a261e' }],
    },
  },
  // ---- Rare ----
  {
    id: 'blue-tang', name: 'Blue Tang', tier: 'rare', speed: 1.1, size: 0.9,
    look: {
      body: 'deep', tail: 'lyre', fins: 'spiny', back: '#1d4fd6', belly: '#4a9bff', fin: '#1e3fae', tailColor: '#ffd23f', finEdge: '#0b0f2a',
      markings: [
        { kind: 'stripe', y: -0.35, width: 0.32, from: 0.08, to: 0.8, color: '#0b0f2a', curve: 0.35 },
        { kind: 'patch', x: 0.2, y: 0.05, r: 0.3, color: '#0b0f2a' },
      ],
    },
  },
  {
    id: 'yellow-tang', name: 'Yellow Tang', tier: 'rare', speed: 1.1, size: 0.9,
    look: { body: 'deep', tail: 'lyre', fins: 'spiny', back: '#ffd000', belly: '#fff15a', fin: '#ffdc2a', eye: '#1a1a1a', markings: [{ kind: 'patch', x: 0.05, y: 0, r: 0.12, color: '#ffffff' }] },
  },
  {
    id: 'rainbowfish', name: 'Boeseman Rainbowfish', tier: 'rare', speed: 1.2, size: 0.75,
    look: {
      body: 'deep', tail: 'forked', fins: 'spiny', back: '#3a5ac8', belly: '#ff8a1a', fin: '#ff9a3a', tailColor: '#ff7a1a', finEdge: '#3a5ac8',
      markings: [{ kind: 'patch', x: 0.2, y: 0.3, r: 0.75, color: '#ff8a1a' }],
    },
  },
  {
    id: 'betta', name: 'Betta', tier: 'rare', speed: 0.7, size: 0.9,
    look: { body: 'oval', tail: 'veil', fins: 'flowing', back: '#9c0f45', belly: '#d8306b', fin: '#d81b60', finEdge: '#5a7dff' },
  },
  {
    id: 'royal-gramma', name: 'Royal Gramma', tier: 'rare', speed: 1.0, size: 0.7,
    look: {
      body: 'oval', tail: 'rounded', fins: 'spiny', back: '#ffc81a', belly: '#ffe060', fin: '#ffc81a', tailColor: '#ffb800', eye: '#1a1a1a',
      markings: [{ kind: 'patch', x: 0.82, y: 0, r: 1.0, color: '#9a2adc' }, { kind: 'patch', x: 0.6, y: 0, r: 0.75, color: '#9a2adc' }],
    },
  },
  {
    id: 'angelfish', name: 'Angelfish', tier: 'rare', speed: 0.8, size: 1.1,
    look: {
      body: 'deep', tail: 'lyre', fins: 'sail', back: '#cfd5e2', belly: '#f7f8fc', fin: '#dfe5f2', eye: '#d63a2f',
      markings: [0.82, 0.55, 0.26].map((x) => ({ kind: 'bar' as const, x, width: 0.07, color: '#2c2c44' })),
    },
  },
  {
    id: 'oscar', name: 'Tiger Oscar', tier: 'rare', speed: 0.8, size: 1.1,
    look: {
      body: 'oval', tail: 'rounded', fins: 'spiny', back: '#2a2a2a', belly: '#4a3a2a', fin: '#3a3028', eye: '#ff6a1a',
      markings: [
        { kind: 'patch', x: 0.6, y: 0.1, r: 0.4, color: '#ff7a1a' },
        { kind: 'patch', x: 0.35, y: -0.2, r: 0.35, color: '#ff7a1a' },
        { kind: 'patch', x: 0.08, y: 0, r: 0.25, color: '#ff5a1a' },
      ],
    },
  },
  {
    id: 'pufferfish', name: 'Pufferfish', tier: 'rare', speed: 0.6, size: 1.0,
    look: { body: 'puffer', tail: 'rounded', fins: 'short', back: '#9a8a4a', belly: '#fbf7e6', fin: '#d4b25a', eye: '#3fb98a', markings: [{ kind: 'spots', color: '#3e3420' }] },
  },
  {
    id: 'moon-jelly', name: 'Moon Jelly', tier: 'rare', speed: 0.45, size: 1.0,
    look: { body: 'jelly', tail: 'rounded', fins: 'short', back: '#e6f6ff', belly: '#7ac8ff', fin: '#b0e0ff' },
  },
  {
    id: 'dolphin', name: 'Bottlenose Dolphin', tier: 'rare', speed: 1.5, size: 1.4,
    look: { body: 'dolphin', tail: 'flukes', fins: 'dolphin', skin: 'smooth', back: '#6e8698', belly: '#eef2f5', fin: '#62798b', eye: '#1a2228' },
  },
  {
    // Plain white, ready to draw on in the Fish Shop.
    id: 'canvas-fish', name: 'Canvas Fish', tier: 'rare', speed: 1.0, size: 1.1,
    look: {
      body: 'oval', tail: 'rounded', fins: 'short', skin: 'smooth', back: '#ffffff', belly: '#f2f4f6', fin: '#f4f6f8', finEdge: '#c4ccd4', eye: '#2a2a2a',
      extras: ['canvas'],
    },
  },
  // ---- Epic ----
  {
    id: 'koi', name: 'Sky Koi', tier: 'epic', speed: 0.7, size: 1.3,
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
    id: 'butterflyfish', name: 'Copperband Butterflyfish', tier: 'epic', speed: 0.9, size: 0.9,
    look: {
      body: 'deep', tail: 'rounded', fins: 'spiny', back: '#f4f2ec', belly: '#ffffff', fin: '#f2ece0', finEdge: '#1a1a1a', eye: '#1a1a1a',
      markings: [
        ...[0.86, 0.6, 0.34].map((x) => ({ kind: 'bar' as const, x, width: 0.11, color: '#ff8a1a', edge: '#1a1a1a' })),
        { kind: 'patch', x: 0.2, y: -0.55, r: 0.15, color: '#1a1a1a' },
      ],
    },
  },
  {
    id: 'mandarin-dragonet', name: 'Mandarin Dragonet', tier: 'epic', speed: 0.8, size: 0.75,
    look: {
      body: 'oval', tail: 'rounded', fins: 'spiny', back: '#1a5ad8', belly: '#3a8aff', fin: '#ff7a1a', finEdge: '#1a3a9a', eye: '#ff8a1a',
      markings: [
        { kind: 'stripe', y: -0.5, width: 0.22, from: 0.05, to: 0.9, color: '#ff7a1a', curve: 0.2 },
        { kind: 'stripe', y: 0.05, width: 0.22, from: 0, to: 0.85, color: '#ff7a1a', curve: -0.15 },
        { kind: 'stripe', y: 0.55, width: 0.2, from: 0.1, to: 0.8, color: '#ff7a1a', curve: 0.2 },
      ],
    },
  },
  {
    id: 'discus', name: 'Red Discus', tier: 'epic', speed: 0.7, size: 1.0,
    look: {
      body: 'deep', tail: 'rounded', fins: 'spiny', back: '#c8282a', belly: '#ff6a4a', fin: '#d8402a', finEdge: '#3ac8ff', eye: '#ff2a2a',
      markings: [-0.55, -0.2, 0.15, 0.5].map((y, i) => ({ kind: 'stripe' as const, y, width: 0.1, from: 0.05, to: 0.9, color: '#5ad8ff', curve: i % 2 ? -0.12 : 0.12 })),
    },
  },
  {
    id: 'moorish-idol', name: 'Moorish Idol', tier: 'epic', speed: 0.9, size: 1.1,
    look: {
      body: 'deep', tail: 'lyre', fins: 'sail', back: '#f2f0e8', belly: '#ffffff', fin: '#f6e9a0', tailColor: '#1a1a1a', eye: '#1a1a1a',
      markings: [
        { kind: 'bar', x: 0.72, width: 0.2, color: '#1a1a1a' },
        { kind: 'bar', x: 0.3, width: 0.16, color: '#1a1a1a' },
        { kind: 'patch', x: 0.48, y: -0.2, r: 0.4, color: '#ffd23f' },
      ],
    },
  },
  {
    id: 'lionfish', name: 'Lionfish', tier: 'epic', speed: 0.6, size: 1.2,
    look: {
      body: 'oval', tail: 'rounded', fins: 'sail', back: '#a8281e', belly: '#ffe6d8', fin: '#ffd0c0', finEdge: '#a8281e', eye: '#ff4a2a',
      markings: [0.88, 0.72, 0.56, 0.4, 0.24, 0.08].map((x) => ({ kind: 'bar' as const, x, width: 0.06, color: '#fff4ec' })),
    },
  },
  {
    id: 'glass-jelly', name: 'Glass Jellyfish', tier: 'epic', speed: 0.4, size: 1.2,
    look: { body: 'jelly', tail: 'rounded', fins: 'short', back: '#f3e3ff', belly: '#9d7bff', fin: '#c9b2ff' },
  },
  {
    id: 'lucky-dragon-carp', name: 'Lucky Dragon Carp', tier: 'epic', speed: 0.8, size: 1.1,
    look: {
      body: 'oval', tail: 'veil', fins: 'flowing', back: '#c8101e', belly: '#ff7a3a', fin: '#ffc83a', tailColor: '#ffb020', finEdge: '#fff0a0', eye: '#ffd040',
      extras: ['lucky'],
      markings: [{ kind: 'stripe', y: -0.55, width: 0.18, from: 0.12, to: 0.8, color: '#ffd04a', curve: 0.2 }],
    },
  },
  {
    id: 'star-spangled-bass', name: 'Star-Spangled Bass', tier: 'epic', speed: 1.0, size: 1.0,
    look: {
      body: 'oval', tail: 'rounded', fins: 'spiny', skin: 'smooth', back: '#f4f4f4', belly: '#ffffff', fin: '#1f3a93', tailColor: '#c8102e', finEdge: '#ffffff', eye: '#c8102e',
      extras: ['flag'],
    },
  },
  {
    id: 'kitty-catfish', name: 'Kitty Catfish', tier: 'epic', speed: 0.9, size: 0.9,
    look: {
      body: 'oval', tail: 'rounded', fins: 'short', skin: 'smooth', back: '#e8862a', belly: '#fff0dc', fin: '#f4a050', eye: '#8ad83a',
      extras: ['cat'],
      markings: [0.68, 0.5, 0.32, 0.14].map((x) => ({ kind: 'bar' as const, x, width: 0.06, color: '#b85a14' })),
    },
  },
  {
    id: 'ninja-fish', name: 'Ninja Fish', tier: 'epic', speed: 2.1, size: 0.85,
    look: {
      body: 'slender', tail: 'forked', fins: 'spiny', skin: 'smooth', back: '#16161c', belly: '#2e2e38', fin: '#22222a', eye: '#f4f4f4',
      extras: ['ninja'],
    },
  },
  {
    // Go Heels.
    id: 'unc-fish', name: 'UNC Fish', tier: 'epic', speed: 1.1, size: 1.0,
    look: {
      body: 'oval', tail: 'forked', fins: 'short', skin: 'smooth', back: '#7bafd4', belly: '#ffffff', fin: '#ffffff', tailColor: '#7bafd4', finEdge: '#13294b', eye: '#13294b',
      extras: ['argyle'],
    },
  },
  {
    id: 'sushi-fish', name: 'Sushi Fish', tier: 'epic', speed: 0.9, size: 1.0,
    look: {
      body: 'oval', tail: 'rounded', fins: 'short', skin: 'smooth', back: '#ff7a4a', belly: '#f8f5ec', fin: '#ff9a6e', finEdge: '#ffe2d2', eye: '#2a1a14',
      extras: ['sushi'],
    },
  },
  {
    // Built Fish Tough.
    id: 'fish-150', name: 'Fish-150', tier: 'epic', speed: 1.2, size: 1.15,
    look: { body: 'oval', tail: 'forked', fins: 'short', skin: 'smooth', back: '#2456b8', belly: '#1a3f88', fin: '#a8b2bc', finEdge: '#eef2f5', eye: '#14181c', extras: ['truck'] },
  },
  // ---- Legendary ----
  {
    id: 'golden-arowana', name: 'Golden Arowana', tier: 'legendary', speed: 0.6, size: 1.5,
    look: {
      body: 'slender', tail: 'rounded', fins: 'short', back: '#c89a1a', belly: '#fff0a0', fin: '#ffc81a', tailColor: '#e8a010', finEdge: '#8a5a0a', eye: '#d84a1a', barbels: true,
      markings: [{ kind: 'stripe', y: -0.1, width: 0.12, from: 0.05, to: 0.85, color: '#fff6c8', glow: true }],
    },
  },
  {
    id: 'robofish', name: 'RoboFish 3000', tier: 'legendary', speed: 1.0, size: 1.0,
    look: {
      body: 'oval', tail: 'forked', fins: 'short', skin: 'metal', back: '#7a8794', belly: '#dfe6ee', fin: '#5ad8ff', tailColor: '#3ac8ff', finEdge: '#2a3a4a', eye: '#ff2a2a',
      extras: ['robot'],
    },
  },
  {
    id: 'golden-fish', name: 'Golden Fish', tier: 'legendary', speed: 0.8, size: 1.0,
    look: {
      body: 'oval', tail: 'veil', fins: 'flowing', back: '#c8901a', belly: '#fff2a0', fin: '#ffd84a', finEdge: '#fff6c8', eye: '#8a5a0a',
      extras: ['sparkle'],
      markings: [{ kind: 'stripe', y: -0.4, width: 0.25, from: 0.15, to: 0.8, color: '#fff8d0', curve: 0.2, glow: true }],
    },
  },
  {
    id: 'shark', name: 'Reef Shark', tier: 'legendary', speed: 1.0, size: 1.6,
    look: { body: 'shark', tail: 'shark', fins: 'shark', skin: 'smooth', back: '#5e6e7c', belly: '#f2f4f6', fin: '#56666f', finEdge: '#1e262c', eye: '#14181c' },
  },
  {
    id: 'claudefish', name: 'Claudefish', tier: 'legendary', speed: 1.0, size: 1.0,
    look: {
      body: 'oval', tail: 'rounded', fins: 'short', skin: 'smooth', back: '#b8583a', belly: '#e9a07f', fin: '#d97757', finEdge: '#f4ede4', eye: '#f4ede4',
      extras: ['spark'],
    },
  },
  {
    id: 'openai-fish', name: 'OpenAI Fish', tier: 'legendary', speed: 1.0, size: 1.0,
    look: {
      body: 'oval', tail: 'rounded', fins: 'short', skin: 'smooth', back: '#0d0d0d', belly: '#3a3a3a', fin: '#1e1e1e', finEdge: '#ffffff', eye: '#ffffff',
      extras: ['knot'],
    },
  },
  {
    // Just a guy. Swimming. Fish-sized.
    id: 'some-dude', name: 'Some Dude', tier: 'legendary', speed: 0.9, size: 1.0,
    look: { body: 'human', tail: 'rounded', fins: 'short', back: '#d9a07a', belly: '#2a6ae8', fin: '#ff4a3a' },
  },
  {
    // There is nothing to see. Paying for it is the whole experience.
    id: 'invisible-fish', name: 'Invisible Fish', tier: 'legendary', speed: 1, size: 1,
    look: { body: 'none', tail: 'rounded', fins: 'short', back: 'transparent', belly: 'transparent', fin: 'transparent' },
  },
  {
    id: 'rainbow-fish', name: 'Rainbow Fish', tier: 'legendary', speed: 1.0, size: 1.05,
    look: {
      body: 'oval', tail: 'veil', fins: 'flowing', back: '#ff3b3b', belly: '#8a4bff', fin: '#fff4ff', finEdge: '#ff7ad9', eye: '#3a2a6a',
      extras: ['sparkle'],
      // Red at the top through to violet at the bottom.
      markings: ['#ff3b3b', '#ff9a2a', '#ffe23a', '#3ad65a', '#2a9cff', '#5a4bff', '#b04bff'].map((color, i) => ({
        kind: 'stripe' as const, y: -0.86 + i * 0.287, width: 0.32, from: -0.1, to: 1.1, color,
      })),
    },
  },
  // ---- Mythic ----
  {
    id: 'golden-shark', name: 'Golden Shark', tier: 'mythic', speed: 0.9, size: 1.7,
    look: {
      body: 'shark', tail: 'shark', fins: 'shark', skin: 'smooth', back: '#b8820f', belly: '#fff4b0', fin: '#d8a020', finEdge: '#fff0a0', eye: '#3a2400',
      extras: ['sparkle'],
      markings: [{ kind: 'stripe', y: -0.45, width: 0.2, from: 0.1, to: 0.85, color: '#fff8d0', curve: 0.15, glow: true }],
    },
  },
];

export const FISH: Fish[] = CATALOG.map((fish, i) => {
  const rankInTier = CATALOG.slice(0, i).filter((f) => f.tier === fish.tier).length;
  return { ...fish, price: fishPrice(fish.tier, rankInTier) };
});

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
