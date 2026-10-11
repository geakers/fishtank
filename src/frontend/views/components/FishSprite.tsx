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
      {look.body === 'none' ? null : look.body === 'jelly' ? (
        <Jelly look={look} id={id} />
      ) : look.body === 'human' ? (
        <Dude look={look} />
      ) : (
        <SideFish look={look} id={id} />
      )}
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

const BODIES: Record<Exclude<FishBody, 'jelly' | 'human' | 'none'>, BodySpec> = {
  slender: { h: 12, ped: 4.5, peak: 0.55, blunt: 0.5 },
  oval: { h: 18, ped: 6, peak: 0.55, blunt: 0.55 },
  deep: { h: 25, ped: 6, peak: 0.5, blunt: 0.6 },
  puffer: { h: 24, ped: 7, peak: 0.45, blunt: 0.85 },
  shark: { h: 13, ped: 3.5, peak: 0.42, blunt: 0.2 },
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
    case 'shark':
      // Heterocercal: a long upper lobe and a short lower one.
      return {
        d: `M${L + 2} ${CY - ped} C${L - 6} ${CY - ped - 6}, ${L - 16} ${CY - 19}, ${L - 25} ${CY - 27} C${L - 19} ${CY - 13}, ${L - 14} ${CY - 4}, ${L - 10} ${CY + 1} C${L - 12} ${CY + 5}, ${L - 15} ${CY + 10}, ${L - 17} ${CY + 14} C${L - 9} ${CY + 10}, ${L - 4} ${CY + ped + 3}, ${L + 2} ${CY + ped} Z`,
        tips: [[L - 23, CY - 25], [L - 16, CY - 15], [L - 11, CY - 5], [L - 14, CY + 8], [L - 16, CY + 12]],
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
  shark: { front: 0.66, rear: 0.44, edge: [[0.6, 9], [0.5, 17], [0.45, 16], [0.44, 4]] },
};

const ANAL: Record<FishFins, FinSpec> = {
  short: { front: 0.45, rear: 0.2, edge: [[0.42, 6], [0.32, 10], [0.22, 8]] },
  spiny: { front: 0.5, rear: 0.12, edge: [[0.46, 7], [0.32, 10], [0.16, 8], [0.12, 3]] },
  flowing: { front: 0.7, rear: 0.08, edge: [[0.62, 14], [0.36, 20], [0.12, 25], [-0.05, 18]] },
  sail: { front: 0.6, rear: 0.28, edge: [[0.54, 9], [0.42, 19], [0.26, 26], [0.12, 27]] },
  shark: { front: 0.24, rear: 0.14, edge: [[0.2, 5], [0.15, 5], [0.14, 2]] },
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
  const b = BODIES[look.body as Exclude<FishBody, 'jelly' | 'human' | 'none'>];
  const isPuffer = look.body === 'puffer';
  const isShark = look.body === 'shark';
  const skin = look.skin ?? 'scales';
  const extras = new Set(look.extras ?? []);
  const tail = tailShape(look.tail, b.ped);
  const dorsal = finGeometry(b, isPuffer ? PUFFER_FIN : DORSAL[look.fins], -1);
  const anal = finGeometry(b, isPuffer ? PUFFER_FIN : ANAL[look.fins], 1);
  const body = bodyPath(b);
  const tailColor = look.tailColor ?? look.fin;
  const eyeX = bx(isPuffer ? 0.86 : isShark ? 0.84 : 0.88);
  const eyeY = CY - b.h * (isPuffer ? 0.25 : isShark ? 0.2 : 0.18);
  const eyeR = isShark ? 2.2 : Math.min(Math.max(b.h * (isPuffer ? 0.22 : 0.17), 2.6), 5.2);
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
      {isShark ? (
        // Big swept-back pectoral fin and a small pelvic fin.
        <g>
          <path d={`M${bx(0.4)} ${CY + b.h - 3} L${bx(0.33)} ${CY + b.h + 5} L${bx(0.3)} ${CY + b.h - 3} Z`} fill={look.fin} />
          <path
            d={`M${bx(0.74)} ${CY + b.h * 0.35} Q${bx(0.66)} ${CY + b.h + 6}, ${bx(0.54)} ${CY + b.h + 13} Q${bx(0.6)} ${CY + b.h * 0.9}, ${bx(0.62)} ${CY + b.h * 0.55} Z`}
            fill={look.fin}
            stroke={look.finEdge ?? 'none'}
            strokeWidth={0.8}
            strokeOpacity={0.6}
          />
        </g>
      ) : look.fins === 'sail' ? (
        // Angelfish's long trailing pelvic filaments.
        <path d={`M${bx(0.66)} ${CY + b.h - 3} Q${bx(0.6)} ${CY + b.h + 12}, ${bx(0.48)} ${CY + b.h + 22}`} stroke={look.fin} strokeWidth={1.4} fill="none" strokeLinecap="round" opacity={0.85} />
      ) : (
        <path d={`M${bx(0.66)} ${CY + b.h - 3} Q${bx(0.6)} ${CY + b.h + 6}, ${bx(0.54)} ${CY + b.h + 7} L${bx(0.6)} ${CY + b.h - 3} Z`} fill={ref('fin')} />
      )}

      {extras.has('cat') ? <CatEars b={b} look={look} /> : null}
      {extras.has('robot') ? <Antenna b={b} /> : null}

      {/* Body, with markings, scales and shading clipped to its outline. */}
      <path d={body} fill={ref('body')} />
      <g clipPath={ref('clip')}>
        {look.markings?.map((m, i) => <Marking key={i} m={m} b={b} index={i} />)}
        {skin === 'scales' ? <rect x={0} y={0} width={120} height={80} fill={ref('scales')} /> : null}
        {skin === 'metal' ? <Plating b={b} /> : null}
        {extras.has('ninja') ? <NinjaMask b={b} eyeY={eyeY} /> : null}
        {extras.has('lucky') ? <FuCharm b={b} /> : null}
        {extras.has('flag') ? <Flag b={b} /> : null}
        {extras.has('spark') ? <Spark b={b} /> : null}
        <rect x={0} y={0} width={120} height={80} fill={ref('shade-v')} />
        <rect x={0} y={0} width={120} height={80} fill={ref('shade-h')} />
        {/* Lateral line. */}
        <path d={`M${bx(0.74)} ${CY - b.h * 0.35} Q${bx(0.45)} ${CY - b.h * 0.3}, ${TAIL_X} ${CY}`} stroke="#fff" strokeOpacity={0.25} strokeWidth={0.6} strokeDasharray="1 1.2" fill="none" />
        {isShark ? (
          // Five gill slits.
          [0, 1, 2, 3, 4].map((k) => (
            <path key={k} d={`M${bx(0.76 - k * 0.028)} ${CY - b.h * 0.3} q-1.4 ${b.h * 0.35} 0 ${b.h * 0.7}`} stroke="#000" strokeOpacity={0.3} strokeWidth={0.8} fill="none" />
          ))
        ) : skin === 'metal' ? null : (
          // Gill cover.
          <path d={`M${bx(0.78)} ${CY - b.h * 0.8} Q${bx(0.71)} ${CY + b.h * 0.1}, ${bx(0.78)} ${CY + b.h * 0.85}`} stroke="#000" strokeOpacity={0.22} strokeWidth={1.1} fill="none" />
        )}
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

      {extras.has('robot') ? (
        <RoboEye x={eyeX} y={eyeY} r={eyeR} color={look.eye ?? '#ff2a2a'} />
      ) : (
        <Eye x={eyeX} y={eyeY} r={eyeR} iris={look.eye ?? '#d9cfa3'} pupil={extras.has('cat') ? 'slit' : 'round'} />
      )}
      {extras.has('ninja') ? (
        // A fierce brow over the eye slit.
        <path d={`M${eyeX - eyeR - 1.5} ${eyeY - eyeR - 0.5} L${eyeX + eyeR + 1} ${eyeY - eyeR + 1.4}`} stroke="#000" strokeWidth={1.4} strokeLinecap="round" />
      ) : null}
      {isShark ? (
        // Underslung mouth.
        <path d={`M${bx(0.93)} ${CY + b.h * 0.3} Q${bx(0.88)} ${CY + b.h * 0.62}, ${bx(0.82)} ${CY + b.h * 0.48}`} stroke="#1a1410" strokeOpacity={0.55} strokeWidth={0.9} fill="none" strokeLinecap="round" />
      ) : extras.has('cat') ? (
        <CatFace look={look} />
      ) : skin === 'metal' ? (
        // Speaker-grille mouth.
        <g stroke="#2a3440" strokeWidth={0.7} strokeLinecap="round">
          {[0, 1, 2].map((k) => (
            <line key={k} x1={SNOUT_X - 6 + k * 1.6} y1={CY + 2.2} x2={SNOUT_X - 6.6 + k * 1.6} y2={CY + 5} />
          ))}
        </g>
      ) : (
        <path d={`M${SNOUT_X - 0.5} ${CY + 2} Q${SNOUT_X - 3.5} ${CY + 3.8}, ${SNOUT_X - 6} ${CY + 3.2}`} stroke="#1a1410" strokeOpacity={0.6} strokeWidth={0.8} fill="none" strokeLinecap="round" />
      )}
      {extras.has('whiskers') ? (
        // Long catfish barbels drooping from the mouth.
        <g stroke={look.back} strokeWidth={0.9} fill="none" strokeLinecap="round" opacity={0.9}>
          <path d={`M${SNOUT_X - 2} ${CY + 2} q6 2 7 12`} />
          <path d={`M${SNOUT_X - 3} ${CY + 3} q2 6 -4 14`} />
          <path d={`M${SNOUT_X - 1} ${CY} q8 -3 11 4`} />
        </g>
      ) : null}
      {extras.has('ninja') ? <NinjaBand b={b} /> : null}
      {extras.has('lucky') ? <DragonWhiskers b={b} /> : null}
      {extras.has('sparkle') ? <Sparkles b={b} /> : null}
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

function Eye({ x, y, r, iris, pupil = 'round' }: { x: number; y: number; r: number; iris: string; pupil?: 'round' | 'slit' }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r + 0.6} fill="#000" opacity={0.25} />
      <circle cx={x} cy={y} r={r} fill={iris} />
      {pupil === 'slit' ? (
        <ellipse cx={x + r * 0.08} cy={y} rx={r * 0.24} ry={r * 0.85} fill="#0a0f14" />
      ) : (
        <circle cx={x + r * 0.08} cy={y} r={r * 0.62} fill="#0a0f14" />
      )}
      <circle cx={x + r * 0.32} cy={y - r * 0.32} r={r * 0.24} fill="#fff" opacity={0.9} />
    </g>
  );
}

