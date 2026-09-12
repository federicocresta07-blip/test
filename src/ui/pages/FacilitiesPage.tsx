import { useMemo, type ReactNode } from 'react';
import {
  facilitySpec,
  facilityUpkeep,
  FACILITY_IDS,
  MAX_FACILITY_LEVEL,
} from '../../domain/facilities.ts';
import { rolesSupportedBy, staffEffect, staffSpec } from '../../domain/staff.ts';
import { Panel } from '../components/ui/Panel.tsx';
import { Button } from '../components/ui/Button.tsx';
import { ProgressBar } from '../components/ui/ProgressBar.tsx';
import { FacilityCard } from '../components/club/FacilityCard.tsx';
import { InvestmentBanner } from '../components/club/InvestmentBanner.tsx';
import { Link } from '../router/router.tsx';
import { useGame, useGameState } from '../state/GameProvider.tsx';
import { moneyShort } from '../lib/format.ts';
import { projectProgress } from '../models/index.ts';

/**
 * INSTALACIONES DEL CLUB (seccion 8) — fase 3 del plan.
 *
 * La otra mitad del sistema de desarrollo. La pantalla de staff muestra el
 * acople desde la persona ("esta instalacion me limita al 73%"); esta lo
 * muestra desde el ladrillo: a quienes respalda cada instalacion, a cuantos
 * esta frenando y que se destraba si se invierte.
 */
export function FacilitiesPage(): ReactNode {
  const state = useGameState();
  const { investment, upgradeFacility, dismissInvestment } = useGame();

  const summary = useMemo(() => {
    const levels = state.facilities.map((facility) => facility.level);
    const upkeep = state.facilities.reduce(
      (total, facility) => total + facilityUpkeep(facility.id, facility.level),
      0,
    );

    // Cuantos profesionales estan frenados, y por que instalacion.
    const limited = state.staff.filter((member) => {
      const spec = staffSpec(member.role);
      const level = state.facilities.find((facility) => facility.id === spec.facility)?.level ?? 1;
      return staffEffect(member.role, member.level, level).limited;
    });

    // La instalacion que mas cuesta dejar como esta: la que frena a mas gente.
    const worst = FACILITY_IDS.map((id) => ({
      id,
      blocked: limited.filter((member) => staffSpec(member.role).facility === id).length,
    }))
      .filter((entry) => entry.blocked > 0)
      .sort((a, b) => b.blocked - a.blocked)[0];

    return {
      averageLevel: levels.reduce((a, b) => a + b, 0) / Math.max(1, levels.length),
      atMax: levels.filter((level) => level >= MAX_FACILITY_LEVEL).length,
      upkeep,
      limited: limited.length,
      worst,
    };
  }, [state.facilities, state.staff]);

  return (
    <div className="page">
      <div className="clubsummary">
        <SummaryCell
          label="Caja disponible"
          value={moneyShort(state.finances.cash)}
          hint="Las obras se pagan de acá, igual que las mejoras del staff"
        />
        <SummaryCell
          label="Nivel medio"
          value={summary.averageLevel.toFixed(1).replace('.', ',')}
          hint={`${summary.atMax} de ${state.facilities.length} instalaciones al máximo`}
        />
        <SummaryCell
          label="Mantenimiento"
          value={`${moneyShort(summary.upkeep)}/mes`}
          hint="Gasto fijo de las cinco instalaciones en su nivel actual. Subir de nivel lo aumenta."
        />
        <SummaryCell
          label="Profesionales frenados"
          value={String(summary.limited)}
          tone={summary.limited > 0 ? 'warn' : 'ok'}
          hint={
            summary.worst
              ? `La que más frena es ${facilitySpec(summary.worst.id).name}: ${summary.worst.blocked} ${summary.worst.blocked === 1 ? 'profesional' : 'profesionales'}`
              : 'Ninguna instalación está limitando al cuerpo técnico'
          }
        />
      </div>

      <InvestmentBanner investment={investment} onDismiss={dismissInvestment} />

      {summary.worst && (
        <Panel title="Dónde conviene invertir primero">
          <div className="clubnotes">
            <p>
              {facilitySpec(summary.worst.id).name} está frenando a{' '}
              <strong>
                {summary.worst.blocked}{' '}
                {summary.worst.blocked === 1 ? 'profesional' : 'profesionales'}
              </strong>{' '}
              de los {rolesSupportedBy(summary.worst.id).length} que respalda. Mejorarla les sube el
              rendimiento sin pagarles un peso más de salario, que es la diferencia de fondo entre
              invertir en infraestructura e invertir en personas: el ladrillo se paga una vez, el
              sueldo todos los meses.
            </p>
          </div>
        </Panel>
      )}

      <Panel
        title="Instalaciones"
        subtitle="De una a cinco estrellas. Cada ficha dice a quién respalda y a quién está frenando"
        actions={
          <Link to="/club/staff">
            <Button size="sm" variant="ghost">
              Ver cuerpo técnico
            </Button>
          </Link>
        }
      >
        <div className="facilitygrid">
          {state.facilities.map((facility) => (
            <FacilityCard
              key={facility.id}
              facility={facility}
              staff={state.staff}
              cash={state.finances.cash}
              busy={investment.pending}
              onUpgrade={() =>
                void upgradeFacility(
                  facility.id,
                  `${facilitySpec(facility.id).name} pasó a ${facility.level + 1} estrellas`,
                )
              }
            />
          ))}
        </div>
      </Panel>

      {state.projects.length > 0 && (
        <Panel
          title="Obras en curso"
          subtitle="Información: el avance por semanas empieza a correr con el calendario, en la fase 7"
        >
          <ul className="projectlist">
            {state.projects.map((project) => (
              <li className="projectrow" key={project.id}>
                <div className="projectrow__main">
                  <span className="projectrow__label">{project.label}</span>
                  <span className="projectrow__meta">
                    {project.kind} · {moneyShort(project.cost)} ·{' '}
                    {project.weeksLeft === 0
                      ? 'terminada'
                      : `${project.weeksLeft} ${project.weeksLeft === 1 ? 'semana' : 'semanas'} restantes`}
                  </span>
                </div>
                <div className="projectrow__bar">
                  <ProgressBar
                    value={projectProgress(project)}
                    label={`${Math.round(projectProgress(project) * 100)}% completado`}
                  />
                  <span className="projectrow__pct tnum">
                    {Math.round(projectProgress(project) * 100)}%
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}
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
