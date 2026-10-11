import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { MAX_NAME_LENGTH } from '../../useFishtank';
import type { Fish, Stats } from '../../data';
import { AeroButton } from './AeroButton';
import { FishSprite } from './FishSprite';
import { GlassPanel } from './GlassPanel';
import { StatsBoard } from './StatsBoard';

export interface ProfileMenuProps {
  displayName: string;
  avatarFish: Fish | null;
  // Avatar choices.
  ownedFish: Fish[];
  stats: Stats;
  // The logged-in user, or null for a guest.
  account: FishtankUser | null;
  // Both resolve with an error message, or null on success.
  onLogIn: (email: string, password: string) => Promise<string | null>;
  onCreateAccount: (username: string, email: string, password: string) => Promise<string | null>;
  onLogOut: () => void;
  onRename: (name: string) => boolean;
  onSetAvatar: (fishId: string | null) => void;
  // Shown only when provided (dev builds).
  onGrantBonus?: () => void;
}

type Panel = 'main' | 'stats' | 'rename' | 'avatar' | 'login' | 'signup';

// Avatar button in the top-right corner that opens a glass dropdown.
export function ProfileMenu(props: ProfileMenuProps) {
  const { displayName, avatarFish } = props;
  const [open, setOpen] = useState(false);
  const onClose = useCallback(() => setOpen(false), []);
  const rootRef = useRef<HTMLDivElement>(null);
  const [panel, setPanel] = useState<Panel>('main');

  // Each time the menu opens, start on the main panel.
  useEffect(() => {
    if (open) setPanel('main');
  }, [open]);

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  return (
    <div className="profile-menu" ref={rootRef}>
      <button
        type="button"
        className={`profile-menu__trigger ${open ? 'is-open' : ''}`}
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Avatar fish={avatarFish} name={displayName} size={36} />
        <span className="profile-menu__name">{displayName}</span>
        <span className="profile-menu__caret" aria-hidden="true">
          ▾
        </span>
      </button>

      {open ? (
        <GlassPanel variant="raised" className={`profile-menu__dropdown ${panel === 'stats' ? 'is-wide' : ''}`} role="menu">
          {panel === 'main' ? (
            <MainPanel {...props} setPanel={setPanel} />
          ) : null}
          {panel === 'stats' ? <StatsPanel {...props} onDone={() => setPanel('main')} /> : null}
          {panel === 'rename' ? <RenamePanel {...props} onDone={() => setPanel('main')} /> : null}
          {panel === 'avatar' ? <AvatarPanel {...props} onDone={() => setPanel('main')} /> : null}
          {panel === 'login' ? <LoginPanel {...props} onDone={() => setPanel('main')} /> : null}
          {panel === 'signup' ? <SignupPanel {...props} onCreated={() => setPanel('login')} onDone={() => setPanel('main')} /> : null}
        </GlassPanel>
      ) : null}
    </div>
  );
}

function Avatar({ fish, name, size }: { fish: Fish | null; name: string; size: number }) {
  return (
    <span className="avatar" style={{ width: size, height: size }}>
      {fish ? <FishSprite fish={fish} size={size * 0.9} /> : <span className="avatar__initial">{name.charAt(0)}</span>}
    </span>
  );
}

function MainPanel({
  displayName,
  avatarFish,
  account,
  onLogOut,
  onGrantBonus,
  setPanel,
}: ProfileMenuProps & {
  setPanel: (panel: Panel) => void;
}) {
  return (
    <>
      <div className="profile-menu__header">
        <Avatar fish={avatarFish} name={displayName} size={52} />
        <div>
          <div className="profile-menu__header-name">{displayName}</div>
          <div className="muted">{account ? account.email : 'Guest'}</div>
        </div>
      </div>
      <div className="profile-menu__items">
        <MenuItem label="My stats" onClick={() => setPanel('stats')} />
        <MenuItem label="Edit name" onClick={() => setPanel('rename')} />
        <MenuItem label="Choose avatar fish" onClick={() => setPanel('avatar')} />
        <MenuItem label="Settings" hint="Coming soon" disabled />
        {onGrantBonus ? <MenuItem label="Add bonus points (dev)" onClick={onGrantBonus} /> : null}
        <div className="profile-menu__divider" />
        {account ? (
          <MenuItem label="Log out" onClick={onLogOut} />
        ) : (
          <>
            <MenuItem label="Log in" onClick={() => setPanel('login')} />
            <MenuItem label="Create account" onClick={() => setPanel('signup')} />
          </>
        )}
      </div>
    </>
  );
}

