import { useId } from 'react';
import type { Fish, FishBody, FishFins, FishLook, FishMarking, FishTail } from '../../data';

export interface FishSpriteProps {
  fish: Fish;
  // Width in px. Height follows the sprite's 3:2 shape.
  size?: number;
  className?: string;
}

// A side-on vector fish facing right, built from its anatomy in fish.look:
// body outline, tail, fins with rays, scales, gill cover, eye and markings.
export function FishSprite({ fish, size = 96, className = '' }: FishSpriteProps) {
  const { look } = fish;
  // useId output contains characters that aren't safe inside url(#...).
  const id = `fish${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <svg
      className={`fish-sprite ${className}`}
      width={size}
      height={(size * 2) / 3}
      viewBox="0 0 120 80"
      role="img"
      aria-label={fish.name}
    >
      {look.body === 'jelly' ? <Jelly look={look} id={id} /> : <SideFish look={look} id={id} />}
    </svg>
  );
}

// ---------- Geometry ----------

const CY = 40;
const TAIL_X = 26;
const SNOUT_X = 108;
const LEN = SNOUT_X - TAIL_X;

interface BodySpec {
  // Half-height at the deepest point, and at the tail end.
  h: number;
  ped: number;
  // Where the body is deepest, 0 (tail) to 1 (snout).
  peak: number;
  // How rounded the head is (puffers are blunt).
  blunt: number;
}

const BODIES: Record<Exclude<FishBody, 'jelly'>, BodySpec> = {
  slender: { h: 12, ped: 4.5, peak: 0.55, blunt: 0.5 },
  oval: { h: 18, ped: 6, peak: 0.55, blunt: 0.55 },
  deep: { h: 25, ped: 6, peak: 0.5, blunt: 0.6 },
  puffer: { h: 24, ped: 7, peak: 0.45, blunt: 0.85 },
};

type Pt = [number, number];

// Body coordinates (x 0..1 tail→snout, y -1..1 back→belly) to the viewBox.
const bx = (x: number) => TAIL_X + x * LEN;
const lerp = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

// Approximate half-height of the body at x, used to seat fins on its edge.
function halfHeightAt(b: BodySpec, x: number) {
  const t = Math.min(Math.max(x, 0), 1);
  const bump = t <= b.peak ? Math.sin((Math.PI / 2) * (t / b.peak)) : Math.cos((Math.PI / 2) * ((t - b.peak) / (1 - b.peak))) ** 0.6;
  return b.ped + (b.h - b.ped) * bump;
}

function bodyPath(b: BodySpec) {
  const px = bx(b.peak);
  const { h, ped } = b;
  return [
    `M${TAIL_X} ${CY - ped}`,
    `C${TAIL_X + LEN * 0.15} ${CY - ped - 1}, ${px - LEN * 0.22} ${CY - h}, ${px} ${CY - h}`,
    `C${px + LEN * 0.2} ${CY - h}, ${SNOUT_X - LEN * 0.05} ${CY - h * b.blunt}, ${SNOUT_X} ${CY + 1}`,
    `C${SNOUT_X - LEN * 0.04} ${CY + h * (b.blunt + 0.05)}, ${px + LEN * 0.2} ${CY + h}, ${px} ${CY + h}`,
    `C${px - LEN * 0.22} ${CY + h}, ${TAIL_X + LEN * 0.15} ${CY + ped + 1}, ${TAIL_X} ${CY + ped}`,
    'Z',
  ].join(' ');
}

// Tail outlines, anchored at the tail end of the body, with the points the fin
// rays fan out to.
function tailShape(kind: FishTail, ped: number): { d: string; tips: Pt[] } {
  const L = TAIL_X;
  switch (kind) {
    case 'forked':
      return {
        d: `M${L + 2} ${CY - ped} C${L - 6} ${CY - ped - 4}, ${L - 14} ${CY - 16}, ${L - 20} ${CY - 19} C${L - 14} ${CY - 8}, ${L - 12} ${CY - 2}, ${L - 10} ${CY} C${L - 12} ${CY + 2}, ${L - 14} ${CY + 8}, ${L - 20} ${CY + 19} C${L - 14} ${CY + 16}, ${L - 6} ${CY + ped + 4}, ${L + 2} ${CY + ped} Z`,
        tips: [[L - 19, CY - 18], [L - 15, CY - 10], [L - 11, CY - 3], [L - 11, CY + 3], [L - 15, CY + 10], [L - 19, CY + 18]],
      };
    case 'lyre':
      return {
        d: `M${L + 2} ${CY - ped} C${L - 4} ${CY - ped - 8}, ${L - 16} ${CY - 20}, ${L - 26} ${CY - 27} C${L - 16} ${CY - 12}, ${L - 12} ${CY - 3}, ${L - 10} ${CY} C${L - 12} ${CY + 3}, ${L - 16} ${CY + 12}, ${L - 26} ${CY + 27} C${L - 16} ${CY + 20}, ${L - 4} ${CY + ped + 8}, ${L + 2} ${CY + ped} Z`,
        tips: [[L - 24, CY - 25], [L - 16, CY - 13], [L - 11, CY - 4], [L - 11, CY + 4], [L - 16, CY + 13], [L - 24, CY + 25]],
      };
    case 'rounded':
      return {
        d: `M${L + 2} ${CY - ped} C${L - 8} ${CY - ped - 10}, ${L - 18} ${CY - 13}, ${L - 19} ${CY} C${L - 18} ${CY + 13}, ${L - 8} ${CY + ped + 10}, ${L + 2} ${CY + ped} Z`,
        tips: [[L - 10, CY - 13], [L - 16, CY - 8], [L - 18, CY - 2], [L - 18, CY + 3], [L - 16, CY + 8], [L - 10, CY + 13]],
      };
    case 'fan':
      return {
        d: `M${L + 2} ${CY - ped + 1} L${L - 22} ${CY - 22} Q${L - 31} ${CY}, ${L - 22} ${CY + 22} L${L + 2} ${CY + ped - 1} Z`,
        tips: Array.from({ length: 9 }, (_, i): Pt => {
          const a = -0.85 + (1.7 * i) / 8;
          return [L - 24 - Math.cos(a) * 4, CY + Math.sin(a) * 25];
        }),
      };
    case 'veil':
      return {
        d: `M${L + 2} ${CY - ped} C${L - 10} ${CY - ped - 14}, ${L - 26} ${CY - 20}, ${L - 29} ${CY - 4} C${L - 31} ${CY + 14}, ${L - 22} ${CY + 30}, ${L - 12} ${CY + 33} C${L - 8} ${CY + 22}, ${L - 4} ${CY + ped + 6}, ${L + 2} ${CY + ped} Z`,
        tips: [[L - 14, CY - 15], [L - 24, CY - 12], [L - 28, CY - 2], [L - 28, CY + 10], [L - 24, CY + 22], [L - 14, CY + 30]],
      };
  }
}

interface FinSpec {
  // Where the fin's base starts and ends along the body (front has larger x).
  front: number;
  rear: number;
  // Outline points as [x along body, distance out from the body edge].
  edge: [number, number][];
}

const DORSAL: Record<FishFins, FinSpec> = {
  short: { front: 0.64, rear: 0.34, edge: [[0.6, 6], [0.5, 11], [0.4, 12], [0.35, 4]] },
  spiny: { front: 0.8, rear: 0.12, edge: [[0.77, 6], [0.62, 7], [0.5, 6], [0.36, 10], [0.2, 10], [0.12, 4]] },
  flowing: { front: 0.62, rear: 0.1, edge: [[0.56, 10], [0.36, 16], [0.12, 21], [-0.06, 15]] },
  sail: { front: 0.64, rear: 0.3, edge: [[0.58, 9], [0.44, 19], [0.28, 27], [0.12, 29]] },
};

const ANAL: Record<FishFins, FinSpec> = {
  short: { front: 0.45, rear: 0.2, edge: [[0.42, 6], [0.32, 10], [0.22, 8]] },
  spiny: { front: 0.5, rear: 0.12, edge: [[0.46, 7], [0.32, 10], [0.16, 8], [0.12, 3]] },
  flowing: { front: 0.7, rear: 0.08, edge: [[0.62, 14], [0.36, 20], [0.12, 25], [-0.05, 18]] },
  sail: { front: 0.6, rear: 0.28, edge: [[0.54, 9], [0.42, 19], [0.26, 26], [0.12, 27]] },
};

const PUFFER_FIN: FinSpec = { front: 0.3, rear: 0.13, edge: [[0.27, 6], [0.18, 9], [0.12, 4]] };

// A fin outline (smoothed through its edge points) and rays from its base.
function finGeometry(b: BodySpec, spec: FinSpec, side: -1 | 1) {
  const baseY = (x: number) => CY + side * (halfHeightAt(b, x) - 2);
  const front: Pt = [bx(spec.front), baseY(spec.front)];
  const rear: Pt = [bx(spec.rear), baseY(spec.rear)];
  const edge = spec.edge.map(([x, out]): Pt => [bx(x), CY + side * (halfHeightAt(b, x) + out)]);
  const pts = [front, ...edge, rear];

  // Quadratic curves through midpoints give a smooth outline.
  let d = `M${front[0]} ${front[1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const m = lerp(pts[i], pts[i + 1], 0.5);
    d += ` Q${pts[i][0]} ${pts[i][1]}, ${i === pts.length - 2 ? `${rear[0]} ${rear[1]}` : `${m[0]} ${m[1]}`}`;
  }
  d += ' Z';

  const rays = edge.map((tip, i) => {
    const base = lerp(front, rear, (i + 1) / (edge.length + 1));
    return { from: base, to: lerp(base, tip, 0.92) };
  });
  return { d, rays };
}

// ---------- Side-on fish ----------

interface PartProps {
  look: FishLook;
  id: string;
}

function SideFish({ look, id }: PartProps) {
  const b = BODIES[look.body as Exclude<FishBody, 'jelly'>];
  const isPuffer = look.body === 'puffer';
  const tail = tailShape(look.tail, b.ped);
  const dorsal = finGeometry(b, isPuffer ? PUFFER_FIN : DORSAL[look.fins], -1);
  const anal = finGeometry(b, isPuffer ? PUFFER_FIN : ANAL[look.fins], 1);
  const body = bodyPath(b);
  const tailColor = look.tailColor ?? look.fin;
  const eyeX = bx(isPuffer ? 0.86 : 0.88);
  const eyeY = CY - b.h * (isPuffer ? 0.25 : 0.18);
  const eyeR = Math.min(Math.max(b.h * (isPuffer ? 0.22 : 0.17), 2.6), 5.2);
  const pec: Pt = [bx(0.7), CY + b.h * 0.25];
  const ref = (name: string) => `url(#${id}-${name})`;

  return (
    <g>
      <defs>
        <linearGradient id={`${id}-body`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={look.back} />
          <stop offset={isPuffer ? '45%' : '30%'} stopColor={look.back} />
          <stop offset={isPuffer ? '60%' : '78%'} stopColor={look.belly} />
          <stop offset="100%" stopColor={look.belly} />
        </linearGradient>
        <linearGradient id={`${id}-fin`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={look.fin} stopOpacity={0.55} />
          <stop offset="100%" stopColor={look.fin} stopOpacity={0.85} />
        </linearGradient>
        <linearGradient id={`${id}-tail`} x1="1" y1="0" x2="0" y2="0">
          <stop offset="0%" stopColor={tailColor} stopOpacity={0.95} />
          <stop offset="100%" stopColor={tailColor} stopOpacity={0.6} />
        </linearGradient>
        {/* Rounds the body: darker along the back and belly edges and toward the tail. */}
        <linearGradient id={`${id}-shade-v`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#000" stopOpacity={0.3} />
          <stop offset="28%" stopColor="#000" stopOpacity={0} />
          <stop offset="72%" stopColor="#000" stopOpacity={0} />
          <stop offset="100%" stopColor="#000" stopOpacity={0.22} />
        </linearGradient>
        <linearGradient id={`${id}-shade-h`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#000" stopOpacity={0.22} />
          <stop offset="35%" stopColor="#000" stopOpacity={0} />
        </linearGradient>
        <radialGradient id={`${id}-sheen`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#fff" stopOpacity={0.55} />
          <stop offset="100%" stopColor="#fff" stopOpacity={0} />
        </radialGradient>
        {/* Overlapping scale rows. */}
        <pattern id={`${id}-scales`} width={4} height={5} patternUnits="userSpaceOnUse">
          <path d="M0 2.5 Q2 0 4 2.5 M-2 5 Q0 2.5 2 5 M2 5 Q4 2.5 6 5" fill="none" stroke="#fff" strokeOpacity={0.22} strokeWidth={0.45} />
          <path d="M0 2.6 Q2 0.1 4 2.6" fill="none" stroke="#000" strokeOpacity={0.12} strokeWidth={0.35} transform="translate(0 0.6)" />
        </pattern>
        <clipPath id={`${id}-clip`}>
          <path d={body} />
        </clipPath>
      </defs>

      {/* Fins behind the body. */}
      <Fin d={anal.d} rays={anal.rays} fill={ref('fin')} look={look} />
      <Fin d={dorsal.d} rays={dorsal.rays} fill={ref('fin')} look={look} />
      <g className="fish-sprite__tail">
        <Fin d={tail.d} rays={tail.tips.map((t) => ({ from: [TAIL_X + 1, CY] as Pt, to: t }))} fill={ref('tail')} look={look} />
      </g>
      {look.fins === 'sail' ? (
        // Angelfish's long trailing pelvic filaments.
        <path d={`M${bx(0.66)} ${CY + b.h - 3} Q${bx(0.6)} ${CY + b.h + 12}, ${bx(0.48)} ${CY + b.h + 22}`} stroke={look.fin} strokeWidth={1.4} fill="none" strokeLinecap="round" opacity={0.85} />
      ) : (
        <path d={`M${bx(0.66)} ${CY + b.h - 3} Q${bx(0.6)} ${CY + b.h + 6}, ${bx(0.54)} ${CY + b.h + 7} L${bx(0.6)} ${CY + b.h - 3} Z`} fill={ref('fin')} />
      )}

      {/* Body, with markings, scales and shading clipped to its outline. */}
      <path d={body} fill={ref('body')} />
      <g clipPath={ref('clip')}>
        {look.markings?.map((m, i) => <Marking key={i} m={m} b={b} index={i} />)}
        <rect x={0} y={0} width={120} height={80} fill={ref('scales')} />
        <rect x={0} y={0} width={120} height={80} fill={ref('shade-v')} />
        <rect x={0} y={0} width={120} height={80} fill={ref('shade-h')} />
        {/* Lateral line. */}
        <path d={`M${bx(0.74)} ${CY - b.h * 0.35} Q${bx(0.45)} ${CY - b.h * 0.3}, ${TAIL_X} ${CY}`} stroke="#fff" strokeOpacity={0.25} strokeWidth={0.6} strokeDasharray="1 1.2" fill="none" />
        {/* Gill cover. */}
        <path d={`M${bx(0.78)} ${CY - b.h * 0.8} Q${bx(0.71)} ${CY + b.h * 0.1}, ${bx(0.78)} ${CY + b.h * 0.85}`} stroke="#000" strokeOpacity={0.22} strokeWidth={1.1} fill="none" />
        <ellipse cx={bx(0.58)} cy={CY - b.h * 0.55} rx={LEN * 0.26} ry={b.h * 0.28} fill={ref('sheen')} />
      </g>

      {/* Pectoral fin on the near side. */}
      <g className="fish-sprite__pectoral">
        <path
          d={`M${pec[0]} ${pec[1]} Q${pec[0] - 6} ${pec[1] - 6}, ${pec[0] - 13} ${pec[1] - 1} Q${pec[0] - 8} ${pec[1] + 6}, ${pec[0]} ${pec[1] + 2} Z`}
          fill={look.fin}
          opacity={0.6}
        />
        {[-4, -1, 2].map((dy) => (
          <line key={dy} x1={pec[0]} y1={pec[1] + 1} x2={pec[0] - 11} y2={pec[1] + dy} stroke="#000" strokeOpacity={0.18} strokeWidth={0.4} />
        ))}
      </g>

      <Eye x={eyeX} y={eyeY} r={eyeR} iris={look.eye ?? '#d9cfa3'} />
      <path d={`M${SNOUT_X - 0.5} ${CY + 2} Q${SNOUT_X - 3.5} ${CY + 3.8}, ${SNOUT_X - 6} ${CY + 3.2}`} stroke="#1a1410" strokeOpacity={0.6} strokeWidth={0.8} fill="none" strokeLinecap="round" />
      {look.barbels ? (
        <g stroke={look.belly} strokeWidth={0.9} fill="none" strokeLinecap="round" opacity={0.9}>
          <path d={`M${SNOUT_X - 2} ${CY + 3} q-1 5 -6 7`} />
          <path d={`M${SNOUT_X - 4} ${CY + 3.5} q-2 3 -6 4`} />
        </g>
      ) : null}
    </g>
  );
}

function Fin({ d, rays, fill, look }: { d: string; rays: { from: Pt; to: Pt }[]; fill: string; look: FishLook }) {
  return (
    <g>
      <path d={d} fill={fill} stroke={look.finEdge ?? 'none'} strokeWidth={1.2} strokeOpacity={0.8} />
      {rays.map(({ from, to }, i) => (
        <line key={i} x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]} stroke="#000" strokeOpacity={0.16} strokeWidth={0.5} />
      ))}
    </g>
  );
}

function Eye({ x, y, r, iris }: { x: number; y: number; r: number; iris: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r + 0.6} fill="#000" opacity={0.25} />
      <circle cx={x} cy={y} r={r} fill={iris} />
      <circle cx={x + r * 0.08} cy={y} r={r * 0.62} fill="#0a0f14" />
      <circle cx={x + r * 0.32} cy={y - r * 0.32} r={r * 0.24} fill="#fff" opacity={0.9} />
    </g>
  );
}

function Marking({ m, b, index }: { m: FishMarking; b: BodySpec; index: number }) {
  const y = (v: number) => CY + v * b.h;
  switch (m.kind) {
    case 'bar': {
      // A vertical band, bowed slightly toward the head like a clownfish's.
      const a = bx(m.x - m.width / 2);
      const z = bx(m.x + m.width / 2);
      const top = CY - b.h - 4;
      const bottom = CY + b.h + 4;
      return (
        <path
          d={`M${a} ${top} Q${a + 5} ${CY}, ${a} ${bottom} L${z} ${bottom} Q${z + 5} ${CY}, ${z} ${top} Z`}
          fill={m.color}
          stroke={m.edge ?? 'none'}
          strokeWidth={1.6}
        />
      );
    }
    case 'stripe': {
      const x1 = bx(m.from);
      const x2 = bx(m.to);
      const yy = y(m.y);
      const d = `M${x1} ${yy} Q${(x1 + x2) / 2} ${yy - (m.curve ?? 0) * b.h * 2}, ${x2} ${yy}`;
      const w = m.width * b.h;
      return (
        <g fill="none" strokeLinecap="round">
          {m.glow ? <path d={d} stroke={m.color} strokeWidth={w * 1.9} opacity={0.3} /> : null}
          <path d={d} stroke={m.color} strokeWidth={w} />
          {m.glow ? <path d={d} stroke="#fff" strokeWidth={w * 0.3} opacity={0.5} /> : null}
        </g>
      );
    }
    case 'patch': {
      // An irregular blob: a ring of points at varying radius.
      const cx = bx(m.x);
      const cy = y(m.y);
      const r = m.r * b.h;
      const pts = Array.from({ length: 8 }, (_, i): Pt => {
        const a = (i / 8) * Math.PI * 2;
        const k = 0.72 + 0.28 * Math.sin(i * 2.3 + index * 1.7);
        return [cx + Math.cos(a) * r * k * 1.4, cy + Math.sin(a) * r * k];
      });
      let d = `M${lerp(pts[7], pts[0], 0.5).join(' ')}`;
      pts.forEach((p, i) => {
        const next = lerp(p, pts[(i + 1) % 8], 0.5);
        d += ` Q${p[0]} ${p[1]}, ${next[0]} ${next[1]}`;
      });
      return <path d={d} fill={m.color} opacity={0.92} />;
    }
    case 'spots':
      return (
        <g fill={m.color} opacity={0.75}>
          {Array.from({ length: 26 }, (_, i) => (
            <circle key={i} cx={bx(0.08 + ((i * 0.377) % 0.82))} cy={y(-0.95 + ((i * 0.618) % 1) * 0.95)} r={0.9 + ((i * 7) % 5) * 0.18} />
          ))}
        </g>
      );
  }
}

// ---------- Jellyfish ----------

function Jelly({ look, id }: PartProps) {
  const ref = (name: string) => `url(#${id}-${name})`;
  // Scalloped bell margin.
  const rim = Array.from({ length: 8 }, (_, i) => {
    const x = 30 + i * 7.5;
    return `Q${x + 3.75} ${41 + (i % 2) * 1.5}, ${x + 7.5} 38`;
  }).join(' ');
  return (
    <g>
      <defs>
        <radialGradient id={`${id}-bell`} cx="0.45" cy="0.35" r="0.7">
          <stop offset="0%" stopColor={look.back} stopOpacity={0.85} />
          <stop offset="70%" stopColor={look.belly} stopOpacity={0.45} />
          <stop offset="100%" stopColor={look.belly} stopOpacity={0.7} />
        </radialGradient>
        <linearGradient id={`${id}-tentacle`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={look.fin} stopOpacity={0.9} />
          <stop offset="100%" stopColor={look.fin} stopOpacity={0} />
        </linearGradient>
      </defs>
      {/* Long, fine trailing tentacles. */}
      <g stroke={ref('tentacle')} strokeWidth={0.9} fill="none" strokeLinecap="round">
        {Array.from({ length: 9 }, (_, i) => {
          const x = 32 + i * 7;
          const sway = (i % 2 ? 1 : -1) * 4;
          return <path key={i} d={`M${x} 39 C${x + sway} 55, ${x - sway} 68, ${x + sway / 2} 86`} />;
        })}
      </g>
      {/* Frilly oral arms. */}
      <g fill={look.fin} opacity={0.55}>
        {[52, 60, 68].map((x, i) => (
          <path key={x} d={`M${x - 3} 38 Q${x - 6 + i * 2} 50, ${x - 2} 62 Q${x + 1} 66, ${x + 3} 61 Q${x + 2 - i} 50, ${x + 3} 38 Z`} />
        ))}
      </g>
      <g className="fish-sprite__bell">
        <path d="M30 38 Q28 6 60 6 Q92 6 90 38 Z" fill={ref('bell')} />
        <path d={`M30 38 ${rim}`} fill="none" stroke={look.belly} strokeWidth={1.2} opacity={0.8} />
        {/* Gonads: four faint horseshoes seen through the bell. */}
        <g fill="none" stroke={look.belly} strokeWidth={2.2} opacity={0.45}>
          <path d="M44 26 q4 -8 8 0" />
          <path d="M54 22 q4 -8 8 0" />
          <path d="M64 22 q4 -8 8 0" />
          <path d="M70 28 q4 -8 8 0" />
        </g>
        <ellipse cx={50} cy={15} rx={13} ry={4.5} fill="#fff" opacity={0.55} />
      </g>
    </g>
  );
}
