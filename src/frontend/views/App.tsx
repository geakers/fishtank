import { useFishtank } from '../useFishtank';
import { HomeScreen } from './screens/HomeScreen';
import { LockInScreen } from './screens/LockInScreen';
import { StoreScreen } from './screens/StoreScreen';

export function App() {
  const app = useFishtank();
  if (app.screen === 'store') return <StoreScreen app={app} />;
  if (app.screen === 'lockIn') return <LockInScreen app={app} />;
  return <HomeScreen app={app} />;
}
