import { useRef, useState, type CSSProperties, type MouseEvent, type RefObject } from 'react';

// Clicking the fish this many times within RAPID_WINDOW_MS cracks the glass
// a little more. The click after the glass has CRACKS_TO_BURST cracks in it
// bursts the tank.
const RAPID_CLICKS = 5;
const RAPID_WINDOW_MS = 2000;
export const CRACKS_TO_BURST = 4;

interface Point {
  x: number;
  y: number;
}

interface Crack {
  id: number;
  at: Point;
  // SVG path data, in px inside the glass. Main lines first, then the finer
  // branches and rings.
  lines: string[];
  fine: string[];
}

interface Shard {
  points: string;
  style: CSSProperties;
}

interface Drop {
  style: CSSProperties;
}

export interface Burst {
  // Where the glass gave way, in px inside the glass and inside the whole tank.
  inGlass: Point;
  inTank: Point;
  // How far the water falls from the hole to the floor under the tank.
  dropHeight: number;
  hole: string;
  shards: Shard[];
  drops: Drop[];
}

// Tracks how badly the glass is cracked. Call onFishClick for every click on
// a fish; clicking too fast cracks the glass, and enough cracks burst it.
export function useTankDamage(
  tankRef: RefObject<HTMLDivElement | null>,
  glassRef: RefObject<HTMLDivElement | null>,
  enabled: boolean,
) {
  const [cracks, setCracks] = useState<Crack[]>([]);
  const [burst, setBurst] = useState<Burst | null>(null);
  const clicks = useRef<number[]>([]);

  const onFishClick = (e: MouseEvent<HTMLElement>) => {
    const tank = tankRef.current;
    const glass = glassRef.current;
    if (!enabled || burst || !tank || !glass) return;

    const now = performance.now();
    clicks.current = [...clicks.current.filter((t) => now - t < RAPID_WINDOW_MS), now];
    if (clicks.current.length < RAPID_CLICKS) return;
    clicks.current = [];

    const glassBox = glass.getBoundingClientRect();
    const tankBox = tank.getBoundingClientRect();
    const inGlass = { x: e.clientX - glassBox.left, y: e.clientY - glassBox.top };

    if (cracks.length < CRACKS_TO_BURST) {
      setCracks([...cracks, makeCrack(cracks.length, inGlass)]);
      shake(glass, 4 + cracks.length * 2);
    } else {
      const inTank = { x: e.clientX - tankBox.left, y: e.clientY - tankBox.top };
      setBurst(makeBurst(inGlass, inTank, tankBox.height));
      shake(glass, 14);
    }
  };

  return { cracks, burst, onFishClick };
}

// A short knock to the glass, harder for worse damage.
function shake(el: HTMLElement, px: number) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  el.animate(
    [
      { translate: '0 0' },
      { translate: `${-px}px 0` },
      { translate: `${px * 0.7}px 0` },
      { translate: `${-px * 0.4}px 0` },
      { translate: '0 0' },
    ],
    { duration: 320, easing: 'ease-out' },
  );
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);

// A star of cracks spreading from one point, bigger for each crack before it.
function makeCrack(index: number, at: Point): Crack {
  const reach = 70 + index * 55;
  const spokes = 5 + Math.floor(Math.random() * 4);
  const lines: string[] = [];
  const fine: string[] = [];
  const ringPoints: Point[] = [];
  const ringRadius = 12 + index * 5;

  for (let i = 0; i < spokes; i++) {
    const angle = (i / spokes) * Math.PI * 2 + rand(-0.3, 0.3);
    const points = jaggedLine(at, angle, reach * rand(0.6, 1.2));
    lines.push(toPath(points));
    ringPoints.push({ x: at.x + Math.cos(angle) * ringRadius * rand(0.8, 1.2), y: at.y + Math.sin(angle) * ringRadius * rand(0.8, 1.2) });

    // Some spokes fork partway along.
    if (Math.random() < 0.6) {
      const from = points[Math.floor(points.length * rand(0.35, 0.7))];
      fine.push(toPath(jaggedLine(from, angle + rand(0.4, 0.8) * (Math.random() < 0.5 ? -1 : 1), reach * rand(0.2, 0.45))));
    }
  }

  // Broken rings joining the spokes near the point of impact.
  for (let i = 0; i < ringPoints.length; i++) {
    if (Math.random() < 0.7) fine.push(toPath([ringPoints[i], ringPoints[(i + 1) % ringPoints.length]]));
  }

  return { id: index, at, lines, fine };
}

