import { useId } from 'react';

// The aquarium's scenery: sand, live rock, corals and plants, drawn as SVG in a
// 1000×400 scene that spans the width of the tank, anchored to its bottom. Textures (rock, sand, coral
// pores, brain-coral grooves) come from SVG noise filters, so these layers are
// static and only the plants and anemone move.

const W = 1000;
const H = 400;
const SAND_Y = 350;

type Pt = [number, number];

// Seeded random numbers, so the reef grows the same way every render.
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A smooth closed outline through the midpoints of the given points.
function smoothClosed(pts: Pt[]) {
  const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  let d = `M${mid(pts[pts.length - 1], pts[0]).join(' ')}`;
  pts.forEach((p, i) => {
    d += ` Q${p[0]} ${p[1]} ${mid(p, pts[(i + 1) % pts.length]).join(' ')}`;
  });
  return `${d} Z`;
}

// An irregular round blob, for algae patches and polyps.
function blob(cx: number, cy: number, r: number, rand: () => number, squash = 1) {
  return smoothClosed(
    Array.from({ length: 7 }, (_, i): Pt => {
      const a = (i / 7) * Math.PI * 2;
      const k = 0.7 + rand() * 0.45;
      return [cx + Math.cos(a) * r * k, cy + Math.sin(a) * r * k * squash];
    }),
  );
}

// ---------- Shared filters ----------

function Filters({ id }: { id: string }) {
  return (
    <defs>
      {/* Craggy live rock: roughened edges and a bumpy, top-lit surface. */}
      <filter id={`${id}-rock`} x="-5%" y="-10%" width="110%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="4" seed="2" result="warp" />
        <feDisplacementMap in="SourceGraphic" in2="warp" scale="16" xChannelSelector="R" yChannelSelector="G" result="rough" />
        <feTurbulence type="fractalNoise" baseFrequency="0.07" numOctaves="4" seed="7" result="bump" />
        <feDiffuseLighting in="bump" surfaceScale="3" diffuseConstant="1.1" lightingColor="#fff" result="light">
          <feDistantLight azimuth="250" elevation="48" />
        </feDiffuseLighting>
        {/* Mostly lit color, plus some flat color so crevices stay soft rather than black. */}
        <feComposite in="light" in2="rough" operator="arithmetic" k1="0.85" k3="0.25" result="lit" />
        <feComposite in="lit" in2="rough" operator="in" />
      </filter>
      {/* Fine grain over gentle ripples. */}
      <filter id={`${id}-sand`} x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.012 0.12" numOctaves="2" seed="4" result="ripple" />
        <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="1" seed="9" result="grain" />
        <feComposite in="grain" in2="ripple" operator="arithmetic" k2="0.4" k3="0.6" result="bump" />
        <feDiffuseLighting in="bump" surfaceScale="2.5" diffuseConstant="1.15" lightingColor="#fff" result="light">
          <feDistantLight azimuth="240" elevation="55" />
        </feDiffuseLighting>
        <feComposite in="light" in2="SourceGraphic" operator="arithmetic" k1="1.1" result="lit" />
        <feComposite in="lit" in2="SourceGraphic" operator="in" />
      </filter>
      {/* Porous skeleton texture for stony corals. */}
      <filter id={`${id}-pores`} x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="0.45" numOctaves="2" seed="3" result="bump" />
        <feDiffuseLighting in="bump" surfaceScale="1.6" diffuseConstant="1.15" lightingColor="#fff" result="light">
          <feDistantLight azimuth="250" elevation="50" />
        </feDiffuseLighting>
        <feComposite in="light" in2="SourceGraphic" operator="arithmetic" k1="1.1" result="lit" />
        <feComposite in="lit" in2="SourceGraphic" operator="in" />
      </filter>
      {/* Winding grooves of a brain coral. */}
      <filter id={`${id}-grooves`} x="0" y="0" width="100%" height="100%">
        <feTurbulence type="turbulence" baseFrequency="0.16 0.11" numOctaves="1" seed="5" />
        <feColorMatrix type="matrix" values="0 0 0 0 0.12  0 0 0 0 0.1  0 0 0 0 0.04  -5 0 0 0 1.05" />
        <feComposite in2="SourceGraphic" operator="in" />
      </filter>
      <filter id={`${id}-soft`} x="-10%" y="-30%" width="120%" height="160%">
        <feGaussianBlur stdDeviation="6" />
      </filter>
      <filter id={`${id}-haze`} x="-5%" y="-20%" width="110%" height="140%">
        <feGaussianBlur stdDeviation="3" />
      </filter>
    </defs>
  );
}

