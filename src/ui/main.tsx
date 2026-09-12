import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { GameProvider } from './state/GameProvider.tsx';
import { RouterProvider } from './router/router.tsx';

import './styles/tokens.css';
import './styles/base.css';
import './components/ui/ui.css';
import './components/shell.css';
import './pages/pages.css';
import './pages/dashboard.css';
import './pages/squad.css';
import './pages/lineup.css';
import './pages/club.css';
import './pages/competition.css';
import './pages/market.css';

const container = document.getElementById('root');
if (!container) throw new Error('Falta el contenedor #root en index.html');

createRoot(container).render(
  <StrictMode>
    <RouterProvider>
      <GameProvider>
        <App />
      </GameProvider>
    </RouterProvider>
  </StrictMode>,
);
