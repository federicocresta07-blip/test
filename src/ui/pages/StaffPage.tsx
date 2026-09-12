import { useMemo, useState, type ReactNode } from 'react';
import {
  staffEffect,
  staffSalary,
  staffSpec,
  STAFF_ROLES,
  type StaffArea,
} from '../../domain/staff.ts';
import type { FacilityLevel } from '../../domain/facilities.ts';
import { Panel } from '../components/ui/Panel.tsx';
import { Tabs } from '../components/ui/Tabs.tsx';
import { EmptyState } from '../components/ui/EmptyState.tsx';
import { StaffCard } from '../components/club/StaffCard.tsx';
import { VacancyCard } from '../components/club/VacancyCard.tsx';
import { InvestmentBanner } from '../components/club/InvestmentBanner.tsx';
import { Link } from '../router/router.tsx';
import { Button } from '../components/ui/Button.tsx';
import { useGame, useGameState } from '../state/GameProvider.tsx';
import { moneyShort } from '../lib/format.ts';
import type { ClubFacility } from '../models/index.ts';

/**
 * STAFF Y CUERPO TECNICO (seccion 7) — fase 3 del plan.
 *
 * Los trece roles, el nivel de cada uno, lo que aporta de verdad y lo que
 * cuesta mejorarlo. La pantalla no inventa ni un numero: todo sale de
 * `domain/staff.ts`, que es el mismo modelo que consume la progresion del
 * plantel entre partidos.
 */

type AreaFilter = 'todas' | StaffArea;

const AREA_LABEL: Record<StaffArea, string> = {
  entrenamiento: 'Entrenamiento',
  médico: 'Cuerpo médico',
  scouting: 'Scouting',
  gestión: 'Gestión',
};

function levelOf(facilities: readonly ClubFacility[], id: ClubFacility['id']): FacilityLevel {
  return facilities.find((facility) => facility.id === id)?.level ?? 1;
}

