import { useEffect, type ReactNode } from 'react';
import { AppShell } from './components/AppShell.tsx';
import { Button } from './components/ui/Button.tsx';
import { Skeleton } from './components/ui/EmptyState.tsx';
import { useGame } from './state/GameProvider.tsx';
import { useRouter } from './router/router.tsx';
import { firstItemOfSection } from './router/navigation.ts';
import { DashboardPage } from './pages/DashboardPage.tsx';
import { SquadPage } from './pages/SquadPage.tsx';
import { LineupPage } from './pages/LineupPage.tsx';
import { StaffPage } from './pages/StaffPage.tsx';
import { FacilitiesPage } from './pages/FacilitiesPage.tsx';
import { StadiumPage } from './pages/StadiumPage.tsx';
import { FinancesPage } from './pages/FinancesPage.tsx';
import { MessagesPage } from './pages/MessagesPage.tsx';
import { CalendarPage } from './pages/CalendarPage.tsx';
import { ResultsPage } from './pages/ResultsPage.tsx';
import { TablePage } from './pages/TablePage.tsx';
import { StatsPage } from './pages/StatsPage.tsx';
import { MatchPage } from './pages/MatchPage.tsx';
import { RivalsPage } from './pages/RivalsPage.tsx';
import { NewsPage } from './pages/NewsPage.tsx';
import { TrainingPage } from './pages/TrainingPage.tsx';
import { YouthPage } from './pages/YouthPage.tsx';
import { MarketSearchPage } from './pages/MarketSearchPage.tsx';
import { TransferListPage } from './pages/TransferListPage.tsx';
import { OffersPage } from './pages/OffersPage.tsx';
import { TransferHistoryPage } from './pages/TransferHistoryPage.tsx';
import { NotFoundPage } from './pages/NotFoundPage.tsx';

/** Resuelve la pantalla que corresponde a la ruta actual. */
function Screen(): ReactNode {
  const { path } = useRouter();

  // Dos rutas llevan un id adentro: la ficha de un partido y el perfil de un
  // club. Se parsean aca en lugar de meterle patrones al router, que para seis
  // secciones planas no los necesita (regla de la seccion 21).
  const match = matchParam(path, '/competicion/partido/');
  if (match) return <MatchPage fixtureId={match} />;

  const rival = matchParam(path, '/informacion/rivales/');
  if (rival) return <RivalsPage clubId={rival} />;

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
    case '/club/estadio':
      return <StadiumPage />;
    case '/club/finanzas':
      return <FinancesPage />;
    case '/informacion/mensajes':
      return <MessagesPage />;
    case '/competicion/calendario':
      return <CalendarPage />;
    case '/competicion/resultados':
      return <ResultsPage />;
    case '/competicion/tabla':
      return <TablePage />;
    case '/competicion/estadisticas':
      return <StatsPage />;
    case '/informacion/rivales':
      return <RivalsPage />;
    case '/informacion/noticias':
      return <NewsPage />;
    case '/equipo/entrenamiento':
      return <TrainingPage />;
    case '/club/inferiores':
      return <YouthPage />;
    case '/mercado/buscar':
      return <MarketSearchPage />;
    case '/mercado/transferibles':
      return <TransferListPage />;
    case '/mercado/enviadas':
      return <OffersPage side="enviadas" />;
    case '/mercado/recibidas':
      return <OffersPage side="recibidas" />;
    case '/mercado/historial':
      return <TransferHistoryPage />;
    default:
      // Una ruta de seccion (`/club`, `/mercado`) no es una pantalla: es una
      // cabecera que agrupa. Se va a su primera pantalla.
      //
      // Y ya no hay `PlaceholderPage`: con las nueve fases entregadas no queda
      // ningun modulo pendiente, asi que una pagina que dice "esto todavia no
      // esta construido" solo podia mentir. Se borro en lugar de dejarla
      // inalcanzable esperando a que volviera a ser cierta.
      return <SectionRedirect path={path} />;
  }
}

/**
 * Lleva de una ruta de seccion a su primera pantalla.
 *
 * Si la ruta no es una seccion, es una ruta que no existe y se dice.
 */
function SectionRedirect({ path }: { readonly path: string }): ReactNode {
  const { navigate } = useRouter();
  const target = firstItemOfSection(path);

  useEffect(() => {
    if (target) navigate(target);
  }, [target, navigate]);

  return target ? null : <NotFoundPage />;
}

/** El segmento que sigue a un prefijo de ruta, si la ruta lo trae. */
function matchParam(path: string, prefix: string): string | null {
  if (!path.startsWith(prefix)) return null;
  const rest = path.slice(prefix.length);
  return rest.length > 0 ? rest : null;
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
