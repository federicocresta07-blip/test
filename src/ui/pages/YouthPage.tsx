import { useMemo, useState, type ReactNode } from 'react';
import { estimatedPotential, MIN_PROMOTION_AGE } from '../../domain/youth.ts';
import { facilitySpec } from '../../domain/facilities.ts';
import { staffEffect, staffSpec } from '../../domain/staff.ts';
import { Panel } from '../components/ui/Panel.tsx';
import { Button } from '../components/ui/Button.tsx';
import { Badge } from '../components/ui/Badge.tsx';
import { RatingBadge } from '../components/ui/Badge.tsx';
import { Stars } from '../components/ui/Stars.tsx';
import { EmptyState } from '../components/ui/EmptyState.tsx';
import { DataTable } from '../components/ui/Table.tsx';
import { Tooltip } from '../components/ui/Tooltip.tsx';
import { InvestmentBanner } from '../components/club/InvestmentBanner.tsx';
import { PotentialRange } from '../components/youth/PotentialRange.tsx';
import { Link } from '../router/router.tsx';
import { useGame, useGameState } from '../state/GameProvider.tsx';
import { positionName } from '../lib/positions.ts';
import type { ScoutedYouth } from '../models/index.ts';

/**
 * INFERIORES (secciones 7, 8) — fase 4 del plan.
 *
 * La pantalla entera gira alrededor de una decision de diseño: el potencial de
 * un juvenil se muestra como RANGO, nunca como numero exacto.
 *
 * El club no conoce el techo de sus pibes. Conoce lo que le dice el ojeador
 * juvenil, y el ancho de ese informe sale del efecto del rol —el mismo numero
 * que muestra su ficha en Staff—. Mostrar el potencial exacto seria mas
 * cómodo, y dejaria al ojeador juvenil sin razon de existir: subirlo de nivel
 * no cambiaria nada en pantalla.
 */
export function YouthPage(): ReactNode {
  const state = useGameState();
  const { investment, promoteYouth, dismissInvestment } = useGame();
  const [selected, setSelected] = useState<string | null>(null);

  const academy = state.facilities.find((entry) => entry.id === 'academia');
  const scout = state.staff.find((member) => member.role === 'Ojeador juvenil');
  const youthCoach = state.staff.find((member) => member.role === 'Entrenador juvenil');

  const scoutEffect = useMemo(() => {
    if (!scout) return null;
    const facility = staffSpec(scout.role).facility;
    const level = state.facilities.find((entry) => entry.id === facility)?.level ?? 1;
    return staffEffect(scout.role, scout.level, level);
  }, [scout, state.facilities]);

  const coachEffect = useMemo(() => {
    if (!youthCoach) return null;
    const facility = staffSpec(youthCoach.role).facility;
    const level = state.facilities.find((entry) => entry.id === facility)?.level ?? 1;
    return staffEffect(youthCoach.role, youthCoach.level, level);
  }, [youthCoach, state.facilities]);

  const ordered = [...state.youth].sort(
    (a, b) => estimatedPotential(b.report) - estimatedPotential(a.report),
  );
  const open = ordered.find((entry) => entry.id === selected) ?? null;
  const widest = ordered.reduce((max, entry) => Math.max(max, entry.report.width), 0);

  return (
    <div className="page">
      <div className="clubsummary">
        <SummaryCell
          label="Juveniles"
          value={String(state.youth.length)}
          hint={`La academia decide cuántos suben de la pensión cada temporada`}
        />
        <SummaryCell
          label="Academia juvenil"
          value={`${academy?.level ?? 1} de 5`}
          hint={`${facilitySpec('academia').name}: define el tamaño y el techo de la camada`}
        />
        <SummaryCell
          label="Precisión del informe"
          value={scoutEffect ? `±${Math.round(scoutEffect.actual)} pts` : 'sin ojeador'}
          tone={scoutEffect ? undefined : 'warn'}
          hint={
            scoutEffect
              ? 'Margen con el que tu ojeador juvenil estima un potencial'
              : 'Sin ojeador juvenil el club estima los techos de oído'
          }
        />
        <SummaryCell
          label="Desarrollo juvenil"
          value={coachEffect ? `+${Math.round(coachEffect.actual)}%` : 'sin entrenador'}
          tone={coachEffect ? undefined : 'warn'}
          hint={
            coachEffect
              ? 'Cuánto acelera el entrenador juvenil el desarrollo de estos jugadores'
              : 'Sin entrenador juvenil, desarrollan al ritmo base'
          }
        />
        <SummaryCell
          label="Listos para subir"
          value={String(ordered.filter((entry) => entry.promotable).length)}
          hint={`Desde los ${MIN_PROMOTION_AGE} años pueden pasar al plantel profesional`}
        />
      </div>

      <InvestmentBanner investment={investment} onDismiss={dismissInvestment} />

      <Panel
        title="Plantel juvenil"
        subtitle="El potencial es un rango, no un número: es lo que tu ojeador puede ver"
        actions={
          <Link to="/club/staff">
            <Button size="sm" variant="ghost">
              Ver ojeador juvenil
            </Button>
          </Link>
        }
        padded={false}
      >
        {ordered.length === 0 ? (
          <div style={{ padding: 'var(--sp-6)' }}>
            <EmptyState
              title="No hay juveniles en el club"
              detail="La academia produce una camada por temporada. Su nivel decide cuántos suben y con qué techo."
            />
          </div>
        ) : (
          <DataTable>
            <thead>
              <tr>
                <th>Jugador</th>
                <th style={{ width: 56 }}>Pos</th>
                <th style={{ width: 44, textAlign: 'right' }}>Edad</th>
                <th style={{ width: 52, textAlign: 'right' }}>Hoy</th>
                <th style={{ width: 200 }}>Potencial estimado</th>
                <th style={{ width: 88 }}>Confianza</th>
                <th style={{ width: 110 }} />
              </tr>
            </thead>
            <tbody>
              {ordered.map((entry) => (
                <YouthRow
                  key={entry.id}
                  youth={entry}
                  busy={investment.pending}
                  onOpen={() => setSelected(entry.id === selected ? null : entry.id)}
                  onPromote={() =>
                    void promoteYouth(entry.id, `${entry.name} subió al plantel profesional`)
                  }
                />
              ))}
            </tbody>
          </DataTable>
        )}
      </Panel>

      {open && <YouthDetail youth={open} onClose={() => setSelected(null)} />}

      <Panel title="Por qué el potencial es un rango">
        <div className="clubnotes">
          <p>
            Porque el club no lo sabe. Sabe lo que le dice el ojeador, y su informe tiene un margen
            de error: hoy es de{' '}
            <strong>±{scoutEffect ? Math.round(scoutEffect.actual) : 22} puntos</strong>
            {scoutEffect ? '' : ' porque el puesto está vacante'}. Un rango de {widest} puntos como
            el más ancho de esta camada significa que el número del medio no sirve para decidir:
            firmarlo es una apuesta.
          </p>
          <p>
            Mejorar al ojeador juvenil angosta el rango sin cambiar nada del jugador — el techo real
            es el mismo, lo que cambia es cuánto lo ves. Mejorar la{' '}
            <Link to="/club/instalaciones">academia</Link> hace otra cosa distinta: cambia la camada
            entera, porque de ahí salen más chicos y con techos más altos.
          </p>
          <p>
            El potencial es el techo del <em>overall</em>, y llegar cuesta: hace falta que el pibe
            juegue. Un juvenil que entrena con el plantel y no debuta desarrolla cerca de la mitad
            de rápido que uno que suma minutos, y eso convierte la decisión de darle la camiseta en
            una decisión real.
          </p>
        </div>
      </Panel>
    </div>
  );
}

