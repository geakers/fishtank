import { useMemo, type CSSProperties } from 'react';
import type { Fish } from '../../data';
import { hash } from '../format';
import { Bubble } from './Bubble';
import { FishSprite } from './FishSprite';
import { Anemone, BackScape, FrontScape, Seagrass } from './Reefscape';

export interface AquariumProps {
  fish: Fish[];
  // Width in px of a size-1.0 fish. The tank itself sizes to its container.
  fishSize?: number;
  className?: string;
}

// A Frutiger Aero LED aquarium lamp: silver lid and base, rounded glass and
// glowing backlit water around a realistic reef, with the given fish swimming
// back and forth inside the glass.
export function Aquarium({ fish, fishSize = 120, className = '' }: AquariumProps) {
  const swimmers = useMemo(() => layoutSwimmers(fish, fishSize), [fish, fishSize]);

  return (
    <div className={`aquarium ${className}`}>
      <div className="aquarium__lid">
        <span className="aquarium__lamp" />
      </div>
      <div className="aquarium__glass">
        <div className="aquarium__water">
          <div className="aquarium__backlight" aria-hidden="true" />
          <div className="aquarium__rays" aria-hidden="true" />
          <Seagrass />
          <BackScape />
          <div className="aquarium__caustics" aria-hidden="true" />
          <Bubbler />
          {swimmers.map((s) => (
            <div key={s.key} className="swimmer" style={s.style}>
              <div className="swimmer__bob">
                <FishSprite fish={s.fish} size={s.size} />
              </div>
            </div>
          ))}
          <FrontScape />
          <Anemone />
          <div className="aquarium__particles" aria-hidden="true" />
        </div>
        <div className="aquarium__surface" aria-hidden="true" />
        <div className="aquarium__shine" aria-hidden="true" />
      </div>
      <div className="aquarium__base">
        <span className="aquarium__switch" />
      </div>
    </div>
  );
}

interface Swimmer {
  key: string;
  fish: Fish;
  size: number;
  style: CSSProperties;
}

// Gives each fish a lane and speed from fish.speed. Uses a hash of the id so
// each fish keeps the same lane between renders.
function layoutSwimmers(fish: Fish[], fishSize: number): Swimmer[] {
  return fish.map((f) => {
    const h = hash(f.id);
    const size = Math.round(fishSize * f.size);
    const duration = 30 / f.speed;
    return {
      key: f.id,
      fish: f,
      size,
      style: {
        top: `${10 + (h % 52)}%`,
        '--fish-w': `${size}px`,
        '--swim-duration': `${duration}s`,
        // Negative delay starts each fish partway through its loop.
        '--swim-delay': `${-((h >>> 6) % Math.round(duration * 10)) / 10}s`,
        '--bob-duration': `${2.4 + ((h >>> 3) % 20) / 10}s`,
      } as CSSProperties,
    };
  });
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
