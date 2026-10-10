import type { HTMLAttributes, ReactNode } from 'react';

export interface GlassPanelProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  // 'raised' = stronger blur and shadow, for panels on top of other panels.
  variant?: 'default' | 'raised';
}

// Frosted glass panel with a glossy top highlight.
export function GlassPanel({ children, variant = 'default', className = '', ...rest }: GlassPanelProps) {
  return (
    <div className={`aero-glass aero-glass--${variant} ${className}`} {...rest}>
      {children}
    </div>
  );
}
