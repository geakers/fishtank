export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary';

export interface Fish {
  id: string;
  name: string;
  price: number;
  rarity: Rarity;
  // Picks the look in FishSprite.
  spriteKey: string;
  // Multipliers around 1.0 for the lock-in aquarium.
  speed: number;
  size: number;
}

export const FISH: Fish[] = [
  { id: 'bubble-guppy', name: 'Bubble Guppy', price: 50, rarity: 'common', spriteKey: 'guppy', speed: 1.2, size: 0.6 },
  { id: 'neon-tetra', name: 'Neon Tetra', price: 50, rarity: 'common', spriteKey: 'tetra', speed: 1.4, size: 0.5 },
  { id: 'clownfish', name: 'Clownfish', price: 120, rarity: 'uncommon', spriteKey: 'clownfish', speed: 1.0, size: 0.8 },
  { id: 'blue-tang', name: 'Blue Tang', price: 120, rarity: 'uncommon', spriteKey: 'blue-tang', speed: 1.1, size: 0.9 },
  { id: 'angelfish', name: 'Angelfish', price: 300, rarity: 'rare', spriteKey: 'angelfish', speed: 0.8, size: 1.1 },
  { id: 'pufferfish', name: 'Pufferfish', price: 300, rarity: 'rare', spriteKey: 'pufferfish', speed: 0.6, size: 1.0 },
  { id: 'koi', name: 'Sky Koi', price: 300, rarity: 'rare', spriteKey: 'koi', speed: 0.7, size: 1.3 },
  { id: 'glass-jelly', name: 'Glass Jellyfish', price: 750, rarity: 'legendary', spriteKey: 'jellyfish', speed: 0.4, size: 1.4 },
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
