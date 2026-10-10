import { FISH, type Fish } from '../../data';
import type { App } from '../../useFishtank';
import { AeroButton } from '../components/AeroButton';
import { BubbleField } from '../components/Bubble';
import { FishSprite } from '../components/FishSprite';
import { GlassPanel } from '../components/GlassPanel';
import { PointsBadge } from '../components/PointsBadge';
import { Toast } from '../components/Toast';
import { capitalize, formatPoints } from '../format';

export interface StoreScreenProps {
  app: App;
}

export function StoreScreen({ app }: StoreScreenProps) {
  return (
    <div className="screen store">
      <BubbleField count={12} seed="store" />

      <header className="topbar">
        <div className="topbar__left">
          <AeroButton variant="glass" onClick={() => app.setScreen('home')}>
            ← Home
          </AeroButton>
          <div>
            <h1 className="screen-title">Fish Store</h1>
            <p className="muted">Spend your points to grow your aquarium.</p>
          </div>
        </div>
        <PointsBadge balance={app.points} />
      </header>

      <div className="store__grid">
        {FISH.map((fish) => (
          <StoreCard
            key={fish.id}
            fish={fish}
            owned={app.owned.includes(fish)}
            balance={app.points}
            onBuy={() => app.buy(fish)}
          />
        ))}
      </div>

      <Toast notice={app.toast} onDismiss={app.dismissToast} />
    </div>
  );
}

interface StoreCardProps {
  fish: Fish;
  owned: boolean;
  balance: number;
  onBuy: () => void;
}

function StoreCard({ fish, owned, balance, onBuy }: StoreCardProps) {
  return (
    <GlassPanel className={`store-card store-card--${fish.rarity} ${owned ? 'is-owned' : ''}`}>
      <div className="store-card__tank">
        <FishSprite fish={fish} size={120} className="store-card__sprite" />
      </div>
      <div className="store-card__body">
        <div className="store-card__title">
          <h3>{fish.name}</h3>
          <span className={`rarity-tag rarity-tag--${fish.rarity}`}>{capitalize(fish.rarity)}</span>
        </div>
        <div className="store-card__price">
          <span className="points-badge__coin" aria-hidden="true">
            ★
          </span>
          {formatPoints(fish.price)}
        </div>
        {owned ? (
          <AeroButton variant="glass" disabled>
            ✓ In your tank
          </AeroButton>
        ) : balance < fish.price ? (
          <AeroButton variant="glass" disabled>
            Need {formatPoints(fish.price - balance)} more
          </AeroButton>
        ) : (
          <AeroButton onClick={onBuy}>Adopt</AeroButton>
        )}
      </div>
    </GlassPanel>
  );
}