// ---------- Extras ----------

// The y of the body's top edge at x (0..1 along the body).
const topAt = (b: BodySpec, x: number) => CY - halfHeightAt(b, x);

function CatEars({ b, look }: { b: BodySpec; look: FishLook }) {
  const ear = (x0: number, x1: number, lean: number) => {
    const tipX = bx((x0 + x1) / 2) + lean;
    const tipY = Math.min(topAt(b, x0), topAt(b, x1)) - 10;
    const base0: Pt = [bx(x0), topAt(b, x0) + 3];
    const base1: Pt = [bx(x1), topAt(b, x1) + 3];
    const inner = (t: number): Pt => lerp([tipX, tipY + 2.5], t < 0.5 ? base0 : base1, 0.55);
    return (
      <g key={x0}>
        <path d={`M${base0[0]} ${base0[1]} L${tipX} ${tipY} L${base1[0]} ${base1[1]} Z`} fill={look.back} stroke="#000" strokeOpacity={0.15} strokeWidth={0.6} strokeLinejoin="round" />
        <path d={`M${inner(0)[0]} ${inner(0)[1]} L${tipX} ${tipY + 2.5} L${inner(1)[0]} ${inner(1)[1]} Z`} fill="#ffb0c0" />
      </g>
    );
  };
  return (
    <g>
      {ear(0.64, 0.76, -1)}
      {ear(0.8, 0.92, 1)}
    </g>
  );
}

