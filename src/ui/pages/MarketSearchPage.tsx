import { useMemo, useState, type ReactNode } from 'react';
import { POSITIONS } from '../../domain/positions.ts';
import type { Position } from '../../domain/positions.ts';
import { Panel } from '../components/ui/Panel.tsx';
import { Button } from '../components/ui/Button.tsx';
import { Badge } from '../components/ui/Badge.tsx';
import { EmptyState } from '../components/ui/EmptyState.tsx';
import { DataTable } from '../components/ui/Table.tsx';
import { ClubBadge } from '../components/ClubBadge.tsx';
import {
  ReportedOverall,
  ReportedPotential,
  ReportedValue,
} from '../components/market/PlayerReport.tsx';
import { OfferDialog } from '../components/market/OfferDialog.tsx';
import { Link } from '../router/router.tsx';
import { useGame, useGameState } from '../state/GameProvider.tsx';
import { clubById } from '../data/clubs.ts';
import { LEAGUE_CLUBS } from '../data/league.ts';
import {
  applyFilters,
  EMPTY_FILTERS,
  marketPool,
  marketPrecision,
  sortPool,
  type MarketFilters,
  type MarketPlayer,
  type MarketSort,
} from '../lib/market-bridge.ts';
import { moneyShort } from '../lib/format.ts';
import { positionName } from '../lib/positions.ts';

/**
 * BUSCAR JUGADORES (secciones 10, 11) — fase 5 del plan.
 *
 * La decision que gobierna la pantalla: de un jugador ajeno NO se muestra el
 * overall exacto. Se muestra el informe del ojeador, y su margen sale del
 * efecto del rol. Sin eso, el ojeador y el secretario tecnico no tendrian
 * para que existir.
 *
 * Ojo con el filtro de nivel: trabaja sobre el overall INFORMADO. Con un
 * ojeador flojo, pedir "80 o mas" puede dejar afuera a un jugador de 82 que el
 * informe estimo en 76 — y eso es correcto, porque el club no lo sabe.
 */