// ---------- Corals ----------

interface Colony {
  segs: { d: string }[];
  joints: { x: number; y: number; r: number }[];
  tips: { x: number; y: number; r: number }[];
}

// Staghorn coral: tapered branches that fork and curve upward.
function growBranching(seed: number, x: number, y: number, height: number, spread: number): Colony {
  const rand = rng(seed);
  const colony: Colony = { segs: [], joints: [], tips: [] };
  const grow = (x0: number, y0: number, ang: number, len: number, w: number, level: number) => {
    const x1 = x0 + Math.cos(ang) * len;
    const y1 = y0 + Math.sin(ang) * len;
    const w1 = w * 0.82;
    const nx = -Math.sin(ang);
    const ny = Math.cos(ang);
    colony.segs.push({
      d: `M${x0 + (nx * w) / 2} ${y0 + (ny * w) / 2} L${x1 + (nx * w1) / 2} ${y1 + (ny * w1) / 2} L${x1 - (nx * w1) / 2} ${y1 - (ny * w1) / 2} L${x0 - (nx * w) / 2} ${y0 - (ny * w) / 2} Z`,
    });
    if (level === 0 || w1 < 1.6) {
      colony.tips.push({ x: x1, y: y1, r: w1 * 0.75 });
      return;
    }
    colony.joints.push({ x: x1, y: y1, r: w1 / 2 });
    const n = rand() < 0.35 ? 3 : 2;
    for (let k = 0; k < n; k++) {
      let a = ang + (k - (n - 1) / 2) * spread * (0.7 + rand() * 0.6) + (rand() - 0.5) * 0.25;
      a += (-Math.PI / 2 - a) * 0.18; // Branches keep reaching for the light.
      grow(x1, y1, a, len * (0.68 + rand() * 0.16), w1, level - 1);
    }
  };
  // A few trunks fan out from the base, so the colony grows into a bush.
  for (const a of [-0.55, 0, 0.55]) {
    grow(x, y, -Math.PI / 2 + a * spread * 2 + (rand() - 0.5) * 0.2, height * 0.22, height * 0.07, 4);
  }
  return colony;
}

function BranchingCoral(props: { id: string; seed: number; x: number; y: number; height: number; base: string; tip: string; spread?: number }) {
  const { id, seed, x, y, height, base, tip } = props;
  const c = growBranching(seed, x, y, height, props.spread ?? 0.42);
  const grad = `${id}-br${seed}`;
  return (
    <g filter={`url(#${id}-pores)`}>
      <defs>
        <linearGradient id={grad} gradientUnits="userSpaceOnUse" x1="0" y1={y} x2="0" y2={y - height}>
          <stop offset="0%" stopColor={base} />
          <stop offset="70%" stopColor={base} />
          <stop offset="100%" stopColor={tip} />
        </linearGradient>
      </defs>
      <g fill={`url(#${grad})`}>
        {c.segs.map((s, i) => (
          <path key={i} d={s.d} />
        ))}
        {c.joints.map((j, i) => (
          <circle key={i} cx={j.x} cy={j.y} r={j.r} />
        ))}
      </g>
      {/* Growing tips are pale. */}
      {c.tips.map((t, i) => (
        <circle key={i} cx={t.x} cy={t.y} r={t.r} fill={tip} />
      ))}
    </g>
  );
}

// Gorgonian sea fan: a fine, flat net of branches.
function SeaFan({ seed, x, y, height, color }: { seed: number; x: number; y: number; height: number; color: string }) {
  const rand = rng(seed);
  const lines: { d: string; w: number }[] = [];
  const grow = (x0: number, y0: number, ang: number, len: number, w: number, level: number) => {
    const x1 = x0 + Math.cos(ang) * len;
    const y1 = y0 + Math.sin(ang) * len;
    const bend = (rand() - 0.5) * len * 0.3;
    lines.push({ d: `M${x0} ${y0} Q${(x0 + x1) / 2 + bend} ${(y0 + y1) / 2} ${x1} ${y1}`, w });
    if (level === 0) return;
    for (const side of [-1, 1]) {
      const a = Math.max(-Math.PI + 0.35, Math.min(-0.35, ang + side * (0.28 + rand() * 0.3)));
      grow(x1, y1, a, len * (0.7 + rand() * 0.2), w * 0.72, level - 1);
    }
  };
  grow(x, y, -Math.PI / 2, height * 0.22, 5, 6);
  return (
    <g stroke={color} fill="none" strokeLinecap="round" opacity={0.92}>
      {lines.map((l, i) => (
        <path key={i} d={l.d} strokeWidth={l.w} />
      ))}
    </g>
  );
}

