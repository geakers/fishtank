import { createRoot } from 'react-dom/client';
import './theme/aero.css';
import './theme/screens.css';
import { App } from './views/App';

createRoot(document.getElementById('root')!).render(<App />);