function MenuItem(props: { label: string; hint?: string; danger?: boolean; disabled?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      className={`menu-item ${props.danger ? 'menu-item--danger' : ''}`}
      onClick={props.onClick}
      disabled={props.disabled}
    >
      <span className="menu-item__label">{props.label}</span>
      {props.hint ? <span className="menu-item__hint">{props.hint}</span> : null}
    </button>
  );
}

function StatsPanel({ stats, onDone }: ProfileMenuProps & { onDone: () => void }) {
  return (
    <div className="profile-menu__form">
      <StatsBoard stats={stats} />
      <div className="form-actions">
        <AeroButton variant="glass" onClick={onDone}>
          Back
        </AeroButton>
      </div>
    </div>
  );
}

function RenamePanel({ displayName, onRename, onDone }: ProfileMenuProps & { onDone: () => void }) {
  const [name, setName] = useState(displayName);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (onRename(name)) onDone();
  };

  return (
    <form className="profile-menu__form" onSubmit={submit}>
      <label className="field-label" htmlFor="profile-name">
        Display name
      </label>
      <input
        id="profile-name"
        className="aero-input"
        value={name}
        maxLength={MAX_NAME_LENGTH}
        autoFocus
        onChange={(event) => setName(event.target.value)}
      />
      <div className="form-actions">
        <AeroButton variant="glass" onClick={onDone}>
          Cancel
        </AeroButton>
        <AeroButton type="submit">
          Save
        </AeroButton>
      </div>
    </form>
  );
}

function LoginPanel({ onLogIn, onDone }: ProfileMenuProps & { onDone: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    const problem = await onLogIn(email, password);
    setBusy(false);
    if (problem) setError(problem);
    else onDone();
  };

  return (
    <form className="profile-menu__form" onSubmit={(event) => void submit(event)}>
      <label className="field-label" htmlFor="login-email">
        Email
      </label>
      <input id="login-email" className="aero-input" type="email" required autoFocus value={email} onChange={(event) => setEmail(event.target.value)} />
      <label className="field-label" htmlFor="login-password">
        Password
      </label>
      <input id="login-password" className="aero-input" type="password" required value={password} onChange={(event) => setPassword(event.target.value)} />
      {error ? <p className="error-text">{error}</p> : null}
      <div className="form-actions">
        <AeroButton variant="glass" onClick={onDone}>
          Cancel
        </AeroButton>
        <AeroButton type="submit" disabled={busy}>
          Log in
        </AeroButton>
      </div>
    </form>
  );
}

function SignupPanel({ onCreateAccount, onCreated, onDone }: ProfileMenuProps & { onCreated: () => void; onDone: () => void }) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    const problem = await onCreateAccount(username, email, password);
    setBusy(false);
    if (problem) setError(problem);
    else onCreated();
  };

  return (
    <form className="profile-menu__form" onSubmit={(event) => void submit(event)}>
      <label className="field-label" htmlFor="signup-username">
        Username
      </label>
      <input id="signup-username" className="aero-input" required autoFocus maxLength={MAX_NAME_LENGTH} value={username} onChange={(event) => setUsername(event.target.value)} />
      <label className="field-label" htmlFor="signup-email">
        Email
      </label>
      <input id="signup-email" className="aero-input" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
      <label className="field-label" htmlFor="signup-password">
        Password
      </label>
      <input id="signup-password" className="aero-input" type="password" required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} />
      {error ? <p className="error-text">{error}</p> : null}
      <div className="form-actions">
        <AeroButton variant="glass" onClick={onDone}>
          Cancel
        </AeroButton>
        <AeroButton type="submit" disabled={busy}>
          Create account
        </AeroButton>
      </div>
    </form>
  );
}

function AvatarPanel({ ownedFish, avatarFish, onSetAvatar, onDone }: ProfileMenuProps & { onDone: () => void }) {
  const choose = (fishId: string | null) => {
    onSetAvatar(fishId);
    onDone();
  };

  return (
    <div className="profile-menu__form">
      <div className="field-label">Choose an avatar</div>
      {ownedFish.length === 0 ? (
        <p className="muted">Adopt a fish in the store to use it as your avatar.</p>
      ) : (
        <div className="avatar-grid">
          {ownedFish.map((fish) => (
            <button
              key={fish.id}
              type="button"
              className={`avatar-grid__option ${avatarFish?.id === fish.id ? 'is-selected' : ''}`}
              onClick={() => choose(fish.id)}
              title={fish.name}
            >
              <FishSprite fish={fish} size={48} />
            </button>
          ))}
        </div>
      )}
      <div className="form-actions">
        <AeroButton variant="glass" onClick={onDone}>
          Back
        </AeroButton>
        {avatarFish ? (
          <AeroButton variant="secondary" onClick={() => choose(null)}>
            Use initial
          </AeroButton>
        ) : null}
      </div>
    </div>
  );
}
