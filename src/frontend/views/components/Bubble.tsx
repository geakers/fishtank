import { useMemo, type CSSProperties } from 'react';
import { hash } from '../format';

export interface BubbleProps {
  // Diameter in px.
  size: number;
  // Horizontal position as a percentage of the container.
  leftPercent: number;
  // Seconds to rise from the bottom to the top.
  riseSeconds?: number;
  delaySeconds?: number;
}

// A shiny bubble that rises and wobbles. Place inside a positioned container.
export function Bubble({ size, leftPercent, riseSeconds = 12, delaySeconds = 0 }: BubbleProps) {
  const style = {
    width: size,
    height: size,
    left: `${leftPercent}%`,
    '--rise-duration': `${riseSeconds}s`,
    '--rise-delay': `${delaySeconds}s`,
    '--wobble-duration': `${2 + (size % 3)}s`,
  } as CSSProperties;
  return <span className="aero-bubble" style={style} aria-hidden="true" />;
}

export interface BubbleFieldProps {
  count: number;
  // Different seeds give different (but stable) bubble layouts.
  seed?: string;
  maxSize?: number;
}

// A full-area layer of rising bubbles, for backgrounds.
export function BubbleField({ count, seed = 'bubbles', maxSize = 34 }: BubbleFieldProps) {
  const bubbles = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const h = hash(`${seed}-${i}`);
        const rise = 9 + (h % 11);
        return {
          size: 6 + (h % maxSize),
          leftPercent: (h >>> 8) % 100,
          riseSeconds: rise,
          // Negative delay = already partway up when the screen appears.
          delaySeconds: -((h >>> 4) % (rise * 10)) / 10,
        };
      }),
    [count, seed, maxSize],
  );
  return (
    <div className="bubble-field" aria-hidden="true">
      {bubbles.map((b, i) => (
        <Bubble key={i} {...b} />
      ))}
    </div>
  );
}
