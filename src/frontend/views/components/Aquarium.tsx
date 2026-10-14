import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent, type RefObject } from 'react';
import type { Fish } from '../../data';
import { hash } from '../format';
import { Bubble } from './Bubble';
import { FishSprite } from './FishSprite';
import { Anemone, BackScape, FrontScape, Seagrass } from './Reefscape';

// A light streak masked to the fish that was just clicked, so it follows the
// body instead of a box around it.
function FishGlint() {
  const ref = useRef<HTMLSpanElement>(null);
  const [mask, setMask] = useState('');
  useLayoutEffect(() => {
    const svg = ref.current?.previousElementSibling;
    if (!(svg instanceof SVGSVGElement)) return;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.querySelectorAll('*').forEach((node) => {
      const fill = node.getAttribute('fill');
      if (fill && fill !== 'none') node.setAttribute('fill', '#ffffff');
      const stroke = node.getAttribute('stroke');
      if (stroke && stroke !== 'none') node.setAttribute('stroke', '#ffffff');
    });
    const xml = new XMLSerializer().serializeToString(clone);
    setMask(`url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}")`);
  }, []);
  return (
    <span
      ref={ref}
      className="fish-sheen"
      style={mask ? ({ maskImage: mask, WebkitMaskImage: mask } as CSSProperties) : { opacity: 0 }}
      aria-hidden="true"
    />
  );
}

export interface AquariumProps {
  fish: Fish[];
  // Width in px of a size-1.0 fish. The tank itself sizes to its container.
  fishSize?: number;
  className?: string;
  // Called when the fish are clicked too fast (RAPID_CLICKS clicks within
  // RAPID_WINDOW_MS).
  onTapTooFast?: () => void;
}

// A Frutiger Aero LED aquarium lamp: silver lid and base, rounded glass and
// glowing backlit water around a realistic reef, with the given fish swimming
// back and forth inside the glass.
export function Aquarium({ fish, fishSize = 120, className = '', onTapTooFast }: AquariumProps) {
  const swimmers = useMemo(() => layoutSwimmers(fish, fishSize), [fish, fishSize]);
  const aquariumRef = useRef<HTMLDivElement>(null);
  const waterRef = useRef<HTMLDivElement>(null);
  const { puffs, blowBubbles } = useFishBubbles(waterRef);
  const { shows, play, stunned, flopped, leaps, sheen, land } = useFishShows(waterRef, aquariumRef);
  const clicks = useRef<number[]>([]);

  const clickFish = (e: MouseEvent<HTMLElement>, f: Fish) => {
    if (!play(e, f)) blowBubbles(e, f);
    if (!onTapTooFast) return;
    const now = performance.now();
    clicks.current = [...clicks.current.filter((t) => now - t < RAPID_WINDOW_MS), now];
    if (clicks.current.length < RAPID_CLICKS) return;
    clicks.current = [];
    onTapTooFast();
  };

  return (
    <div className={`aquarium ${className}`} ref={aquariumRef}>
      <div className="aquarium__lid">
        <span className="aquarium__lamp" />
      </div>
      <div className="aquarium__glass">
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
              className={`swimmer${stunned.includes(s.fish.id) ? ' is-stunned' : ''}${flopped.includes(s.fish.id) ? ' is-flop' : ''}${sheen.includes(s.fish.id) ? ' is-sheen' : ''}`}
              style={s.style}
              onClick={(e) => clickFish(e, s.fish)}
            >
              <div className="swimmer__bob">
                <FishSprite fish={s.fish} size={s.size} />
                {sheen.includes(s.fish.id) ? <FishGlint /> : null}
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
          {shows.map((show) => (
            <FishShow key={show.id} show={show} />
          ))}
          <div className="aquarium__scatter" aria-hidden="true" />
          <div className="aquarium__rays" aria-hidden="true" />
          <div className="aquarium__ceiling" aria-hidden="true" />
        </div>
        <div className="aquarium__surface" aria-hidden="true" />
        <div className="aquarium__shine" aria-hidden="true" />
      </div>
      {leaps.map((leap) => (
        <div
          key={leap.key}
          className="dude-leap"
          onAnimationEnd={(event) => {
            if (event.animationName !== 'dude-leap') return;
            land(leap.key, leap.fish.id);
          }}
          style={
            {
              left: leap.x,
              top: leap.y,
              '--rise': `${leap.rise}px`,
              '--splash': `${leap.splash}px`,
              '--face': leap.facingLeft ? -1 : 1,
            } as CSSProperties
          }
        >
          <div className="dude-leap__flip">
            <FishSprite fish={leap.fish} size={leap.size} className="dude-leap__body" />
          </div>
          <i className="fish-ring" />
          <i className="fish-ring fish-ring--back" />
        </div>
      ))}
      <div className="aquarium__base">
        <span className="aquarium__switch" />
      </div>
    </div>
  );
}

// Clicking the fish this many times within RAPID_WINDOW_MS is tapping on the
// glass.
const RAPID_CLICKS = 5;
const RAPID_WINDOW_MS = 2000;

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
// Scales every fish's speed: 0.7 swims 30% slower than fish.speed says.
const SWIM_SPEED = 0.7;
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
    const duration = 30 / (f.speed * SWIM_SPEED);
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