// A crack wanders a little as it runs.
function jaggedLine(from: Point, angle: number, length: number): Point[] {
  const points = [from];
  let { x, y } = from;
  let heading = angle;
  for (let run = 0; run < length; ) {
    const step = rand(8, 18);
    heading += rand(-0.3, 0.3);
    // Stay close to the overall direction.
    heading += (angle - heading) * 0.4;
    x += Math.cos(heading) * step;
    y += Math.sin(heading) * step;
    points.push({ x, y });
    run += step;
  }
  return points;
}

function toPath(points: Point[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
}

function makeBurst(inGlass: Point, inTank: Point, tankHeight: number): Burst {
  const dropHeight = tankHeight - inTank.y;

  // A ragged hole where the glass fell out.
  const holeCorners = 9;
  const hole = Array.from({ length: holeCorners }, (_, i) => {
    const angle = (i / holeCorners) * Math.PI * 2 + rand(-0.25, 0.25);
    const r = rand(22, 46);
    return `${(inGlass.x + Math.cos(angle) * r).toFixed(1)},${(inGlass.y + Math.sin(angle) * r).toFixed(1)}`;
  }).join(' ');

  // Bits of glass thrown out of the hole, falling as they spin.
  const shards = Array.from({ length: 18 }, () => {
    const size = rand(6, 22);
    const corners = Array.from({ length: 3 }, (_, i) => {
      const angle = (i / 3) * Math.PI * 2 + rand(-0.6, 0.6);
      return `${(Math.cos(angle) * size).toFixed(1)},${(Math.sin(angle) * size * rand(0.4, 1)).toFixed(1)}`;
    }).join(' ');
    return {
      points: corners,
      style: {
        '--shard-x': `${rand(-260, 260)}px`,
        '--shard-y': `${dropHeight + rand(0, 40)}px`,
        '--shard-lift': `${rand(-90, -20)}px`,
        '--shard-spin': `${rand(-540, 540)}deg`,
        animationDuration: `${rand(0.8, 1.3)}s`,
      } as CSSProperties,
    };
  });

  // Water spraying out of the hole and splashing down.
  const drops = Array.from({ length: 36 }, () => {
    const size = rand(4, 12);
    return {
      style: {
        width: size,
        height: size * 1.25,
        '--drop-x': `${rand(-220, 220)}px`,
        '--drop-y': `${dropHeight + rand(-10, 30)}px`,
        '--drop-lift': `${rand(-70, -10)}px`,
        animationDelay: `${rand(0, 0.9)}s`,
        animationDuration: `${rand(0.7, 1.1)}s`,
      } as CSSProperties,
    };
  });

  return { inGlass, inTank, dropHeight, hole, shards, drops };
}

// The cracks, drawn on the front of the glass. Each line spreads out from
// the point of impact as it appears.
export function Cracks({ cracks, burst }: { cracks: Crack[]; burst: Burst | null }) {
  if (cracks.length === 0) return null;
  return (
    <svg className="tank-cracks" aria-hidden="true">
      {cracks.map((crack) => (
        <g key={crack.id}>
          {crack.lines.map((d, i) => (
            <path key={i} d={d} pathLength={1} className="tank-cracks__line" />
          ))}
          {crack.fine.map((d, i) => (
            <path key={`f${i}`} d={d} pathLength={1} className="tank-cracks__line tank-cracks__line--fine" />
          ))}
          <circle cx={crack.at.x} cy={crack.at.y} r={3} className="tank-cracks__pit" />
        </g>
      ))}
      {burst ? <polygon points={burst.hole} className="tank-cracks__hole" /> : null}
    </svg>
  );
}

// Glass and water bursting out of the hole, and the puddle they leave.
export function BurstSpill({ burst }: { burst: Burst }) {
  const origin = { left: burst.inTank.x, top: burst.inTank.y };
  return (
    <div className="tank-spill" aria-hidden="true">
      <div className="tank-spill__gush" style={{ ...origin, height: burst.dropHeight }} />
      <div className="tank-spill__puddle" style={{ left: burst.inTank.x }} />
      {burst.drops.map((drop, i) => (
        <span key={i} className="tank-spill__drop" style={{ ...origin, ...drop.style }} />
      ))}
      <svg className="tank-spill__shards" style={origin}>
        {burst.shards.map((shard, i) => (
          <polygon key={i} points={shard.points} className="tank-spill__shard" style={shard.style} />
        ))}
      </svg>
    </div>
  );
}