// Pink nose, a little "w" mouth and long whiskers.
function CatFace({ look }: { look: FishLook }) {
  const nx = SNOUT_X - 2;
  const ny = CY - 0.5;
  return (
    <g strokeLinecap="round">
      <path d={`M${nx - 1.6} ${ny - 1} L${nx + 1.4} ${ny - 1} L${nx} ${ny + 0.8} Z`} fill="#ff7a9a" />
      <path d={`M${nx} ${ny + 0.8} q-0.6 1.8 -2.4 1.4 M${nx} ${ny + 0.8} q0.4 1.6 2 1.2`} stroke="#3a2010" strokeWidth={0.6} fill="none" />
      <g stroke={look.belly} strokeWidth={0.5} opacity={0.95}>
        <line x1={nx - 3} y1={ny + 1} x2={nx + 11} y2={ny - 3} />
        <line x1={nx - 3} y1={ny + 2} x2={nx + 12} y2={ny + 1.5} />
        <line x1={nx - 3} y1={ny + 3} x2={nx + 11} y2={ny + 6} />
      </g>
    </g>
  );
}

// Riveted panels with a polished highlight, clipped to the body.
function Plating({ b }: { b: BodySpec }) {
  const seams = [0.32, 0.56, 0.78];
  return (
    <g>
      {seams.map((x) => (
        <g key={x}>
          <line x1={bx(x)} y1={CY - b.h - 2} x2={bx(x)} y2={CY + b.h + 2} stroke="#2a3440" strokeOpacity={0.55} strokeWidth={0.7} />
          {[-0.6, -0.2, 0.2, 0.6].map((t) => (
            <circle key={t} cx={bx(x) + 1.6} cy={CY + t * halfHeightAt(b, x)} r={0.6} fill="#eef3f8" stroke="#2a3440" strokeWidth={0.3} />
          ))}
        </g>
      ))}
      <line x1={TAIL_X} y1={CY + b.h * 0.15} x2={bx(0.78)} y2={CY + b.h * 0.15} stroke="#2a3440" strokeOpacity={0.4} strokeWidth={0.6} />
      <path d={`M${bx(0.08)} ${CY - b.h * 0.5} Q${bx(0.5)} ${CY - b.h * 0.85}, ${bx(0.9)} ${CY - b.h * 0.45}`} stroke="#fff" strokeOpacity={0.7} strokeWidth={2} fill="none" strokeLinecap="round" />
    </g>
  );
}

