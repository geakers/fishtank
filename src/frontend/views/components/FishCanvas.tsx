import { useEffect, useRef, useState, type PointerEvent } from 'react';
import type { Fish } from '../../data';
import { AeroButton } from './AeroButton';
import { CustomArtContext, FishSprite } from './FishSprite';
import { GlassPanel } from './GlassPanel';

export interface FishCanvasProps {
  // The blank fish being drawn on, shown under the canvas as a guide.
  fish: Fish;
  // The current drawing, if any, to carry on from.
  art: string | null;
  onSave: (art: string) => void;
  onCancel: () => void;
}

// The canvas matches the sprite's 120×80 viewBox, scaled up for detail.
const WIDTH = 600;
const HEIGHT = 400;

const COLORS = ['#1a1a1a', '#ffffff', '#ff3b3b', '#ff9a2a', '#ffe23a', '#3ad65a', '#1fb5a8', '#2a9cff', '#5a4bff', '#b04bff', '#ff6ec7', '#8a5a2a'];
const BRUSHES = [
  { size: 6, label: 'Small brush' },
  { size: 14, label: 'Medium brush' },
  { size: 30, label: 'Large brush' },
];

// Modal for drawing on a blank fish. Only what's drawn on the fish shows in
// the tank; the rest is cut away.
export function FishCanvas({ fish, art, onSave, onCancel }: FishCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [color, setColor] = useState(COLORS[2]);
  const [brush, setBrush] = useState(BRUSHES[1].size);
  const [erasing, setErasing] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  // Carry on from the saved drawing.
  useEffect(() => {
    if (!art) return;
    const image = new Image();
    image.onload = () => canvasRef.current?.getContext('2d')?.drawImage(image, 0, 0, WIDTH, HEIGHT);
    image.src = art;
  }, [art]);

  // Pointer position in canvas pixels.
  const at = (event: PointerEvent<HTMLCanvasElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    return { x: ((event.clientX - box.left) / box.width) * WIDTH, y: ((event.clientY - box.top) / box.height) * HEIGHT };
  };

  const strokeTo = (to: { x: number; y: number }) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const from = last.current ?? to;
    ctx.globalCompositeOperation = erasing ? 'destination-out' : 'source-over';
    ctx.strokeStyle = color;
    ctx.lineWidth = brush;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    // A zero-length line still paints a round dot.
    ctx.lineTo(to.x + (from === to ? 0.01 : 0), to.y);
    ctx.stroke();
    last.current = to;
  };

  const start = (event: PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    last.current = null;
    strokeTo(at(event));
  };
  const move = (event: PointerEvent<HTMLCanvasElement>) => {
    if (last.current) strokeTo(at(event));
  };
  const end = () => {
    last.current = null;
  };

  const clear = () => canvasRef.current?.getContext('2d')?.clearRect(0, 0, WIDTH, HEIGHT);
  const save = () => {
    const canvas = canvasRef.current;
    if (canvas) onSave(canvas.toDataURL('image/png'));
  };

  return (
    <div className="modal-backdrop" onPointerDown={(event) => event.target === event.currentTarget && onCancel()}>
      <GlassPanel variant="raised" className="modal fish-canvas" role="dialog" aria-labelledby="fish-canvas-title">
        <div className="modal__header">
          <h2 id="fish-canvas-title" className="panel-title">
            Draw your fish
          </h2>
        </div>
        <p className="muted">Only what you draw on the fish shows in your tank.</p>

        <div className="fish-canvas__stage">
          {/* The blank fish as a guide, without the old drawing on it. */}
          <CustomArtContext.Provider value={null}>
            <FishSprite fish={fish} size={WIDTH} className="fish-canvas__guide" />
          </CustomArtContext.Provider>
          <canvas
            ref={canvasRef}
            className="fish-canvas__canvas"
            width={WIDTH}
            height={HEIGHT}
            onPointerDown={start}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
          />
        </div>

        <div className="fish-canvas__tools">
          <div className="fish-canvas__swatches" role="radiogroup" aria-label="Color">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={!erasing && color === c}
                aria-label={c}
                className={`fish-canvas__swatch ${!erasing && color === c ? 'is-active' : ''}`}
                style={{ background: c }}
                onClick={() => {
                  setColor(c);
                  setErasing(false);
                }}
              />
            ))}
          </div>
          <div className="fish-canvas__brushes" role="radiogroup" aria-label="Brush size">
            {BRUSHES.map((b) => (
              <button
                key={b.size}
                type="button"
                role="radio"
                aria-checked={brush === b.size}
                aria-label={b.label}
                className={`fish-canvas__brush ${brush === b.size ? 'is-active' : ''}`}
                onClick={() => setBrush(b.size)}
              >
                <span style={{ width: b.size / 1.6 + 2, height: b.size / 1.6 + 2 }} />
              </button>
            ))}
          </div>
          <AeroButton variant="glass" aria-pressed={erasing} className={erasing ? 'is-active' : ''} onClick={() => setErasing(!erasing)}>
            Eraser
          </AeroButton>
          <AeroButton variant="glass" onClick={clear}>
            Clear
          </AeroButton>
        </div>

        <div className="form-actions">
          <AeroButton variant="glass" onClick={onCancel}>
            Cancel
          </AeroButton>
          <AeroButton onClick={save}>Save</AeroButton>
        </div>
      </GlassPanel>
    </div>
  );
}