type ShowKind = 'gold' | 'gold-shark' | 'ai' | 'rainbow' | 'robo' | 'shark' | 'dude';

interface FishShowData {
  id: number;
  kind: ShowKind;
  x: number;
  y: number;
  facingLeft: boolean;
  lines?: string[];
}

const CLAUDE_LINES = [
  "I'll think this through before I answer.",
  'The short version first, then the reasoning.',
  "Here's how I'd break it down.",
  'One constraint is doing most of the work here.',
  'I want to be careful about that assumption.',
  "Let me separate what's known from what's a guess.",
  'The tradeoff is speed against getting it right.',
  "I'd start by naming the goal in one sentence.",
  'Want me to go deeper on any part of this?',
  'A few things worth weighing before you commit.',
  'const plan = think(goal).then(checkEdges);',
  '// name the constraint before writing the rest',
];

const OPENAI_LINES = [
  "As an AI language model, I don't have personal opinions, but…",
  "Certainly! Here's a step-by-step breakdown.",
  'Great question! Let me explain.',
  'Sure, I can help with that.',
  'I hope this helps! Let me know if you have any other questions.',
  'Absolutely — let\'s dive in.',
  'In summary: start simple, then refine.',
  '1. Name the goal.  2. Outline the steps.  3. Check the result.',
  'Is there anything else I can help you with today?',
  'Of course! Happy to help.',
  'print("Hello, world!")',
  "I'm sorry, but I can't assist with that request.",
];

const SHOW_MS: Record<ShowKind, number> = {
  gold: 950,
  'gold-shark': 1000,
  ai: 3000,
  rainbow: 4600,
  robo: 2600,
  shark: 900,
  dude: 1600,
};

// Legendary fish, plus every golden fish, get their own click instead of bubbles.
function showKind(fish: Fish): ShowKind | null {
  if (fish.id === 'claudefish' || fish.id === 'openai-fish') return 'ai';
  if (fish.id === 'rainbow-fish') return 'rainbow';
  if (fish.id === 'robofish') return 'robo';
  if (fish.id === 'golden-shark') return 'gold-shark';
  if (fish.id.startsWith('golden')) return 'gold';
  if (fish.id === 'shark') return 'shark';
  if (fish.id === 'some-dude') return 'dude';
  if (fish.tier === 'legendary') return 'gold';
  return null;
}

interface Leap {
  key: number;
  fish: Fish;
  x: number;
  y: number;
  size: number;
  height: number;
  facingLeft: boolean;
  rise: number;
  splash: number;
}

const LEAP_MS = 1350;

