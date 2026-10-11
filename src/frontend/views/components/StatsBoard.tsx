import type { Stats } from '../../data';
import { formatDuration, formatPoints } from '../format';

export interface StatsBoardProps {
  stats: Stats;
}

// The study stats as a grid of tiles, shown in the profile menu.
export function StatsBoard({ stats }: StatsBoardProps) {
  const tiles = [
    { label: 'Focus time', value: formatDuration(stats.totalFocusMs) },
    { label: 'Sessions', value: String(stats.sessions) },
    { label: 'Day streak', value: String(stats.streakDays) },
    { label: 'Longest session', value: formatDuration(stats.longestSessionMs) },
    { label: 'Points earned', value: formatPoints(stats.pointsEarned) },
    { label: 'Notes shared', value: String(stats.notes) },
  ];

  return (
    <div className="stats-board">
      {tiles.map((tile) => (
        <div key={tile.label} className="stat-tile">
          <span className="stat-tile__value">{tile.value}</span>
          <span className="stat-tile__label">{tile.label}</span>
        </div>
      ))}
    </div>
  );
}
