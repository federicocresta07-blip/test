import { useMemo, type ReactNode } from 'react';
import {
  ageFactor,
  headroom,
  TRAINING_FOCUSES,
  type TrainingFocus,
} from '../../progression/development.ts';
import {
  coachRoleFor,
  focusFor,
  individualCount,
  INTENSITY_LABELS,
  type TrainingPlan,
} from '../../domain/training.ts';
import { staffEffect, staffSpec, type StaffRole } from '../../domain/staff.ts';
import { Panel } from '../components/ui/Panel.tsx';
import { Button } from '../components/ui/Button.tsx';
import { Badge } from '../components/ui/Badge.tsx';
import { RatingBadge } from '../components/ui/Badge.tsx';
import { Stars } from '../components/ui/Stars.tsx';
import { DataTable } from '../components/ui/Table.tsx';
import { Link } from '../router/router.tsx';
import { useGame, useGameState } from '../state/GameProvider.tsx';
import { naturalOverall } from '../lib/engine-bridge.ts';
import { positionName } from '../lib/positions.ts';
import type { ClubPlayer, GameState } from '../models/index.ts';

/**
 * ENTRENAMIENTO (seccion 7) — fase 4 del plan.
 *
 * Tres decisiones, y las tres tienen consecuencia medible:
 *
 * 1. LA INTENSIDAD. Desarrolla mas rapido y cansa mas. Con fechas de mitad de
 *    semana, entrenar al maximo se paga en las piernas.
 *
 * 2. EL PLAN. No es un bonus: reparte. Elegir "fisico" es elegir crecer en lo
 *    fisico y mas lento en lo tecnico.
 *
 * 3. QUIEN LO DIRIGE. Cada puesto lo trabaja el entrenador de su linea, y su
 *    efecto sale de la ficha del staff. Por eso esta pantalla muestra, al lado
 *    de cada jugador, cuanto lo acelera SU entrenador y no un promedio.
 */

const FOCUS_LABEL: Record<TrainingFocus, string> = {
  general: 'General',
  fisico: 'Físico',
  tecnica: 'Técnica',
  defensivo: 'Defensivo',
  ofensivo: 'Ofensivo',
  mental: 'Mental',
  arquero: 'Arquero',
};

