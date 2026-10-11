import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent, type RefObject } from 'react';
import type { Fish } from '../../data';
import { hash } from '../format';
import { Bubble } from './Bubble';
import { FishSprite } from './FishSprite';
import { Anemone, BackScape, FrontScape, Seagrass } from './Reefscape';
import { BurstSpill, Cracks, useTankDamage } from './TankDamage';

export interface AquariumProps {
  fish: Fish[];
  // Width in px of a size-1.0 fish. The tank itself sizes to its container.
  fishSize?: number;
  className?: string;
  // When true, clicking the fish too fast cracks the glass and, in the end,
  // bursts the tank. The damage lasts until the aquarium unmounts.
  breakable?: boolean;
}

// A Frutiger Aero LED aquarium lamp: silver lid and base, rounded glass and
// glowing backlit water around a realistic reef, with the given fish swimming
// back and forth inside the glass.
export function Aquarium({ fish, fishSize = 120, className = '', breakable = false }: AquariumProps) {
  const swimmers = useMemo(() => layoutSwimmers(fish, fishSize), [fish, fishSize]);
  const tankRef = useRef<HTMLDivElement>(null);
  const glassRef = useRef<HTMLDivElement>(null);
  const waterRef = useRef<HTMLDivElement>(null);
  const { puffs, blowBubbles } = useFishBubbles(waterRef);
  const { cracks, burst, onFishClick } = useTankDamage(tankRef, glassRef, breakable);
  const fallen = useFallenFish(waterRef, burst !== null);

  const clickFish = (e: MouseEvent<HTMLElement>, f: Fish) => {
    // No bubbles once the water has gone.
    if (burst) return;
    blowBubbles(e, f);
    onFishClick(e);
  };

  return (
    <div className={`aquarium ${burst ? 'aquarium--burst' : ''} ${className}`} ref={tankRef}>
      <div className="aquarium__lid">
        <span className="aquarium__lamp" />
      </div>
      <div className="aquarium__glass" ref={glassRef}>
        <div className="aquarium__water" ref={waterRef}>
          <div className="aquarium__depth" aria-hidden="true" />
          <div className="aquarium__backlight" aria-hidden="true" />
          <Seagrass />
          <BackScape />
          <div className="aquarium__haze" aria-hidden="true" />
          <Bubbler />
          {swimmers.map((s) => (
            <div
              key={s.key}
              data-key={s.key}
              className={`swimmer ${fallen?.[s.key] ? 'is-fallen' : ''}`}
              style={fallen?.[s.key] ? { ...s.style, ...fallen[s.key] } : s.style}
              onClick={(e) => clickFish(e, s.fish)}
            >
              <div className="swimmer__bob">
                <FishSprite fish={s.fish} size={s.size} />
              </div>
            </div>
          ))}
          {puffs.map((p) => (
            <span key={p.id} className="fish-puff" style={{ left: p.x, top: p.y, ...p.style }} aria-hidden="true" />
          ))}
          <FrontScape />
          <Anemone />
          <div className="aquarium__particles" aria-hidden="true" />
          {/* The water itself, in front of everything inside the tank. */}
          <div className="aquarium__tint" aria-hidden="true" />
          <div className="aquarium__scatter" aria-hidden="true" />
          <div className="aquarium__rays" aria-hidden="true" />
          <div className="aquarium__ceiling" aria-hidden="true" />
          {burst ? <div className="aquarium__waterline" aria-hidden="true" /> : null}
        </div>
        <div className="aquarium__surface" aria-hidden="true" />
        <div className="aquarium__shine" aria-hidden="true" />
        <Cracks cracks={cracks} burst={burst} />
      </div>
      <div className="aquarium__base">
        <span className="aquarium__switch" />
      </div>
      {burst ? <BurstSpill burst={burst} /> : null}
    </div>
  );
}

interface Swimmer {
  key: string;
  fish: Fish;
  size: number;
  style: CSSProperties;
}

// The routes a fish can follow, matching the path-* keyframes in screens.css.
// rise and dip are how far above and below its lane the route goes, in % of
// the water's height, so the lane can be picked to keep the fish in the water.
const PATHS = [
  { name: 'none', rise: 0, dip: 0 },
  { name: 'path-wave', rise: 7, dip: 7 },
  { name: 'path-loop', rise: 18, dip: 0 },
  { name: 'path-dive', rise: 0, dip: 18 },
  { name: 'path-arc', rise: 16, dip: 0 },
  { name: 'path-zigzag', rise: 9, dip: 9 },
];
// Lanes span this range of the water, top of the fish's box.
const LANE_TOP = 8;
const LANE_BOTTOM = 64;

// Gives each fish a route, lane and speed from fish.speed. Uses a hash of the
// id so each fish keeps the same route and lane between renders.
function layoutSwimmers(fish: Fish[], fishSize: number): Swimmer[] {
  // Fish with nothing to draw don't swim at all, so there's nothing to click.
  return fish.filter((f) => f.look.body !== 'none').map((f) => {
    const h = hash(f.id);
    const size = Math.round(fishSize * f.size);
    const duration = 30 / f.speed;
    const path = PATHS[(h >>> 11) % PATHS.length];
    const laneMin = LANE_TOP + path.rise;
    const laneCount = LANE_BOTTOM - path.dip - laneMin + 1;
    return {
      key: f.id,
      fish: f,
      size,
      style: {
        top: `${laneMin + (h % laneCount)}%`,
        '--fish-w': `${size}px`,
        '--swim-path': path.name,
        '--swim-duration': `${duration}s`,
        // Negative delay starts each fish partway through its loop.
        '--swim-delay': `${-((h >>> 6) % Math.round(duration * 10)) / 10}s`,
        '--bob-duration': `${2.4 + ((h >>> 3) % 20) / 10}s`,
      } as CSSProperties,
    };
  });
}

