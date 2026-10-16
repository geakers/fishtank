import { useFishtank } from '../useFishtank';
import { StudyBubble } from './components/StudyBubble';
import { CustomArtContext } from './components/FishSprite';
import { HomeScreen } from './screens/HomeScreen';
import { LockInScreen } from './screens/LockInScreen';
import { StoreScreen } from './screens/StoreScreen';

export function App() {
  if (window.location.hash === '#study-bubble') return <StudyBubble />;
  return <MainApp />;
}

function MainApp() {
  const app = useFishtank();
  return <CustomArtContext.Provider value={app.customArt}>{screenFor(app)}</CustomArtContext.Provider>;
}

function screenFor(app: ReturnType<typeof useFishtank>) {
  if (app.screen === 'store') return <StoreScreen app={app} />;
  if (app.screen === 'lockIn') return <LockInScreen app={app} />;
  return <HomeScreen app={app} />;
}
