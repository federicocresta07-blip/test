import type { ReactNode } from 'react';
import { NextMatchCard } from '../components/dashboard/NextMatchCard.tsx';
import { SquadSituation } from '../components/dashboard/SquadSituation.tsx';
import { ManagerInbox } from '../components/dashboard/ManagerInbox.tsx';
import { FinanceWidget } from '../components/dashboard/FinanceWidget.tsx';
import { MarketWidget } from '../components/dashboard/MarketWidget.tsx';
import { DevelopmentWidget } from '../components/dashboard/DevelopmentWidget.tsx';
import { CompetitionWidget } from '../components/dashboard/CompetitionWidget.tsx';

/**
 * DESPACHO DEL MANAGER (seccion 5) — fase 1 del plan.
 *
 * El orden de la grilla no es decorativo: comunica prioridades. Arriba, lo
 * que hay que resolver antes del partido; despues, lo que le esta contando el
 * cuerpo tecnico; abajo, como viene el club.
 */
export function DashboardPage(): ReactNode {
  return (
    <div className="page dashboard">
      {/* Dos columnas que apilan por su cuenta: asi ninguna deja un hueco
          grande esperando a la otra (seccion 3.2). */}
      <div className="dashboard__main">
        <div className="dashboard__col">
          <NextMatchCard />
          <ManagerInbox />
        </div>
        <div className="dashboard__col">
          <SquadSituation />
          <FinanceWidget />
        </div>
      </div>

      <div className="dashboard__row dashboard__row--bottom">
        <MarketWidget />
        <DevelopmentWidget />
        <CompetitionWidget />
      </div>
    </div>
  );
}
