import type { ButtonHTMLAttributes, ReactNode } from 'react';

export interface AeroButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  children: ReactNode;
  // 'hero' is the big lock-in button; 'glass' is a subtle translucent button.
  // 'grass' is the green action, used so it doesn't read as the cyan primary.
  variant?: 'primary' | 'secondary' | 'glass' | 'hero' | 'grass';
  type?: 'button' | 'submit';
}

// Glossy gel button.
export function AeroButton({ children, variant = 'primary', type = 'button', className = '', ...rest }: AeroButtonProps) {
  return (
    <button type={type} className={`aero-button aero-button--${variant} ${className}`} {...rest}>
      <span className="aero-button__label">{children}</span>
    </button>
  );
}
