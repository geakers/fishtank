import { useEffect } from 'react';
import type { Toast as ToastMessage } from '../../useFishtank';

export interface ToastProps {
  notice: ToastMessage | null;
  onDismiss: () => void;
  durationMs?: number;
}

// A small message at the bottom of the screen that hides itself.
export function Toast({ notice, onDismiss, durationMs = 3500 }: ToastProps) {
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(timer);
  }, [notice, onDismiss, durationMs]);

  if (!notice) return null;
  return (
    <div className={`toast toast--${notice.tone}`} role="status" onClick={onDismiss}>
      <span className="toast__dot" aria-hidden="true" />
      {notice.text}
    </div>
  );
}