// Table coral: flat, layered plates on a short stalk.
function TableCoral({ id, x, y, size, color, rim }: { id: string; x: number; y: number; size: number; color: string; rim: string }) {
  const grad = `${id}-table${x}`;
  return (
    <g filter={`url(#${id}-pores)`}>
      <defs>
        <linearGradient id={grad} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={rim} />
          <stop offset="35%" stopColor={color} />
          <stop offset="100%" stopColor={color} stopOpacity={0.75} />
        </linearGradient>
      </defs>
      <path d={`M${x - size * 0.08} ${y} L${x - size * 0.05} ${y - size * 0.3} L${x + size * 0.05} ${y - size * 0.3} L${x + size * 0.1} ${y} Z`} fill={color} />
      {[0, 1, 2].map((k) => {
        const py = y - size * (0.3 + k * 0.13);
        const rx = size * (0.95 - k * 0.22);
        return (
          <g key={k}>
            <ellipse cx={x + k * 4} cy={py + size * 0.04} rx={rx} ry={size * 0.07} fill="#000" opacity={0.25} />
            <ellipse cx={x + k * 4} cy={py} rx={rx} ry={size * 0.09} fill={`url(#${grad})`} />
          </g>
        );
      })}
    </g>
  );
}

// Brain coral: a dome covered in winding grooves.
function BrainCoral({ id, x, y, r, color, light }: { id: string; x: number; y: number; r: number; color: string; light: string }) {
  const grad = `${id}-brain${x}`;
  const dome = `M${x - r} ${y} C${x - r} ${y - r * 0.95}, ${x + r} ${y - r * 0.95}, ${x + r} ${y} Z`;
  return (
    <g>
      <defs>
        <radialGradient id={grad} cx="0.4" cy="0.3" r="0.8">
          <stop offset="0%" stopColor={light} />
          <stop offset="100%" stopColor={color} />
        </radialGradient>
      </defs>
      <ellipse cx={x} cy={y} rx={r * 1.1} ry={r * 0.18} fill="#000" opacity={0.3} />
      <path d={dome} fill={`url(#${grad})`} />
      <path d={dome} fill="#fff" filter={`url(#${id}-grooves)`} />
    </g>
  );
}

// Mushroom corals: flat discs with radial ridges and a central mouth.
function Mushrooms({ seed, spots, color, center }: { seed: number; spots: Pt[]; color: string; center: string }) {
  const rand = rng(seed);
  return (
    <g>
      {spots.map(([x, y], i) => {
        const r = 9 + rand() * 6;
        return (
          <g key={i} transform={`rotate(${(rand() - 0.5) * 30} ${x} ${y})`}>
            <ellipse cx={x} cy={y} rx={r} ry={r * 0.5} fill={color} />
            {Array.from({ length: 10 }, (_, k) => {
              const a = (k / 10) * Math.PI * 2;
              return <line key={k} x1={x} y1={y} x2={x + Math.cos(a) * r * 0.92} y2={y + Math.sin(a) * r * 0.46} stroke="#000" strokeOpacity={0.18} strokeWidth={0.8} />;
            })}
            <ellipse cx={x} cy={y} rx={r * 0.28} ry={r * 0.15} fill={center} />
            <ellipse cx={x - r * 0.3} cy={y - r * 0.18} rx={r * 0.4} ry={r * 0.12} fill="#fff" opacity={0.25} />
          </g>
        );
      })}
    </g>
  );
}

// Zoanthids: a carpet of small polyps, each a colored ring around a bright disc.
function Zoanthids({ seed, x, y, w, ring, disc }: { seed: number; x: number; y: number; w: number; ring: string; disc: string }) {
  const rand = rng(seed);
  const polyps = Array.from({ length: Math.round(w / 5) }, () => {
    const px = x + (rand() - 0.5) * w;
    const py = y + (rand() - 0.5) * w * 0.3;
    return { px, py, r: 3 + rand() * 2.5 };
  }).sort((a, b) => a.py - b.py);
  return (
    <g>
      {polyps.map(({ px, py, r }, i) => (
        <g key={i}>
          <ellipse cx={px} cy={py + 1} rx={r} ry={r * 0.75} fill="#000" opacity={0.25} />
          <ellipse cx={px} cy={py} rx={r} ry={r * 0.7} fill={ring} />
          <ellipse cx={px} cy={py} rx={r * 0.6} ry={r * 0.4} fill={disc} />
          <ellipse cx={px} cy={py} rx={r * 0.18} ry={r * 0.12} fill="#2a1a10" />
        </g>
      ))}
    </g>
  );
}

