import { useState } from 'react';
import { FISH, type Fish } from '../../data';
import type { App } from '../../useFishtank';
import { AeroButton } from '../components/AeroButton';
import { FishSprite } from '../components/FishSprite';
import { PointsBadge } from '../components/PointsBadge';
import { Toast } from '../components/Toast';
import { formatPoints } from '../format';

export interface StoreScreenProps {
  app: App;
}

type Filter = 'all' | 'available' | 'owned' | 'tank';
type Sort = 'price-asc' | 'price-desc' | 'name';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All fish' },
  { id: 'available', label: 'Not adopted' },
  { id: 'owned', label: 'Adopted' },
  { id: 'tank', label: 'In my tank' },
];

const SORTERS: Record<Sort, (a: Fish, b: Fish) => number> = {
  'price-asc': (a, b) => a.price - b.price || a.name.localeCompare(b.name),
  'price-desc': (a, b) => b.price - a.price || a.name.localeCompare(b.name),
  name: (a, b) => a.name.localeCompare(b.name),
};

// The Fish Shop. Lists every fish in the catalog, so new fish show up here
// as soon as they're added to FISH.
export function StoreScreen({ app }: StoreScreenProps) {
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('price-asc');

  const isOwned = (fish: Fish) => app.owned.includes(fish);
  const isInTank = (fish: Fish) => app.tank.includes(fish);
  const matches: Record<Filter, (fish: Fish) => boolean> = {
    all: () => true,
    available: (fish) => !isOwned(fish),
    owned: isOwned,
    tank: isInTank,
  };
  const shown = FISH.filter(matches[filter]).sort(SORTERS[sort]);
  const emptyText: Record<Filter, string> = {
    all: '',
    available: 'You have every fish!',
    owned: 'No fish adopted yet.',
    tank: 'Your tank is empty.',
  };

  return (
    <div className="screen store">
      <header className="topbar">
        <div className="topbar__left">
          <AeroButton variant="glass" onClick={() => app.setScreen('home')}>
            Back
          </AeroButton>
          <div>
            <h1 className="screen-title">Fish Shop</h1>
            <p className="muted">
              {app.owned.length} of {FISH.length} fish adopted · {app.tank.length} in your tank
            </p>
          </div>
        </div>
        <PointsBadge balance={app.points} />
      </header>

      <div className="store__toolbar">
        <div className="segmented" role="tablist" aria-label="Filter fish">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              className={`segmented__option ${filter === f.id ? 'is-active' : ''}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <label className="store__sort">
          <span className="muted">Sort by</span>
          <select className="aero-select" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
            <option value="name">Name</option>
          </select>
        </label>
      </div>

      <div className="store__grid">
        {shown.map((fish) => (
          <StoreCard
            key={fish.id}
            fish={fish}
            owned={isOwned(fish)}
            inTank={isInTank(fish)}
            balance={app.points}
            onBuy={() => app.buy(fish)}
            onSetInTank={(inTank) => app.setInTank(fish, inTank)}
          />
        ))}
        {shown.length === 0 ? (
          <p className="store__empty muted">{emptyText[filter]}</p>
        ) : null}
      </div>

      <Toast notice={app.toast} onDismiss={app.dismissToast} />
    </div>
  );
}

interface StoreCardProps {
  fish: Fish;
  owned: boolean;
  inTank: boolean;
  balance: number;
  onBuy: () => void;
  onSetInTank: (inTank: boolean) => void;
}

function StoreCard({ fish, owned, inTank, balance, onBuy, onSetInTank }: StoreCardProps) {
  return (
    <article className={`store-card ${owned ? 'is-owned' : ''} ${owned && !inTank ? 'is-stored' : ''}`}>
      <div className="store-card__tank">
        <FishSprite fish={fish} size={110} className="store-card__sprite" />
      </div>
      <h3 className="store-card__name">{fish.name}</h3>
      <span className={`store-card__tier store-card__tier--${fish.tier}`}>{fish.tier}</span>
      <div className="store-card__price">
        <span className="points-badge__coin" aria-hidden="true" />
        {formatPoints(fish.price)}
      </div>
      {owned ? (
        inTank ? (
          <AeroButton variant="glass" onClick={() => onSetInTank(false)}>
            Take out of tank
          </AeroButton>
        ) : (
          <AeroButton onClick={() => onSetInTank(true)}>Put in tank</AeroButton>
        )
      ) : balance < fish.price ? (
        <AeroButton variant="glass" disabled>
          Need {formatPoints(fish.price - balance)} more
        </AeroButton>
      ) : (
        <AeroButton onClick={onBuy}>Adopt</AeroButton>
      )}
    </article>
  );
}