function Antenna({ b }: { b: BodySpec }) {
  const x = bx(0.7);
  const y = topAt(b, 0.7) + 2;
  return (
    <g>
      <path d={`M${x} ${y} q-1 -7 2 -12`} stroke="#5a6672" strokeWidth={1.1} fill="none" strokeLinecap="round" />
      <circle className="fish-sprite__blink" cx={x + 2} cy={y - 13} r={2} fill="#ff3a3a" />
    </g>
  );
}

// A glowing red camera eye.
function RoboEye({ x, y, r, color }: { x: number; y: number; r: number; color: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r + 1.2} fill="#2a3440" />
      <circle cx={x} cy={y} r={r * 1.6} fill={color} opacity={0.25} />
      <circle cx={x} cy={y} r={r * 0.8} fill={color} />
      <circle cx={x + r * 0.25} cy={y - r * 0.25} r={r * 0.22} fill="#fff" opacity={0.9} />
    </g>
  );
}

// The black hood leaves a pale slit around the eye.
function NinjaMask({ b, eyeY }: { b: BodySpec; eyeY: number }) {
  const h = Math.max(b.h * 0.42, 4.5);
  return (
    <path
      d={`M${bx(0.76)} ${eyeY - h / 2} L${SNOUT_X + 2} ${eyeY - h / 2 - 0.8} L${SNOUT_X + 2} ${eyeY + h / 2 - 0.4} L${bx(0.76)} ${eyeY + h / 2} Z`}
      fill="#e9c9a4"
    />
  );
}

// A red headband knotted behind the head, ties streaming back.
function NinjaBand({ b }: { b: BodySpec }) {
  const x = bx(0.74);
  const top = topAt(b, 0.74);
  return (
    <g>
      <path d={`M${x - 1.5} ${top + 0.5} L${x + 1.8} ${top + 0.2} L${x + 2.4} ${CY - b.h * 0.25} L${x - 1} ${CY - b.h * 0.2} Z`} fill="#d81e2a" />
      <g className="fish-sprite__ties" fill="#d81e2a">
        <path d={`M${x} ${top + 1} q-8 -6 -16 -3 q6 1 16 5 Z`} />
        <path d={`M${x} ${top + 1.5} q-7 -1 -13 4 q6 -2 13 -2 Z`} />
      </g>
    </g>
  );
}

// A gold diamond with 福 ("good fortune"), as hung at Lunar New Year.
function FuCharm({ b }: { b: BodySpec }) {
  const cx = bx(0.47);
  const cy = CY + b.h * 0.08;
  const r = Math.min(b.h * 0.55, 9);
  return (
    <g>
      <path d={`M${cx} ${cy - r} L${cx + r} ${cy} L${cx} ${cy + r} L${cx - r} ${cy} Z`} fill="#ffcf3a" stroke="#fff3b0" strokeWidth={0.7} />
      <text
        x={cx}
        y={cy + r * 0.05}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={r * 1.05}
        fontWeight={700}
        fontFamily="'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans CJK SC', sans-serif"
        fill="#b80e1a"
      >
        福
      </text>
    </g>
  );
}