// ---------- Rock ----------

const ROCKS: { pts: Pt[]; seed: number }[] = [
  // Left mound.
  { seed: 11, pts: [[70, 352], [100, 300], [145, 262], [185, 226], [232, 204], [270, 214], [305, 240], [345, 262], [392, 292], [432, 324], [452, 352]] },
  // Right arch: up the left pillar, across the top, down the right pillar, back under the arch.
  {
    seed: 23,
    pts: [[598, 352], [606, 300], [616, 262], [642, 236], [690, 226], [742, 224], [792, 230], [838, 242], [872, 264], [892, 302], [906, 352], [866, 352], [850, 318], [822, 298], [782, 290], [736, 294], [706, 306], [690, 326], [682, 352]],
  },
  // Rubble in front of the mound and in the middle.
  { seed: 31, pts: [[288, 354], [306, 314], [350, 286], [402, 274], [446, 284], [482, 314], [496, 354]] },
  { seed: 37, pts: [[508, 354], [520, 324], [556, 306], [592, 318], [606, 354]] },
];

function LiveRock({ id, pts, seed }: { id: string; pts: Pt[]; seed: number }) {
  const rand = rng(seed);
  const outline = smoothClosed(pts);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const [minX, maxX, minY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys)];
  const clip = `${id}-rockclip${seed}`;
  // Patches of pink and purple coralline algae.
  const algae = Array.from({ length: 9 }, (_, i) => ({
    d: blob(minX + rand() * (maxX - minX), minY + 10 + rand() * (SAND_Y - minY - 10), 14 + rand() * 22, rand, 0.6),
    color: ['#d98ab4', '#a982d6', '#e7a3a3'][i % 3],
  }));
  return (
    <g filter={`url(#${id}-rock)`}>
      <defs>
        <clipPath id={clip}>
          <path d={outline} />
        </clipPath>
      </defs>
      <path d={outline} fill={`url(#${id}-rockfill)`} />
      <g clipPath={`url(#${clip})`}>
        {algae.map((a, i) => (
          <path key={i} d={a.d} fill={a.color} opacity={0.55} />
        ))}
        {/* Shade the underside and the base where it meets the sand. */}
        <rect x={minX} y={minY} width={maxX - minX} height={SAND_Y - minY + 4} fill={`url(#${id}-rockshade)`} />
      </g>
    </g>
  );
}

// ---------- Layers ----------