function YouthRow({
  youth,
  busy,
  onOpen,
  onPromote,
}: {
  readonly youth: ScoutedYouth;
  readonly busy: boolean;
  readonly onOpen: () => void;
  readonly onPromote: () => void;
}): ReactNode {
  return (
    <tr>
      <td>
        <button className="youthname" onClick={onOpen}>
          {youth.name}
        </button>
      </td>
      <td className="secondary" title={positionName(youth.position)}>
        {youth.position}
      </td>
      <td className="tnum" style={{ textAlign: 'right' }}>
        {youth.age}
      </td>
      <td style={{ textAlign: 'right' }}>
        <RatingBadge value={youth.overall} size="sm" title="Su nivel de hoy, que sí se conoce" />
      </td>
      <td>
        <PotentialRange report={youth.report} current={youth.overall} />
      </td>
      <td>
        <Badge tone={confidenceTone(youth.report.width)}>{youth.report.confidence}</Badge>
      </td>
      <td>
        {youth.promotable ? (
          <Button size="sm" variant="primary" onClick={onPromote} disabled={busy}>
            Subir al plantel
          </Button>
        ) : (
          <Tooltip content={`Puede subir a partir de los ${MIN_PROMOTION_AGE} años`} side="left">
            <span className="muted">muy chico</span>
          </Tooltip>
        )}
      </td>
    </tr>
  );
}

function confidenceTone(width: number): 'ok' | 'warn' | 'danger' | 'neutral' {
  if (width <= 8) return 'ok';
  if (width <= 19) return 'neutral';
  if (width <= 26) return 'warn';
  return 'danger';
}

function YouthDetail({
  youth,
  onClose,
}: {
  readonly youth: ScoutedYouth;
  readonly onClose: () => void;
}): ReactNode {
  return (
    <Panel
      title={youth.name}
      subtitle={`${positionName(youth.position)} · ${youth.age} años · ${youth.origin}`}
      actions={
        <Button size="sm" variant="ghost" onClick={onClose}>
          Cerrar
        </Button>
      }
    >
      <div className="youthdetail">
        <div className="youthdetail__figures">
          <div className="youthdetail__figure">
            <span className="label">Nivel de hoy</span>
            <RatingBadge value={youth.overall} size="lg" />
          </div>
          <div className="youthdetail__figure">
            <span className="label">En el club</span>
            <span className="youthdetail__value">
              {youth.yearsAtClub === 0 ? 'recién llegado' : `${youth.yearsAtClub} años`}
            </span>
          </div>
          <div className="youthdetail__figure">
            <span className="label">Confianza del informe</span>
            <Stars value={confidenceStars(youth.report.width)} />
          </div>
        </div>

        <div className="youthdetail__report">
          <PotentialRange report={youth.report} current={youth.overall} size="lg" />
          <p className="youthdetail__summary">{youth.report.summary}</p>
        </div>
      </div>
    </Panel>
  );
}

/** El ancho del informe, en estrellas, para leerlo de un vistazo. */
function confidenceStars(width: number): number {
  if (width <= 8) return 5;
  if (width <= 13) return 4;
  if (width <= 19) return 3;
  if (width <= 26) return 2;
  return 1;
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