// A cream starburst of uneven tapered rays.
function Spark({ b }: { b: BodySpec }) {
  const cx = bx(0.48);
  const cy = CY + b.h * 0.05;
  const rays = Array.from({ length: 11 }, (_, i) => {
    const a = (i / 11) * Math.PI * 2;
    const len = b.h * (0.5 + ((i * 5) % 4) * 0.07);
    const w = 1.5;
    const [ux, uy] = [Math.cos(a), Math.sin(a)];
    return `M${cx - uy * w} ${cy + ux * w} L${cx + ux * len} ${cy + uy * len} L${cx + uy * w} ${cy - ux * w} Z`;
  });
  return (
    <g className="fish-sprite__spark" style={{ transformOrigin: `${cx}px ${cy}px` }}>
      <path d={rays.join(' ')} fill="#f4ede4" strokeLinejoin="round" stroke="#f4ede4" strokeWidth={0.6} />
      <circle cx={cx} cy={cy} r={2} fill="#f4ede4" />
    </g>
  );
}

// The US flag wrapped round the body: red and white stripes, with a blue
// canton of stars over the head. Clipped to the body outline.
function Flag({ b }: { b: BodySpec }) {
  const top = CY - b.h - 1;
  const bandH = (2 * b.h + 2) / 7;
  const canton = { x: bx(0.5), y: top, w: SNOUT_X + 2 - bx(0.5), h: bandH * 3.5 };
  const star = (cx: number, cy: number, r: number) =>
    Array.from({ length: 10 }, (_, i) => {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? r * 0.42 : r;
      return `${i ? 'L' : 'M'}${(cx + Math.cos(a) * rr).toFixed(2)} ${(cy + Math.sin(a) * rr).toFixed(2)}`;
    }).join(' ') + 'Z';
  const stars: string[] = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      // Offset alternate rows, like the real flag's star grid.
      const cx = canton.x + canton.w * ((col + 0.5 + (row % 2) * 0.5) / 4.5);
      const cy = canton.y + canton.h * ((row + 0.7) / 3.4);
      stars.push(star(cx, cy, 1.5));
    }
  }
  return (
    <g>
      {Array.from({ length: 7 }, (_, i) => (
        <rect key={i} x={TAIL_X - 4} y={top + i * bandH} width={LEN + 10} height={bandH} fill={i % 2 ? '#ffffff' : '#c8102e'} />
      ))}
      <rect x={canton.x} y={canton.y} width={canton.w} height={canton.h} fill="#1f3a93" />
      <path d={stars.join(' ')} fill="#ffffff" />
    </g>
  );
}

// Long, curling gold whiskers like a Chinese dragon's.
function DragonWhiskers({ b }: { b: BodySpec }) {
  return (
    <g className="fish-sprite__ties" stroke="#ffd04a" strokeWidth={1.1} fill="none" strokeLinecap="round">
      <path d={`M${SNOUT_X - 3} ${CY + 3} C${SNOUT_X + 1} ${CY + 7}, ${SNOUT_X - 6} ${CY + 11}, ${bx(0.8)} ${CY + 12} S${bx(0.68)} ${CY + 9}, ${bx(0.62)} ${CY + 15}`} />
      <path d={`M${SNOUT_X - 4} ${CY + 3.5} C${SNOUT_X - 4} ${CY + 9}, ${SNOUT_X - 10} ${CY + 14}, ${bx(0.84)} ${CY + 17} S${bx(0.74)} ${CY + 16}, ${bx(0.7)} ${CY + 22}`} />
    </g>
  );
}