// Everything behind the fish: distant reef haze, sand, rock and corals.
export function BackScape() {
  const id = `reef${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <svg className="reefscape reefscape--back" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <Filters id={id} />
      <defs>
        <linearGradient id={`${id}-rockfill`} gradientUnits="userSpaceOnUse" x1="0" y1="200" x2="0" y2={SAND_Y}>
          <stop offset="0%" stopColor="#c4b8a8" />
          <stop offset="100%" stopColor="#7b7068" />
        </linearGradient>
        <linearGradient id={`${id}-rockshade`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0a3a6a" stopOpacity={0} />
          <stop offset="70%" stopColor="#0a3a6a" stopOpacity={0.1} />
          <stop offset="100%" stopColor="#0a2a4a" stopOpacity={0.45} />
        </linearGradient>
        <linearGradient id={`${id}-sandfill`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d9dcd2" />
          <stop offset="100%" stopColor="#efe6d0" />
        </linearGradient>
        {/* Distance haze: the far reef fades into the water color. */}
        <linearGradient id={`${id}-fog`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8fd8ff" stopOpacity={0} />
          <stop offset="100%" stopColor="#8fd8ff" stopOpacity={0.45} />
        </linearGradient>
        <linearGradient id={`${id}-sandtint`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2f8fd6" stopOpacity={0.45} />
          <stop offset="100%" stopColor="#2f8fd6" stopOpacity={0} />
        </linearGradient>
      </defs>

      {/* Far reef silhouettes, blurred by distance. */}
      <g filter={`url(#${id}-haze)`}>
        <path
          d="M0 350 L0 300 Q40 262 90 286 Q130 236 180 270 Q230 250 270 282 Q330 232 400 276 Q450 258 500 290 Q560 246 620 282 Q680 252 730 278 Q790 236 850 274 Q910 250 960 280 Q985 270 1000 276 L1000 350 Z"
          fill="#1f6fb8"
          opacity={0.5}
        />
        <path d="M0 350 L0 320 Q80 296 160 316 Q260 292 360 318 Q470 296 560 320 Q660 298 760 318 Q880 294 1000 314 L1000 350 Z" fill="#2a7cc4" opacity={0.55} />
      </g>
      <rect x={0} y={220} width={W} height={SAND_Y - 220} fill={`url(#${id}-fog)`} />

      <SeaFan seed={5} x={150} y={300} height={190} color="#9b3a8c" />
      <SeaFan seed={8} x={878} y={300} height={150} color="#d9582f" />

      {/* Sand bed, bluer toward the back where there's more water in the way. */}
      <path d={`M0 ${H} L0 ${SAND_Y - 8} Q120 ${SAND_Y - 14} 250 ${SAND_Y - 9} T500 ${SAND_Y - 11} T750 ${SAND_Y - 7} T${W} ${SAND_Y - 12} L${W} ${H} Z`} fill={`url(#${id}-sandfill)`} filter={`url(#${id}-sand)`} />
      <rect x={0} y={SAND_Y - 14} width={W} height={30} fill={`url(#${id}-sandtint)`} />

      {/* Shadows the rocks cast on the sand. */}
      <g fill="#0b2c4a" opacity={0.35} filter={`url(#${id}-soft)`}>
        <ellipse cx={265} cy={SAND_Y + 4} rx={210} ry={12} />
        <ellipse cx={755} cy={SAND_Y + 4} rx={170} ry={11} />
        <ellipse cx={556} cy={SAND_Y + 4} rx={55} ry={7} />
      </g>

      {ROCKS.map((r) => (
        <LiveRock key={r.seed} id={id} pts={r.pts} seed={r.seed} />
      ))}

      <TableCoral id={id} x={352} y={272} size={70} color="#a8a36a" rim="#cfe7a0" />
      <BranchingCoral id={id} seed={3} x={226} y={214} height={120} base="#7b5aa6" tip="#a9f0ff" />
      <BranchingCoral id={id} seed={9} x={770} y={236} height={105} base="#c95c6e" tip="#ffd7b0" />
      <BranchingCoral id={id} seed={14} x={556} y={312} height={70} base="#4f9a63" tip="#d6ff9e" spread={0.5} />
      <BranchingCoral id={id} seed={21} x={650} y={244} height={60} base="#3f7fbf" tip="#c8f1ff" />
      <Mushrooms seed={4} spots={[[165, 292], [190, 304], [150, 318], [205, 324]]} color="#b8324a" center="#4ad6b4" />
      <Mushrooms seed={6} spots={[[860, 300], [878, 318]]} color="#2fae9a" center="#ffd04a" />
      <Zoanthids seed={2} x={640} y={300} w={46} ring="#ff8a3d" disc="#5cf08f" />
      <Zoanthids seed={7} x={420} y={300} w={40} ring="#ff5fa8" disc="#ffe46b" />
      <BrainCoral id={id} x={470} y={SAND_Y + 6} r={30} color="#5e8a3e" light="#b6d97a" />
    </svg>
  );
}

// The few things between the fish and the front glass.
export function FrontScape() {
  const id = `reef${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <svg className="reefscape reefscape--front" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <Filters id={id} />
      <defs>
        <linearGradient id={`${id}-rockfill`} gradientUnits="userSpaceOnUse" x1="0" y1="350" x2="0" y2={H}>
          <stop offset="0%" stopColor="#cbbfae" />
          <stop offset="100%" stopColor="#6e645c" />
        </linearGradient>
        <linearGradient id={`${id}-rockshade`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="60%" stopColor="#0a2a4a" stopOpacity={0} />
          <stop offset="100%" stopColor="#0a2a4a" stopOpacity={0.4} />
        </linearGradient>
        <linearGradient id={`${id}-sandfill`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f3ead6" />
          <stop offset="100%" stopColor="#e2d4b4" />
        </linearGradient>
      </defs>
      <path d={`M0 ${H} L0 386 Q250 378 500 385 T${W} 380 L${W} ${H} Z`} fill={`url(#${id}-sandfill)`} filter={`url(#${id}-sand)`} />
      <LiveRock id={id} seed={41} pts={[[40, 404], [56, 372], [90, 356], [134, 360], [172, 378], [192, 404]]} />
      <LiveRock id={id} seed={43} pts={[[812, 404], [834, 378], [878, 362], [930, 366], [960, 404]]} />
      <Zoanthids seed={12} x={106} y={366} w={50} ring="#7a5cff" disc="#ff9f3d" />
      <BrainCoral id={id} x={640} y={396} r={22} color="#c26a2e" light="#ffc27a" />
      <Mushrooms seed={9} spots={[[880, 374], [902, 380]]} color="#6a3fbf" center="#ff6ad5" />
    </svg>
  );
}

