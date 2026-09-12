import type { ReactNode } from 'react';
import { Panel } from '../ui/Panel.tsx';
import { ProgressBar } from '../ui/ProgressBar.tsx';
import { Stars } from '../ui/Stars.tsx';
import { Button } from '../ui/Button.tsx';
import { EmptyState } from '../ui/EmptyState.tsx';
import { Link } from '../../router/router.tsx';
import { useGameState } from '../../state/GameProvider.tsx';
import { facilitySpec } from '../../../domain/facilities.ts';
import { projectProgress } from '../../models/index.ts';

/**
 * DESARROLLO DEL CLUB (seccion 5.5).
 *
 * Obras y mejoras en curso: estadio, instalaciones y staff en un mismo lugar,
 * porque para el manager son el mismo sistema de crecimiento.
 */
export function DevelopmentWidget(): ReactNode {
  const state = useGameState();
  const facilities = state.facilities.slice(0, 3);

  return (
    <Panel
      title="Desarrollo del club"
      actions={
        <Link to="/club/instalaciones">
          <Button size="sm" variant="ghost">
            Instalaciones
          </Button>
        </Link>
      }
    >
      {state.projects.length === 0 ? (
        <EmptyState title="Sin obras en curso" detail="No hay mejoras de estadio, instalaciones ni staff." />
      ) : (
        <ul className="projectlist">
          {state.projects.map((project) => (
            <li key={project.id} className="projectrow">
              <span className="col">
                <span className="projectrow__top">
                  <span className="projectrow__name truncate">{project.label}</span>
                  <span className="projectrow__weeks tnum muted">
                    {project.weeksLeft} {project.weeksLeft === 1 ? 'semana' : 'semanas'}
                  </span>
                </span>
                <ProgressBar value={projectProgress(project)} tone="accent" height={5} />
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="facilitymini">
        <span className="label">Instalaciones</span>
        <ul>
          {facilities.map((facility) => (
            <li key={facility.id} className="row row--between">
              <span className="truncate secondary">{facilitySpec(facility.id).name}</span>
              <Stars value={facility.level} size="sm" />
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}
