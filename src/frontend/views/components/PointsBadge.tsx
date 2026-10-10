import { formatPoints } from '../format';

export interface PointsBadgeProps {
  balance: number;
}

// Glossy pill showing the point balance.
export function PointsBadge({ balance }: PointsBadgeProps) {
  return (
    <div className="points-badge" title="Your points">
      <span className="points-badge__coin" aria-hidden="true" />
      <span className="points-badge__value">{formatPoints(balance)}</span>
      <span className="points-badge__unit">pts</span>
    </div>
  );
}