export function TrainingPage(): ReactNode {
  const state = useGameState();
  const { saveTraining } = useGame();
  const plan = state.training;

  const coaching = useMemo(() => coachingByRole(state), [state.staff, state.facilities]);

  const update = (next: Partial<TrainingPlan>): void => {
    void saveTraining({ ...plan, ...next });
  };

  const setIndividual = (playerId: string, focus: TrainingFocus | null): void => {
    const individual = { ...plan.individual };
    if (focus === null) delete individual[playerId];
    else individual[playerId] = focus;
    update({ individual });
  };

  const ordered = [...state.squad].sort((a, b) => naturalOverall(b.player) - naturalOverall(a.player));
  const growing = ordered.filter((entry) => headroom(entry.player) > 0.05).length;
  const declining = ordered.filter((entry) => ageFactor(entry.player.age, 'fisico') < 0).length;

  return (
    <div className="page">
      <div className="clubsummary">
        <SummaryCell
          label="Intensidad"
          value={INTENSITY_LABELS.find((entry) => entry.value === plan.intensity)?.label ?? 'Normal'}
          hint="Más intensidad desarrolla más rápido y cansa más"
        />
        <SummaryCell
          label="Con margen para crecer"
          value={`${growing} de ${state.squad.length}`}
          hint="Jugadores que todavía no llegaron a su potencial"
        />
        <SummaryCell
          label="En declive físico"
          value={String(declining)}
          tone={declining > 0 ? 'warn' : undefined}
          hint="Desde los 30 se empieza a perder físico, aunque la cabeza siga mejorando"
        />
        <SummaryCell
          label="Planes individuales"
          value={String(individualCount(plan))}
          hint="El resto entrena lo que corresponde a su puesto"
        />
      </div>

      {/* --- Intensidad --- */}
      <Panel title="Intensidad del entrenamiento" subtitle="Lo que desarrolla, lo paga en piernas">
        <div className="intensity">
          {INTENSITY_LABELS.map((entry) => (
            <button
              key={entry.value}
              className={`intensity__option ${plan.intensity === entry.value ? 'is-active' : ''}`}
              onClick={() => update({ intensity: entry.value })}
            >
              <span className="intensity__label">{entry.label}</span>
              <span className="intensity__note">{entry.note}</span>
            </button>
          ))}
        </div>
      </Panel>

      {/* --- Quien dirige cada linea --- */}
      <Panel
        title="Quién dirige cada línea"
        subtitle="El efecto sale de la ficha de cada profesional, con el límite de las instalaciones ya descontado"
        actions={
          <Link to="/club/staff">
            <Button size="sm" variant="ghost">
              Ver cuerpo técnico
            </Button>
          </Link>
        }
      >
        <div className="coachgrid">
          {(
            [
              ['Entrenador de arqueros', 'POR'],
              ['Entrenador defensivo', 'LD, DFC, LI'],
              ['Entrenador de mediocampistas', 'MCD, MC, MCO'],
              ['Entrenador ofensivo', 'ED, EI, SD, DC'],
            ] as const
          ).map(([role, covers]) => {
            const entry = coaching[role];
            return (
              <div className={`coachcard ${entry ? '' : 'is-vacant'}`} key={role}>
                <span className="coachcard__role">{role}</span>
                <span className="coachcard__covers">Trabaja con {covers}</span>
                {entry ? (
                  <>
                    <Stars value={entry.level} size="sm" />
                    <span className="coachcard__effect">
                      +{Math.round(entry.effect)}%{' '}
                      <span className="muted">de velocidad de desarrollo</span>
                    </span>
                    {entry.limited && (
                      <span className="coachcard__limited">
                        Las instalaciones lo limitan al {Math.round(entry.utilisation * 100)}%
                      </span>
                    )}
                  </>
                ) : (
                  <span className="coachcard__vacant">
                    Puesto vacante: estos puestos desarrollan al ritmo base
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </Panel>

      {/* --- El plantel --- */}
      <Panel
        title="Plan de cada jugador"
        subtitle="Por defecto cada uno entrena lo de su puesto. Cambialo cuando quieras algo distinto"
        padded={false}
      >
        <DataTable>
          <thead>
            <tr>
              <th>Jugador</th>
              <th style={{ width: 54 }}>Pos</th>
              <th style={{ width: 44, textAlign: 'right' }}>Edad</th>
              <th style={{ width: 52, textAlign: 'right' }}>Ahora</th>
              <th style={{ width: 120 }}>Margen</th>
              <th style={{ width: 86, textAlign: 'right' }}>Su entrenador</th>
              <th style={{ width: 190 }}>Plan de entrenamiento</th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((entry) => (
              <PlayerRow
                key={entry.player.id}
                entry={entry}
                plan={plan}
                coaching={coaching}
                onChange={(focus) => setIndividual(entry.player.id, focus)}
              />
            ))}
          </tbody>
        </DataTable>
      </Panel>

      <Panel title="Cómo se desarrolla un jugador">
        <div className="clubnotes">
          <p>
            Cuatro cosas lo mueven, y ninguna es azar puro. <strong>La edad</strong>: un pibe de 18
            crece rápido, a los 27 se estanca y después de los 31 empieza a perder — y no pierde
            todo junto, primero se va lo físico, así que un 5 de 33 sigue mejorando el
            posicionamiento mientras le baja la velocidad. <strong>El techo</strong>: se crece hacia
            el potencial, no sin límite. <strong>Los minutos</strong>: el que no juega crece cerca
            de la mitad de rápido. Y <strong>el entrenamiento</strong>: el plan reparte hacia dónde
            va el crecimiento, y el entrenador de su línea lo acelera.
          </p>
          <p>
            Medido sobre una temporada de 19 fechas: un juvenil con margen que juega seguido y tiene
            un entrenador de cuatro estrellas gana unos <strong>11 puntos</strong> de overall; el
            mismo sin entrenador, <strong>9</strong>; el mismo sin jugar, <strong>6</strong>. Un
            titular de 27 en su techo, cero. Un veterano de 34 pierde unos tres puntos de físico y
            casi nada de cabeza.
          </p>
          <p>
            El plan <strong>no suma, reparte</strong>: lo que un grupo de atributos gana, los otros
            lo pierden. Por eso no existe un plan que sea mejor que los demás, solo uno más adecuado
            a cada jugador.
          </p>
        </div>
      </Panel>
    </div>
  );
}

type CoachInfo = {
  readonly level: number;
  readonly effect: number;
  readonly limited: boolean;
  readonly utilisation: number;
};

/** El efecto real del entrenador de cada linea, o `undefined` si esta vacante. */
function coachingByRole(state: GameState): Readonly<Partial<Record<StaffRole, CoachInfo>>> {
  const out: Partial<Record<StaffRole, CoachInfo>> = {};
  for (const member of state.staff) {
    const facility = staffSpec(member.role).facility;
    const level = state.facilities.find((entry) => entry.id === facility)?.level ?? 1;
    const effect = staffEffect(member.role, member.level, level);
    out[member.role] = {
      level: member.level,
      effect: effect.actual,
      limited: effect.limited,
      utilisation: effect.utilisation,
    };
  }
  return out;
}

function PlayerRow({
  entry,
  plan,
  coaching,
  onChange,
}: {
  readonly entry: ClubPlayer;
  readonly plan: TrainingPlan;
  readonly coaching: Readonly<Partial<Record<StaffRole, CoachInfo>>>;
  readonly onChange: (focus: TrainingFocus | null) => void;
}): ReactNode {
  const player = entry.player;
  const overall = naturalOverall(player);
  const room = headroom(player);
  const declining = ageFactor(player.age, 'fisico') < 0;
  const coach = coaching[coachRoleFor(player.position)];
  const own = plan.individual[player.id];
  const effective = focusFor(plan, player.id, player.position);

  return (
    <tr>
      <td className="truncate">{player.name}</td>
      <td className="secondary" title={positionName(player.position)}>
        {player.position}
      </td>
      <td className="tnum" style={{ textAlign: 'right' }}>
        {player.age}
      </td>
      <td style={{ textAlign: 'right' }}>
        <RatingBadge value={overall} size="sm" />
      </td>
      <td>
        {room > 0.05 ? (
          <span className="margin">
            <span className="margin__bar">
              <span className="margin__fill" style={{ width: `${Math.min(100, room * 100)}%` }} />
            </span>
            <span className="margin__label tnum">
              +{Math.max(1, Math.round(player.potential - overall))}
            </span>
          </span>
        ) : declining ? (
          <Badge tone="warn" title="Desde los 30 se pierde físico">
            en declive
          </Badge>
        ) : (
          <span className="muted">en su techo</span>
        )}
      </td>
      <td style={{ textAlign: 'right' }}>
        {coach ? (
          <span
            className="tnum"
            title={`${coachRoleFor(player.position)}${coach.limited ? `, limitado al ${Math.round(coach.utilisation * 100)}% por las instalaciones` : ''}`}
          >
            +{Math.round(coach.effect)}%
          </span>
        ) : (
          <span className="muted" title={`${coachRoleFor(player.position)}: puesto vacante`}>
            —
          </span>
        )}
      </td>
      <td className="plancell">
        {/* La opcion por defecto dice solo "Por su puesto": poner el plan
            resuelto adentro del texto desbordaba la columna y lo cortaba a la
            mitad. El plan que le toca se muestra al lado, que ademas deja ver
            de un vistazo si es propio o heredado. */}
        <select
          className="planselect"
          value={own ?? ''}
          onChange={(event) =>
            onChange(event.target.value === '' ? null : (event.target.value as TrainingFocus))
          }
          aria-label={`Plan de entrenamiento de ${player.name}`}
          title={
            own
              ? `Plan propio: ${FOCUS_LABEL[own]}`
              : `Hereda el plan de su puesto: ${FOCUS_LABEL[effective]}`
          }
        >
          <option value="">Por su puesto</option>
          {TRAINING_FOCUSES.map((focus) => (
            <option key={focus} value={focus}>
              {FOCUS_LABEL[focus]}
            </option>
          ))}
        </select>
        <span className={`plancell__resolved ${own ? 'is-own' : ''}`}>
          {FOCUS_LABEL[effective]}
        </span>
      </td>
    </tr>
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
  readonly tone?: 'ok' | 'warn' | undefined;
}): ReactNode {
  return (
    <div className="clubsummary__cell" title={hint}>
      <span className="clubsummary__label">{label}</span>
      <span className={`clubsummary__value tnum ${tone ? `is-${tone}` : ''}`}>{value}</span>
      <span className="clubsummary__hint">{hint}</span>
    </div>
  );
}