export function StaffPage(): ReactNode {
  const state = useGameState();
  const { investment, upgradeStaff, hireStaff, dismissInvestment } = useGame();
  const [area, setArea] = useState<AreaFilter>('todas');

  const summary = useMemo(() => {
    const effects = state.staff.map((member) =>
      staffEffect(member.role, member.level, levelOf(state.facilities, staffSpec(member.role).facility)),
    );
    return {
      covered: state.staff.length,
      total: STAFF_ROLES.length,
      wages: state.staff.reduce((total, member) => total + staffSalary(member.role, member.level), 0),
      limited: effects.filter((effect) => effect.limited).length,
      live: effects.filter((effect) => effect.consumer.kind === 'implementado').length,
      averageLevel:
        state.staff.reduce((total, member) => total + member.level, 0) /
        Math.max(1, state.staff.length),
    };
  }, [state.staff, state.facilities]);

  const shown =
    area === 'todas'
      ? state.staff
      : state.staff.filter((member) => staffSpec(member.role).area === area);

  const shownVacancies =
    area === 'todas'
      ? state.vacancies
      : state.vacancies.filter((vacancy) => staffSpec(vacancy.role).area === area);

  // Orden estable: por area y despues por el orden canonico de los roles, no
  // por nivel. Asi la ficha de alguien no se mueve de lugar al mejorarlo.
  const ordered = [...shown].sort(
    (a, b) => STAFF_ROLES.indexOf(a.role) - STAFF_ROLES.indexOf(b.role),
  );

  return (
    <div className="page">
      <div className="clubsummary">
        <SummaryCell
          label="Caja disponible"
          value={moneyShort(state.finances.cash)}
          hint="Es de acá de donde sale cada mejora y cada contratación"
        />
        <SummaryCell
          label="Puestos cubiertos"
          value={`${summary.covered} de ${summary.total}`}
          hint={
            state.vacancies.length > 0
              ? `Vacante: ${state.vacancies.map((vacancy) => vacancy.role).join(', ')}`
              : 'El cuerpo técnico está completo'
          }
        />
        <SummaryCell
          label="Nivel medio"
          value={summary.averageLevel.toFixed(1).replace('.', ',')}
          hint="Promedio de estrellas del cuerpo técnico contratado"
        />
        <SummaryCell
          label="Salarios del staff"
          value={`${moneyShort(summary.wages)}/mes`}
          hint="No incluye la masa salarial de los jugadores"
        />
        <SummaryCell
          label="Limitados por instalaciones"
          value={String(summary.limited)}
          tone={summary.limited > 0 ? 'warn' : 'ok'}
          hint="Profesionales que no pueden dar todo lo que su nivel permite"
        />
        <SummaryCell
          label="Efectos ya aplicados"
          value={`${summary.live} de ${summary.covered}`}
          hint="El resto espera el módulo que los va a consumir; cada ficha dice cuál y en qué fase"
        />
      </div>

      <InvestmentBanner investment={investment} onDismiss={dismissInvestment} />

      <Panel
        title="Cuerpo técnico"
        subtitle="Cada ficha muestra el efecto real, quién lo consume y qué lo limita"
        actions={
          <Link to="/club/instalaciones">
            <Button size="sm" variant="ghost">
              Ver instalaciones
            </Button>
          </Link>
        }
      >
        <Tabs
          items={[
            { id: 'todas', label: 'Todas', count: state.staff.length },
            ...(['entrenamiento', 'médico', 'scouting', 'gestión'] as const).map((id) => ({
              id,
              label: AREA_LABEL[id],
              count: state.staff.filter((member) => staffSpec(member.role).area === id).length,
            })),
          ]}
          active={area}
          onChange={setArea}
          size="sm"
        />

        {ordered.length === 0 ? (
          <EmptyState
            title="No hay nadie contratado en esta área"
            detail="Los puestos vacantes de esta área aparecen más abajo, con sus candidatos."
          />
        ) : (
          <div className="staffgrid">
            {ordered.map((member) => (
              <StaffCard
                key={member.id}
                member={member}
                facilityLevel={levelOf(state.facilities, staffSpec(member.role).facility)}
                cash={state.finances.cash}
                busy={investment.pending}
                onUpgrade={() =>
                  void upgradeStaff(
                    member.id,
                    `${member.name} pasó a ${member.level + 1} estrellas`,
                  )
                }
              />
            ))}
          </div>
        )}
      </Panel>

      {shownVacancies.length > 0 && (
        <Panel
          title={shownVacancies.length === 1 ? 'Puesto vacante' : 'Puestos vacantes'}
          subtitle="Cada candidato muestra lo que daría en este club, no en abstracto"
        >
          <div className="vacancygrid">
            {shownVacancies.map((vacancy) => (
              <VacancyCard
                key={vacancy.role}
                vacancy={vacancy}
                facilityLevel={levelOf(state.facilities, staffSpec(vacancy.role).facility)}
                cash={state.finances.cash}
                busy={investment.pending}
                onHire={(candidate) =>
                  void hireStaff(
                    vacancy.role,
                    candidate.id,
                    `${candidate.name} firmó como ${vacancy.role}`,
                  )
                }
              />
            ))}
          </div>
        </Panel>
      )}

      <Panel title="Cómo funcionan estos números">
        <div className="clubnotes">
          <p>
            El efecto de cada profesional sale de su nivel y se multiplica por lo que la instalación
            que lo respalda le permite aprovechar. Una instalación mejor de lo necesario no lo
            potencia: solo deja de limitarlo. Al revés sí lo recorta, y por eso conviene mirar las
            dos cosas juntas.
          </p>
          <p>
            Tres efectos ya los aplica el juego hoy —recuperación física, tiempo de recuperación de
            lesiones y recuperación de la moral— y se pueden ver funcionando en la evolución del
            plantel entre partidos. Los demás declaran en su ficha qué módulo los va a consumir y en
            qué fase se construye. Preferimos decirlo antes que mostrar un número que no hace nada.
          </p>
          <p>
            Un puesto vacante no tiene penalización oculta: simplemente no aporta su beneficio. Y
            las obras y mejoras figuran con sus semanas de trabajo, pero hasta que exista el
            calendario (fase 7) se aplican al instante.
          </p>
        </div>
      </Panel>
    </div>
  );
}

function SummaryCell({
  label,
  value,
  hint,
  tone,
}: {
  readonly label: string;
  readonly value: string;
  readonly hint: string;
  readonly tone?: 'ok' | 'warn';
}): ReactNode {
  return (
    <div className="clubsummary__cell" title={hint}>
      <span className="clubsummary__label">{label}</span>
      <span className={`clubsummary__value tnum ${tone ? `is-${tone}` : ''}`}>{value}</span>
      <span className="clubsummary__hint">{hint}</span>
    </div>
  );
}
