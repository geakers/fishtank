import { useId } from 'react';
import type { Fish } from '../../data';

export interface FishSpriteProps {
  fish: Fish;
  // Width in px. Height follows the sprite's 3:2 shape.
  size?: number;
  className?: string;
}

type Shape = 'fish' | 'tall' | 'puffer' | 'jelly';

interface Look {
  shape: Shape;
  top: string;
  bottom: string;
  fin: string;
  stripes?: string;
  spots?: string;
}

// Visual style per Fish.spriteKey. Add an entry here when adding a fish to the catalog.
const LOOKS: Record<string, Look> = {
  guppy: { shape: 'fish', top: '#ffe08a', bottom: '#ff8a3d', fin: '#ff5f8a' },
  tetra: { shape: 'fish', top: '#7df9ff', bottom: '#2a6dff', fin: '#ff4d6d', stripes: '#ff4d6d' },
  clownfish: { shape: 'fish', top: '#ffc06a', bottom: '#ff6a00', fin: '#ff7a00', stripes: '#ffffff' },
  'blue-tang': { shape: 'fish', top: '#6fb8ff', bottom: '#1b3fbf', fin: '#ffd23f' },
  angelfish: { shape: 'tall', top: '#ffffff', bottom: '#b9c6ff', fin: '#9fb0ff', stripes: '#3b3b6d' },
  pufferfish: { shape: 'puffer', top: '#fff6c2', bottom: '#e0b83a', fin: '#d49a1c', spots: '#8a6d1f' },
  koi: { shape: 'fish', top: '#ffffff', bottom: '#ffe1d2', fin: '#ffb199', spots: '#ff5a36' },
  jellyfish: { shape: 'jelly', top: '#f3e3ff', bottom: '#9d7bff', fin: '#c9b2ff' },
};

const FALLBACK: Look = { shape: 'fish', top: '#bdf3ff', bottom: '#2a9fd6', fin: '#7fe3d8' };

// A glossy vector fish facing right. Drawn in code until there are sprite assets.
export function FishSprite({ fish, size = 96, className = '' }: FishSpriteProps) {
  const look = LOOKS[fish.spriteKey] ?? FALLBACK;
  // useId output contains characters that aren't safe inside url(#...).
  const id = `fish${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const bodyFill = `url(#${id}-body)`;

  return (
    <svg
      className={`fish-sprite ${className}`}
      width={size}
      height={(size * 2) / 3}
      viewBox="0 0 120 80"
      role="img"
      aria-label={fish.name}
    >
      <defs>
        <linearGradient id={`${id}-body`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={look.top} />
          <stop offset="100%" stopColor={look.bottom} />
        </linearGradient>
      </defs>
      {look.shape === 'jelly' ? <Jelly look={look} bodyFill={bodyFill} /> : null}
      {look.shape === 'puffer' ? <Puffer look={look} bodyFill={bodyFill} /> : null}
      {look.shape === 'fish' || look.shape === 'tall' ? (
        <RegularFish look={look} bodyFill={bodyFill} tall={look.shape === 'tall'} />
      ) : null}
    </svg>
  );
}

interface PartProps {
  look: Look;
  bodyFill: string;
}

function Eye({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={6} fill="#fff" />
      <circle cx={x + 1} cy={y} r={3.4} fill="#0d2a3f" />
      <circle cx={x + 2.2} cy={y - 1.4} r={1.2} fill="#fff" />
    </g>
  );
}

function RegularFish({ look, bodyFill, tall }: PartProps & { tall: boolean }) {
  const ry = tall ? 28 : 22;
  return (
    <g>
      <path d="M30 40 L4 16 Q12 40 4 64 Z" fill={look.fin} opacity={0.9} />
      <path d={tall ? 'M46 16 Q64 -6 84 16 Z' : 'M48 22 Q62 4 82 20 Z'} fill={look.fin} opacity={0.85} />
      {tall ? <path d="M50 64 Q64 86 82 62 Z" fill={look.fin} opacity={0.85} /> : null}
      <ellipse cx={64} cy={40} rx={40} ry={ry} fill={bodyFill} />
      {look.stripes ? (
        <g stroke={look.stripes} strokeWidth={6} fill="none" strokeLinecap="round" opacity={0.95}>
          <path d={`M54 ${40 - ry + 3} Q48 40 54 ${40 + ry - 3}`} />
          <path d={`M80 ${40 - ry + 5} Q75 40 80 ${40 + ry - 5}`} />
        </g>
      ) : null}
      {look.spots ? (
        <g fill={look.spots} opacity={0.9}>
          <circle cx={52} cy={30} r={7} />
          <circle cx={72} cy={46} r={8} />
          <circle cx={88} cy={28} r={4} />
        </g>
      ) : null}
      <ellipse cx={62} cy={48} rx={10} ry={5} fill={look.fin} opacity={0.75} transform="rotate(-15 62 48)" />
      <ellipse cx={66} cy={28} rx={26} ry={7} fill="#fff" opacity={0.45} />
      <Eye x={88} y={34} />
      <path d="M101 44 Q98 46 101 48" stroke="#0d2a3f" strokeWidth={1.5} fill="none" strokeLinecap="round" />
    </g>
  );
}

function Puffer({ look, bodyFill }: PartProps) {
  const spikes = Array.from({ length: 14 }, (_, i) => (i / 14) * Math.PI * 2);
  return (
    <g>
      <path d="M32 40 L12 26 Q16 40 12 54 Z" fill={look.fin} />
      {spikes.map((angle, i) => {
        const x = 64 + Math.cos(angle) * 32;
        const y = 40 + Math.sin(angle) * 32;
        const tipX = 64 + Math.cos(angle) * 40;
        const tipY = 40 + Math.sin(angle) * 40;
        return <line key={i} x1={x} y1={y} x2={tipX} y2={tipY} stroke={look.fin} strokeWidth={3} strokeLinecap="round" />;
      })}
      <circle cx={64} cy={40} r={32} fill={bodyFill} />
      {look.spots ? (
        <g fill={look.spots} opacity={0.5}>
          <circle cx={54} cy={26} r={3} />
          <circle cx={66} cy={22} r={2.5} />
          <circle cx={48} cy={38} r={2.5} />
          <circle cx={60} cy={34} r={2} />
        </g>
      ) : null}
      <ellipse cx={60} cy={22} rx={18} ry={6} fill="#fff" opacity={0.5} />
      <Eye x={82} y={34} />
      <circle cx={95} cy={46} r={2.5} fill="#0d2a3f" opacity={0.7} />
    </g>
  );
}

function Jelly({ look, bodyFill }: PartProps) {
  return (
    <g>
      <g stroke={look.fin} strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.85}>
        <path d="M42 46 Q38 58 44 68 Q50 76 44 80" />
        <path d="M54 48 Q50 60 56 70 Q60 78 56 80" />
        <path d="M66 48 Q70 60 64 70 Q60 78 66 80" />
        <path d="M78 46 Q82 58 76 68 Q70 76 78 80" />
      </g>
      <path d="M28 46 Q28 8 60 8 Q92 8 92 46 Q76 52 60 47 Q44 52 28 46 Z" fill={bodyFill} opacity={0.92} />
      <ellipse cx={52} cy={20} rx={16} ry={6} fill="#fff" opacity={0.6} />
      <circle cx={70} cy={30} r={4} fill="#fff" opacity={0.5} />
    </g>
  );
}
