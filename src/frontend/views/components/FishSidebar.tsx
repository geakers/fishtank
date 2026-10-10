import type { Fish } from '../../data';
import { capitalize } from '../format';
import { AeroButton } from './AeroButton';
import { FishSprite } from './FishSprite';
import { GlassPanel } from './GlassPanel';

export interface FishSidebarProps {
  ownedFish: Fish[];
  onOpenStore: () => void;
}

// The user's fish collection, down the left side of the home screen.
export function FishSidebar({ ownedFish, onOpenStore }: FishSidebarProps) {
  return (
    <GlassPanel className="fish-sidebar">
      <h2 className="panel-title">
        My Fish <span className="panel-title__count">{ownedFish.length}</span>
      </h2>
      {ownedFish.length === 0 ? (
        <div className="fish-sidebar__empty">
          <p>Your tank is empty.</p>
          <p className="muted">Earn points by sharing notes, then adopt your first fish.</p>
          <AeroButton variant="secondary" onClick={onOpenStore}>
            Visit the store
          </AeroButton>
        </div>
      ) : (
        <ul className="fish-sidebar__list">
          {ownedFish.map((fish) => (
            <li key={fish.id} className="fish-sidebar__item">
              <div className="fish-sidebar__sprite">
                <FishSprite fish={fish} size={52} />
              </div>
              <div className="fish-sidebar__info">
                <span className="fish-sidebar__name">
                  {fish.name}
                </span>
                <span className={`rarity-tag rarity-tag--${fish.rarity}`}>{capitalize(fish.rarity)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </GlassPanel>
  );
}