// ---------- Moving life ----------

const SEAGRASS: { left: number; height: number; color: string; blades: number }[] = [
  { left: 2, height: 66, color: '#3f9a4a', blades: 6 },
  { left: 92, height: 56, color: '#4ea852', blades: 5 },
];

// Ribbon-like seagrass: tapered, translucent blades with a pale midrib.
export function Seagrass() {
  const id = `grass${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <>
      {SEAGRASS.map((p, i) => (
        <svg
          key={p.left}
          className="aquarium__plant"
          style={{ left: `${p.left}%`, height: `${p.height}%`, animationDelay: `${-i * 1.7}s` }}
          viewBox="0 0 60 200"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={`${id}-${i}`} x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor={p.color} stopOpacity={0.95} />
              <stop offset="100%" stopColor="#a8e07a" stopOpacity={0.75} />
            </linearGradient>
          </defs>
          {Array.from({ length: p.blades }, (_, b) => {
            const x = 30 + (b - (p.blades - 1) / 2) * 4;
            const lean = (b - (p.blades - 1) / 2) * 7;
            const top = 6 + ((b * 47) % 60);
            const w = 3.4;
            const d = `M${x - w} 200 C${x - w + lean * 0.3} 140, ${x + lean} 90, ${x + lean * 1.4} ${top} C${x + lean + w * 0.6} 90, ${x + w + lean * 0.3} 140, ${x + w} 200 Z`;
            return (
              <g key={b}>
                <path d={d} fill={`url(#${id}-${i})`} />
                <path d={`M${x} 200 C${x + lean * 0.3} 140, ${x + lean} 90, ${x + lean * 1.38} ${top + 4}`} stroke="#d8ffb0" strokeOpacity={0.35} strokeWidth={0.6} fill="none" />
              </g>
            );
          })}
        </svg>
      ))}
    </>
  );
}

// A bubble-tip anemone: a mound of soft tentacles with swollen tips.
export function Anemone() {
  const id = `anem${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const rand = rng(17);
  const tentacles = Array.from({ length: 34 }, (_, i) => {
    const t = i / 33;
    const baseX = 22 + t * 76;
    const lean = (t - 0.5) * 50 + (rand() - 0.5) * 14;
    const len = 34 + (1 - Math.abs(t - 0.5) * 1.6) * 30 + rand() * 10;
    return { baseX, lean, len, back: i % 2 === 0 };
  });
  const tentacle = (tn: (typeof tentacles)[number], fill: string, tip: string, k: number) => {
    const tipX = tn.baseX + tn.lean;
    const tipY = 96 - tn.len;
    return (
      <g key={`${tn.baseX}-${k}`}>
        <path d={`M${tn.baseX - 3} 96 Q${tn.baseX + tn.lean * 0.2} ${96 - tn.len * 0.6}, ${tipX} ${tipY} Q${tn.baseX + tn.lean * 0.2 + 2} ${96 - tn.len * 0.55}, ${tn.baseX + 3} 96 Z`} fill={fill} />
        <circle cx={tipX} cy={tipY} r={3.2} fill={tip} />
        <circle cx={tipX - 0.8} cy={tipY - 0.9} r={1} fill="#fff" opacity={0.6} />
      </g>
    );
  };
  return (
    <svg className="aquarium__anemone" viewBox="0 0 120 100" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-t`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#c23a6a" />
          <stop offset="100%" stopColor="#ff8fb8" />
        </linearGradient>
      </defs>
      {tentacles.filter((t) => t.back).map((t) => tentacle(t, '#a52f5c', '#e86b9a', 0))}
      {tentacles.filter((t) => !t.back).map((t) => tentacle(t, `url(#${id}-t)`, '#ffc2da', 1))}
      <ellipse cx={60} cy={96} rx={44} ry={6} fill="#7a2446" />
    </svg>
  );
}