function useFishShows(waterRef: RefObject<HTMLDivElement | null>, aquariumRef: RefObject<HTMLDivElement | null>) {
  const [shows, setShows] = useState<FishShowData[]>([]);
  const [stunned, setStunned] = useState<string[]>([]);
  const [flopped, setFlopped] = useState<string[]>([]);
  const [leaps, setLeaps] = useState<Leap[]>([]);
  const [sheen, setSheen] = useState<string[]>([]);
  const nextId = useRef(0);
  const timers = useRef<number[]>([]);
  const stunTimers = useRef<Record<string, number>>({});
  const sheenTimers = useRef<Record<string, number>>({});
  const heldAnims = useRef<Record<number, Animation[]>>({});
  const said = useRef<Record<string, string[]>>({});
  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      Object.values(stunTimers.current).forEach(clearTimeout);
      Object.values(sheenTimers.current).forEach(clearTimeout);
    },
    [],
  );

  const later = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));

  const stun = (id: string) => {
    setStunned((ids) => (ids.includes(id) ? ids : [...ids, id]));
    window.clearTimeout(stunTimers.current[id]);
    stunTimers.current[id] = window.setTimeout(() => {
      setStunned((ids) => ids.filter((x) => x !== id));
    }, SHOW_MS.robo);
  };

  const hideSwimmer = (id: string) => {
    setFlopped((ids) => (ids.includes(id) ? ids : [...ids, id]));
  };

  const land = (key: number, fishId: string) => {
    const anims = heldAnims.current[key];
    if (!anims) return;
    delete heldAnims.current[key];
    setLeaps((list) => list.filter((item) => item.key !== key));
    setFlopped((ids) => ids.filter((id) => id !== fishId));
    // Resume on the frame after the fish is visible again, so he doesn't
    // swim ahead while still hidden and then pop.
    requestAnimationFrame(() => requestAnimationFrame(() => anims.forEach((anim) => anim.play())));
  };

  const gloss = (id: string) => {
    setSheen((ids) => (ids.includes(id) ? ids : [...ids, id]));
    window.clearTimeout(sheenTimers.current[id]);
    sheenTimers.current[id] = window.setTimeout(() => {
      setSheen((ids) => ids.filter((x) => x !== id));
    }, 900);
  };

  const leapOut = (e: MouseEvent<HTMLElement>, fish: Fish, facingLeft: boolean) => {
    const tank = aquariumRef.current;
    const water = waterRef.current;
    const swimmer = e.currentTarget;
    const sprite = swimmer.querySelector('svg');
    const bob = swimmer.querySelector('.swimmer__bob');
    if (!tank || !water || !sprite) return;
    const held = [
      ...swimmer.getAnimations(),
      ...(bob instanceof Element ? bob.getAnimations() : []),
    ];
    held.forEach((anim) => anim.pause());
    const tankBox = tank.getBoundingClientRect();
    const waterBox = water.getBoundingClientRect();
    const box = sprite.getBoundingClientRect();
    const key = nextId.current++;
    const centerY = box.top - tankBox.top + box.height / 2;
    const surface = waterBox.top - tankBox.top;
    const peak = Math.max(12, surface - box.height * 0.85);
    const leap: Leap = {
      key,
      fish,
      x: box.left - tankBox.left + box.width / 2,
      y: centerY,
      size: Math.round(box.width),
      height: Math.round(box.height),
      facingLeft,
      rise: Math.max(40, Math.round(centerY - peak)),
      splash: Math.round(surface - centerY),
    };
    heldAnims.current[key] = held;
    setLeaps((list) => [...list, leap]);
    later(LEAP_MS + 400, () => land(key, fish.id));
    hideSwimmer(fish.id);
  };

  const nextLines = (fishId: string) => {
    const pool = fishId === 'openai-fish' ? OPENAI_LINES : CLAUDE_LINES;
    const used = said.current[fishId] ?? [];
    let available = pool.filter((line) => !used.includes(line));
    if (available.length < 2) {
      said.current[fishId] = [];
      available = pool;
    }
    const first = available[Math.floor(Math.random() * available.length)];
    const rest = available.filter((line) => line !== first);
    const second = rest[Math.floor(Math.random() * rest.length)];
    said.current[fishId] = [...(said.current[fishId] ?? []), first, second];
    return [first, second];
  };

  const play = (e: MouseEvent<HTMLElement>, fish: Fish) => {
    const kind = showKind(fish);
    const water = waterRef.current;
    const sprite = e.currentTarget.querySelector('svg');
    if (!kind || !water || !sprite) return false;
    const box = sprite.getBoundingClientRect();
    const tank = water.getBoundingClientRect();
    const facingLeft = new DOMMatrix(getComputedStyle(e.currentTarget).transform).a < 0;
    const at = fish.look.body === 'human' ? FACE : MOUTH;
    const mouthX = box.left - tank.left + box.width * (facingLeft ? 1 - at.x : at.x);
    const mouthY = box.top - tank.top + box.height * at.y;
    const centerX = box.left - tank.left + box.width / 2;
    const centerY = box.top - tank.top + box.height / 2;
    const fromMouth = kind === 'ai';
    const id = nextId.current++;
    const show: FishShowData = {
      id,
      kind,
      x: fromMouth ? mouthX : centerX,
      y: fromMouth ? mouthY : centerY,
      facingLeft,
      lines: kind === 'ai' ? nextLines(fish.id) : undefined,
    };
    if (kind === 'dude') {
      leapOut(e, fish, facingLeft);
      return true;
    }
    if (kind === 'gold' || kind === 'gold-shark') gloss(fish.id);
    if (kind === 'gold') return true;
    setShows((list) => [...list, show]);
    later(SHOW_MS[kind], () => setShows((list) => list.filter((s) => s.id !== id)));
    if (kind === 'robo') stun(fish.id);
    return true;
  };

  return { shows, play, stunned, flopped, leaps, sheen, land };
}

function FishShow({ show }: { show: FishShowData }) {
  const style = { left: show.x, top: show.y } as CSSProperties;
  if (show.kind === 'gold-shark') {
    return (
      <span className="fish-react fish-react--flash" aria-hidden="true">
        <span className="tank-flash" />
      </span>
    );
  }
  if (show.kind === 'ai') {
    return (
      <span className="fish-react fish-react--ai" style={style} aria-hidden="true">
        {show.lines?.map((line, i) => (
          <span key={line} className="fish-bit" style={{ animationDelay: `${i * 0.15}s` }}>
            {line}
          </span>
        ))}
      </span>
    );
  }
  if (show.kind === 'rainbow') {
    return (
      <span className="fish-react fish-react--rainbow" aria-hidden="true">
        <span className="fish-bow" />
      </span>
    );
  }
  if (show.kind === 'robo') {
    return (
      <span className="fish-react fish-react--robo" style={style} aria-hidden="true">
        {Array.from({ length: 5 }, (_, i) => (
          <i key={i} className="fish-bolt" style={{ rotate: `${i * 36 - 70}deg`, animationDelay: `${i * 0.05}s` }} />
        ))}
      </span>
    );
  }
  if (show.kind === 'shark') {
    const travel = show.facingLeft ? -48 : 48;
    return (
      <span className="fish-react fish-react--shark" style={style} aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <i
            key={i}
            className="fish-chomp"
            style={
              {
                '--chomp-x': `${travel}px`,
                '--chomp-flip': show.facingLeft ? -1 : 1,
                animationDelay: `${i * 0.08}s`,
              } as CSSProperties
            }
          />
        ))}
      </span>
    );
  }
  return null;
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