export function MarketSearchPage(): ReactNode {
  const state = useGameState();
  const { market, sendOffer, clearMarket } = useGame();
  const [filters, setFilters] = useState<MarketFilters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<MarketSort>('overall');
  const [target, setTarget] = useState<MarketPlayer | null>(null);

  const pool = useMemo(() => {
    const precision = marketPrecision(state.staff, state.facilities);
    return marketPool({
      precision,
      transferredIds: state.market.transfers.map((entry) => entry.playerId),
      listedIds: state.market.listedElsewhere,
      // Los planteles rivales envejecen (fase 8): sin esto el mercado
      // ofreceria el Boca de 1998 en la temporada cinco.
      seasonsClosed: state.season.seasonsClosed,
    });
  }, [
    state.staff,
    state.facilities,
    state.market.transfers,
    state.market.listedElsewhere,
    state.season.seasonsClosed,
  ]);

  const results = useMemo(() => sortPool(applyFilters(pool, filters), sort), [pool, filters, sort]);
  const shown = results.slice(0, 60);

  const patch = (next: Partial<MarketFilters>): void => setFilters({ ...filters, ...next });
  const togglePosition = (position: Position): void =>
    patch({
      positions: filters.positions.includes(position)
        ? filters.positions.filter((entry) => entry !== position)
        : [...filters.positions, position],
    });

  return (
    <div className="page">
      <div className="clubsummary">
        <SummaryCell
          label="Caja disponible"
          value={moneyShort(state.finances.cash)}
          hint="La misma caja que paga las mejoras del staff y las obras"
        />
        <SummaryCell
          label="Jugadores en el mercado"
          value={String(pool.length)}
          hint="Todos los jugadores de los otros diecinueve clubes"
        />
        <SummaryCell
          label="Precisión del ojeador"
          value={state.market.hasScout ? `±${state.market.scoutMargin.toFixed(0)} pts` : 'sin ojeador'}
          tone={state.market.hasScout ? undefined : 'warn'}
          hint="Margen con el que estimás el nivel de un jugador ajeno"
        />
        <SummaryCell
          label="Precisión de la tasación"
          value={state.market.hasValuer ? `±${state.market.valuerError.toFixed(0)}%` : 'sin secretario'}
          tone={state.market.hasValuer ? undefined : 'warn'}
          hint="Error con el que estimás el valor de mercado"
        />
      </div>

      {market.error && (
        <div className="investbanner investbanner--error" role="alert">
          <span className="investbanner__text">{market.error}</span>
          <Button size="sm" variant="ghost" onClick={clearMarket}>
            Entendido
          </Button>
        </div>
      )}

      <Panel
        title="Buscador"
        subtitle={`${results.length} jugadores cumplen los filtros${results.length > shown.length ? ` · se muestran los primeros ${shown.length}` : ''}`}
        actions={
          <Button size="sm" variant="ghost" onClick={() => setFilters(EMPTY_FILTERS)}>
            Limpiar filtros
          </Button>
        }
      >
        <div className="msearch">
          <label className="msearch__field">
            <span>Nombre</span>
            <input
              className="msearch__input"
              type="search"
              value={filters.name}
              placeholder="Buscar por nombre"
              onChange={(event) => patch({ name: event.target.value })}
            />
          </label>

          <label className="msearch__field">
            <span>Club</span>
            <select
              className="msearch__input"
              value={filters.clubId ?? ''}
              onChange={(event) => patch({ clubId: event.target.value || null })}
            >
              <option value="">Todos</option>
              {LEAGUE_CLUBS.filter((club) => club.id !== state.club.id).map((club) => (
                <option key={club.id} value={club.id}>
                  {club.name}
                </option>
              ))}
            </select>
          </label>

          <label className="msearch__field">
            <span>Edad máxima</span>
            <input
              className="msearch__input tnum"
              type="number"
              min={15}
              max={40}
              value={filters.maxAge ?? ''}
              placeholder="sin límite"
              onChange={(event) =>
                patch({ maxAge: event.target.value ? Number(event.target.value) : null })
              }
            />
          </label>

          <label className="msearch__field">
            <span>Nivel mínimo estimado</span>
            <input
              className="msearch__input tnum"
              type="number"
              min={1}
              max={99}
              value={filters.minOverall ?? ''}
              placeholder="sin límite"
              onChange={(event) =>
                patch({ minOverall: event.target.value ? Number(event.target.value) : null })
              }
            />
          </label>

          <label className="msearch__field">
            <span>Valor máximo (millones)</span>
            <input
              className="msearch__input tnum"
              type="number"
              min={0}
              step={5}
              value={filters.maxValue !== null ? filters.maxValue / 1_000_000 : ''}
              placeholder="sin límite"
              onChange={(event) =>
                patch({
                  maxValue: event.target.value ? Number(event.target.value) * 1_000_000 : null,
                })
              }
            />
          </label>

          <label className="msearch__field">
            <span>Ordenar por</span>
            <select
              className="msearch__input"
              value={sort}
              onChange={(event) => setSort(event.target.value as MarketSort)}
            >
              <option value="overall">Nivel estimado</option>
              <option value="valor">Valor</option>
              <option value="edad">Edad</option>
              <option value="nombre">Nombre</option>
            </select>
          </label>
        </div>

        <div className="msearch__positions">
          <span className="msearch__poslabel">Puestos</span>
          {POSITIONS.map((position) => (
            <button
              key={position}
              className={`msearch__pos ${filters.positions.includes(position) ? 'is-active' : ''}`}
              onClick={() => togglePosition(position)}
              title={positionName(position)}
            >
              {position}
            </button>
          ))}
          <label className="msearch__check">
            <input
              type="checkbox"
              checked={filters.onlyListed}
              onChange={(event) => patch({ onlyListed: event.target.checked })}
            />
            Solo transferibles
          </label>
        </div>
      </Panel>

      <Panel title="Resultados" padded={false}>
        {shown.length === 0 ? (
          <div style={{ padding: 'var(--sp-6)' }}>
            <EmptyState
              title="Ningún jugador cumple esos filtros"
              detail="Probá aflojar el nivel mínimo o el valor máximo. Acordate de que el nivel que filtrás es el estimado por tu ojeador, no el real."
            />
          </div>
        ) : (
          <DataTable>
            <thead>
              <tr>
                <th>Jugador</th>
                <th style={{ width: 130 }}>Club</th>
                <th style={{ width: 52 }}>Pos</th>
                <th style={{ width: 44, textAlign: 'right' }}>Edad</th>
                <th style={{ width: 76, textAlign: 'right' }}>Nivel est.</th>
                <th style={{ width: 78, textAlign: 'right' }}>Techo est.</th>
                <th style={{ width: 104, textAlign: 'right' }}>Valor tasado</th>
                <th style={{ width: 92 }} />
              </tr>
            </thead>
            <tbody>
              {shown.map((entry) => (
                <tr key={entry.id}>
                  <td className="truncate">
                    {entry.name}
                    {entry.listed && (
                      <>
                        {' '}
                        <Badge tone="ok" title="Su club lo puso en el mercado">
                          transferible
                        </Badge>
                      </>
                    )}
                  </td>
                  <td>
                    <span className="tablerow__club">
                      <ClubBadge club={clubById(entry.clubId)} size={18} />
                      <Link to={`/informacion/rivales/${entry.clubId}`} className="truncate secondary">
                        {clubById(entry.clubId).shortName}
                      </Link>
                    </span>
                  </td>
                  <td className="secondary" title={positionName(entry.position)}>
                    {entry.position}
                  </td>
                  <td className="tnum" style={{ textAlign: 'right' }}>
                    {entry.age}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <ReportedOverall appraisal={entry.appraisal} size="sm" />
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <ReportedPotential appraisal={entry.appraisal} />
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <ReportedValue appraisal={entry.appraisal} />
                  </td>
                  <td>
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => {
                        clearMarket();
                        setTarget(entry);
                      }}
                    >
                      Ofertar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </Panel>

      {state.market.hasScout && state.market.hasValuer ? (
        <Panel title="Qué significan estos números">
          <div className="clubnotes">
            <p>
              De tu propio plantel sabés todo: te entrenás con ellos. De un jugador de otro club
              sabés lo que te dice tu ojeador, y eso tiene un margen: hoy{' '}
              <strong>±{state.market.scoutMargin.toFixed(0)} puntos</strong> de nivel y{' '}
              <strong>±{state.market.valuerError.toFixed(0)}%</strong> de valor. El nivel real
              siempre cae dentro del rango, pero no en el centro: con un margen ancho, el número
              del medio no sirve para decidir solo.
            </p>
            <p>
              El techo se estima con el doble de margen que el nivel. Ver jugar a alguien dice
              cuánto rinde hoy; adivinar hasta dónde puede llegar es mucho más difícil.
            </p>
          </div>
        </Panel>
      ) : (
        <Panel
          title="Estás mirando el mercado a ciegas"
          actions={
            <Link to="/club/staff">
              <Button size="sm" variant="primary">
                Ver cuerpo técnico
              </Button>
            </Link>
          }
        >
          <ul className="scoutmissing">
            {!state.market.hasScout && (
              <li>
                Sin <strong>ojeador</strong>, el nivel de un jugador ajeno se estima con ±14 puntos
                de error: podés pagar por un 80 y recibir un 68.
              </li>
            )}
            {!state.market.hasValuer && (
              <li>
                Sin <strong>secretario técnico</strong>, su valor se estima con un 30% de error, así
                que no sabés si estás pagando de más.
              </li>
            )}
          </ul>
        </Panel>
      )}

      {target && (
        <OfferDialog
          target={target}
          cash={state.finances.cash}
          pending={market.pending}
          outcome={market.outcome}
          onSend={(amount) => void sendOffer(target.id, amount)}
          onClose={() => {
            setTarget(null);
            clearMarket();
          }}
        />
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
