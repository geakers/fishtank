import { FISH, type Stats } from '../../data';
import { formatDuration, formatPoints } from '../format';
import { GlassPanel } from './GlassPanel';

export interface StatsBoardProps {
  stats: Stats;
  fishOwned: number;
}

// The study stats in the middle of the home screen.
export function StatsBoard({ stats, fishOwned }: StatsBoardProps) {
  const tiles = [
    { label: 'Focus time', value: formatDuration(stats.totalFocusMs) },
    { label: 'Sessions', value: String(stats.sessions) },
    { label: 'Day streak', value: String(stats.streakDays) },
    { label: 'Longest session', value: formatDuration(stats.longestSessionMs) },
    { label: 'Points earned', value: formatPoints(stats.pointsEarned) },
    { label: 'Notes shared', value: String(stats.notes) },
  ];
  const collectionPercent = Math.round((fishOwned / FISH.length) * 100);

  return (
    <GlassPanel className="stats-board" variant="raised">
      <h2 className="panel-title">Your study stats</h2>
      <div className="stats-board__grid">
        {tiles.map((tile) => (
          <div key={tile.label} className="stat-tile">
            <span className="stat-tile__value">{tile.value}</span>
            <span className="stat-tile__label">{tile.label}</span>
          </div>
        ))}
      </div>
      <div className="collection-meter">
        <div className="collection-meter__label">
          <span>Fish collected</span>
          <span>
            {fishOwned} / {FISH.length}
          </span>
        </div>
        <div className="collection-meter__track">
          <div className="collection-meter__fill" style={{ width: `${collectionPercent}%` }} />
        </div>
      </div>
    </GlassPanel>
  );
}