// Four-point glints that twinkle in turn.
function Sparkles({ b }: { b: BodySpec }) {
  const spots: [number, number, number][] = [
    [0.62, -0.55, 3.2],
    [0.3, 0.1, 2.4],
    [0.82, 0.45, 2],
  ];
  return (
    <g fill="#fffbe6">
      {spots.map(([x, y, r], i) => {
        const cx = bx(x);
        const cy = CY + y * b.h;
        return (
          <path
            key={i}
            className="fish-sprite__sparkle"
            style={{ animationDelay: `${i * 0.6}s` }}
            d={`M${cx} ${cy - r} Q${cx} ${cy}, ${cx + r} ${cy} Q${cx} ${cy}, ${cx} ${cy + r} Q${cx} ${cy}, ${cx - r} ${cy} Q${cx} ${cy}, ${cx} ${cy - r} Z`}
          />
        );
      })}
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

// ---------- Swimming person ----------

const SHOULDER: Pt = [82, 37];
const HIP: Pt = [48, 41];

// A tiny person doing front crawl: arms windmill round the shoulder and legs
// flutter-kick from the hip. look.back is skin, belly trunks, fin the cap.
function Dude({ look }: { look: FishLook }) {
  const skin = look.back;
  const shade = 'rgba(0, 0, 0, 0.18)';
  const arm = (delay: number, far: boolean) => (
    <g
      className="fish-sprite__arm"
      style={{ transformOrigin: `${SHOULDER[0]}px ${SHOULDER[1]}px`, animationDelay: `${delay}s` }}
    >
      <path d={`M${SHOULDER[0]} ${SHOULDER[1]} L${SHOULDER[0] + 26} ${SHOULDER[1] + 1}`} stroke={skin} strokeWidth={4.6} strokeLinecap="round" />
      {far ? <path d={`M${SHOULDER[0]} ${SHOULDER[1]} L${SHOULDER[0] + 26} ${SHOULDER[1] + 1}`} stroke={shade} strokeWidth={4.6} strokeLinecap="round" /> : null}
    </g>
  );
  const leg = (delay: number, far: boolean, dy: number) => (
    <g className="fish-sprite__leg" style={{ transformOrigin: `${HIP[0]}px ${HIP[1]}px`, animationDelay: `${delay}s` }}>
      <path d={`M${HIP[0]} ${HIP[1] + dy} L${HIP[0] - 18} ${HIP[1] + dy + 1} L${HIP[0] - 34} ${HIP[1] + dy}`} stroke={skin} strokeWidth={5.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {far ? <path d={`M${HIP[0]} ${HIP[1] + dy} L${HIP[0] - 18} ${HIP[1] + dy + 1} L${HIP[0] - 34} ${HIP[1] + dy}`} stroke={shade} strokeWidth={5.4} strokeLinecap="round" fill="none" /> : null}
      {/* Pointed foot. */}
      <path d={`M${HIP[0] - 33} ${HIP[1] + dy - 2.4} l-6 1.2 l1 2.6 l5 0.6 Z`} fill={skin} />
    </g>
  );
  return (
    <g>
      {/* Far-side limbs behind the body. */}
      {arm(-0.8, true)}
      {leg(-0.25, true, -1.5)}
      {/* Torso, with trunks over the hips. */}
      <path d={`M${HIP[0] - 2} ${HIP[1] - 5} Q${HIP[0] + 18} ${HIP[1] - 10}, ${SHOULDER[0] + 6} ${SHOULDER[1] - 5} Q${SHOULDER[0] + 9} ${SHOULDER[1] + 2}, ${SHOULDER[0] + 4} ${SHOULDER[1] + 6} Q${HIP[0] + 18} ${HIP[1] + 6}, ${HIP[0] - 2} ${HIP[1] + 4} Z`} fill={skin} />
      <path d={`M${HIP[0] - 4} ${HIP[1] - 5} Q${HIP[0] + 5} ${HIP[1] - 7}, ${HIP[0] + 9} ${HIP[1] - 6.5} L${HIP[0] + 9} ${HIP[1] + 5} Q${HIP[0] + 3} ${HIP[1] + 5.5}, ${HIP[0] - 4} ${HIP[1] + 4.5} Z`} fill={look.belly} />
      {leg(0, false, 1.5)}
      {/* The near arm reaches past the head, so it's drawn behind it. */}
      {arm(0, false)}
      {/* Head with swim cap and goggles, face turned slightly down. */}
      <circle cx={95} cy={37} r={7.5} fill={skin} />
      <path d="M87.6 36.5 A7.5 7.5 0 0 1 102.3 35.2 Q95 33.6 87.6 36.5 Z" fill={look.fin} />
      <path d="M87.6 36.5 A7.5 7.5 0 0 1 102.3 35.2 L101.6 37 Q95 35.6 88 38.4 Z" fill={look.fin} />
      <line x1={88} y1={38.6} x2={99} y2={37.4} stroke="#1a1a1a" strokeWidth={1} />
      <ellipse cx={100.2} cy={37.6} rx={2} ry={1.6} fill="#2adcff" stroke="#1a1a1a" strokeWidth={0.7} />
      <path d="M99.6 42 q1.6 0.8 2.6 -0.4" stroke="#7a3a2a" strokeWidth={0.7} fill="none" strokeLinecap="round" />
    </g>
  );
}
