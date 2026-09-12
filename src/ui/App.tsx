import type { ReactNode } from 'react';
import { AppShell } from './components/AppShell.tsx';
import { Button } from './components/ui/Button.tsx';
import { Skeleton } from './components/ui/EmptyState.tsx';
import { useGame } from './state/GameProvider.tsx';
import { useRouter } from './router/router.tsx';
import { findNavItem } from './router/navigation.ts';
import { DashboardPage } from './pages/DashboardPage.tsx';
import { SquadPage } from './pages/SquadPage.tsx';
import { LineupPage } from './pages/LineupPage.tsx';
import { StaffPage } from './pages/StaffPage.tsx';
import { FacilitiesPage } from './pages/FacilitiesPage.tsx';
import { MessagesPage } from './pages/MessagesPage.tsx';
import { NotFoundPage, PlaceholderPage } from './pages/PlaceholderPage.tsx';

/** Resuelve la pantalla que corresponde a la ruta actual. */
function Screen(): ReactNode {
  const { path } = useRouter();

  switch (path) {
    case '/':
      return <DashboardPage />;
    case '/equipo/plantel':
      return <SquadPage />;
    case '/equipo/alineacion':
      return <LineupPage />;
    // La tactica se configura desde la misma pantalla de alineacion, con el
    // panel abierto: la seccion 6.10 pide mantener el foco en la formacion.
    case '/equipo/tactica':
      return <LineupPage openPanel="tactica" />;
    case '/club/staff':
      return <StaffPage />;
    case '/club/instalaciones':
      return <FacilitiesPage />;
    case '/informacion/mensajes':
      return <MessagesPage />;
    default:
      return findNavItem(path) ? <PlaceholderPage /> : <NotFoundPage />;
  }
}

export function App(): ReactNode {
  const { state, loading, error, reload } = useGame();

  if (loading) {
    return (
      <div className="bootstate">
        <div className="bootstate__box">
          <p className="bootstate__title">Cargando el club…</p>
          <Skeleton height={8} width={220} />
        </div>
      </div>
    );
  }

  if (error || !state) {
    return (
      <div className="bootstate">
        <div className="bootstate__box">
          <p className="bootstate__title">No pudimos cargar el club</p>
          <p className="bootstate__detail">{error ?? 'El estado del juego llegó vacío.'}</p>
          <Button variant="primary" onClick={reload}>
            Volver a intentar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <AppShell>
      <Screen />
    </AppShell>
  );
}