// When the tank bursts, each fish stops where it is and drops to the bottom
// with the water. Returns the style that pins each fish in place and sets how
// far it falls, keyed by swimmer, or null while the tank is whole.
function useFallenFish(waterRef: RefObject<HTMLDivElement | null>, burst: boolean) {
  const [fallen, setFallen] = useState<Record<string, CSSProperties> | null>(null);

  // Measured before paint, so the fish don't flash back to the start of
  // their swim when the animation is swapped for the fall.
  useLayoutEffect(() => {
    const water = waterRef.current;
    if (!burst || !water) return;
    const tank = water.getBoundingClientRect();
    const styles: Record<string, CSSProperties> = {};
    water.querySelectorAll<HTMLElement>('.swimmer').forEach((el) => {
      const box = el.getBoundingClientRect();
      const facingLeft = new DOMMatrix(getComputedStyle(el).transform).a < 0;
      const top = box.top - tank.top;
      // Rest on the sand, a little apart from each other's heights.
      const rest = tank.height * (0.9 + Math.random() * 0.05) - box.height;
      styles[el.dataset.key!] = {
        left: box.left - tank.left,
        top,
        transform: facingLeft ? 'scaleX(-1)' : undefined,
        '--fall': `${Math.max(rest - top, 0)}px`,
        '--fall-delay': `${(Math.random() * 0.4).toFixed(2)}s`,
      } as CSSProperties;
    });
    setFallen(styles);
  }, [burst, waterRef]);

  return fallen;
}

// Where bubbles leave the sprite, as fractions of its box when facing right:
// the corner of the mouth for fish, the top of the bell for jellyfish.
const MOUTH = { x: 105 / 120, y: 43 / 80 };
const BELL_TOP = { x: 0.5, y: 0.1 };
const FACE = { x: 101 / 120, y: 42 / 80 };
// Time between bubbles in one burst, and how long each one lives.
const PUFF_GAP_MS = 110;
const PUFF_MS = 1500;

interface Puff {
  id: number;
  // Position in px inside the water.
  x: number;
  y: number;
  style: CSSProperties;
}

// Clicking a fish makes it blow a little stream of bubbles from its mouth.
// Each bubble is released from wherever the mouth is at that moment, then
// left behind in the water as the fish swims on.
function useFishBubbles(waterRef: RefObject<HTMLDivElement | null>) {
  const [puffs, setPuffs] = useState<Puff[]>([]);
  const nextId = useRef(0);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const later = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));

  const release = (swimmer: HTMLElement, fish: Fish) => {
    const water = waterRef.current;
    const sprite = swimmer.querySelector('svg');
    if (!water || !sprite || !swimmer.isConnected) return;
    const box = sprite.getBoundingClientRect();
    const tank = water.getBoundingClientRect();
    // The swim animation mirrors the fish with scaleX(-1) on the way back.
    const facingLeft = new DOMMatrix(getComputedStyle(swimmer).transform).a < 0;
    const at = fish.look.body === 'jelly' ? BELL_TOP : fish.look.body === 'human' ? FACE : MOUTH;
    const size = 4 + Math.random() * 7 * fish.size;
    const id = nextId.current++;
    const puff: Puff = {
      id,
      x: box.left - tank.left + box.width * (facingLeft ? 1 - at.x : at.x),
      y: box.top - tank.top + box.height * at.y,
      style: {
        width: size,
        height: size,
        '--puff-dx': `${(facingLeft ? -1 : 1) * (2 + Math.random() * 8)}px`,
        '--puff-rise': `${-(50 + Math.random() * 60)}px`,
      } as CSSProperties,
    };
    setPuffs((list) => [...list, puff]);
    later(PUFF_MS, () => setPuffs((list) => list.filter((p) => p.id !== id)));
  };

  const blowBubbles = (e: MouseEvent<HTMLElement>, fish: Fish) => {
    const swimmer = e.currentTarget;
    const count = 5 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) later(i * PUFF_GAP_MS, () => release(swimmer, fish));
  };

  return { puffs, blowBubbles };
}

// A stream of small bubbles rising from behind the rocks at the back left.
function Bubbler() {
  const bubbles = Array.from({ length: 12 }, (_, i) => {
    const h = hash(`bubbler-${i}`);
    const rise = 4 + (h % 4);
    return {
      size: 4 + (h % 7),
      leftPercent: 13 + ((h >>> 5) % 4),
      riseSeconds: rise,
      delaySeconds: -((h >>> 9) % (rise * 10)) / 10,
    };
  });
  return (
    <div className="aquarium__bubbler" aria-hidden="true">
      {bubbles.map((b, i) => (
        <Bubble key={i} {...b} />
      ))}
    </div>
  );
}
