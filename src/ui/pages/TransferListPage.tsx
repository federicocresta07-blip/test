import { useMemo, useState, type ReactNode } from 'react';
import { squadNeed } from '../../domain/market.ts';
import { Panel } from '../components/ui/Panel.tsx';
import { Button } from '../components/ui/Button.tsx';
import { Badge } from '../components/ui/Badge.tsx';
import { EmptyState } from '../components/ui/EmptyState.tsx';
import { DataTable } from '../components/ui/Table.tsx';
import { RatingBadge } from '../components/ui/Badge.tsx';
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
import {
  marketPool,
  marketPrecision,
  transferListed,
  type MarketPlayer,
} from '../lib/market-bridge.ts';
import { naturalOverall } from '../lib/engine-bridge.ts';
import { moneyShort } from '../lib/format.ts';
import { positionName } from '../lib/positions.ts';

/**
 * TRANSFERIBLES (seccion 11) — fase 5 del plan.
 *
 * Dos listas: los que los otros clubes publicaron y los que el manager pone en
 * el mercado.
 *
 * La lista de los rivales no esta escrita en ningun lado: la calcula
 * `autoTransferList` a partir de cuanto extranaria cada club a cada jugador.
 * Eso la mantiene coherente con sus planteles, y hace que cambie cuando los
 * planteles cambian.
 */
export function TransferListPage(): ReactNode {
  const state = useGameState();
  const { market, sendOffer, setTransferListed, clearMarket } = useGame();
  const [target, setTarget] = useState<MarketPlayer | null>(null);

  const listed = useMemo(() => {
    const precision = marketPrecision(state.staff, state.facilities);
    const pool = marketPool({
      precision,
      transferredIds: state.market.transfers.map((entry) => entry.playerId),
      listedIds: state.market.listedElsewhere,
    });
    return transferListed(pool).slice().sort((a, b) => b.appraisal.overall - a.appraisal.overall);
  }, [state.staff, state.facilities, state.market.transfers, state.market.listedElsewhere]);

  const own = state.squad.map((entry) => ({
    entry,
    listed: state.market.listed.includes(entry.player.id),
    need: squadNeed(
      entry.player,
      state.squad.map((other) => other.player),
    ),
  }));
  const ownListed = own.filter((row) => row.listed);

  return (
    <div className="page">
      {market.error && (
        <div className="investbanner investbanner--error" role="alert">
          <span className="investbanner__text">{market.error}</span>
          <Button size="sm" variant="ghost" onClick={clearMarket}>
            Entendido
          </Button>
        </div>
      )}

      <Panel
        title="Publicados por otros clubes"
        subtitle={`${listed.length} jugadores. La lista sale de cuánto los extrañaría su club, no de un dato cargado`}
        actions={
          <Link to="/mercado/buscar">
            <Button size="sm" variant="ghost">
              Buscador completo
            </Button>
          </Link>
        }
        padded={false}
      >
        {listed.length === 0 ? (
          <div style={{ padding: 'var(--sp-6)' }}>
            <EmptyState title="Ningún club tiene jugadores publicados ahora mismo" />
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
              {listed.map((entry) => (
                <tr key={entry.id}>
                  <td className="truncate">{entry.name}</td>
                  <td>
                    <span className="tablerow__club">
                      <ClubBadge club={clubById(entry.clubId)} size={18} />
                      <span className="truncate secondary">{clubById(entry.clubId).shortName}</span>
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

      <Panel
        title="Tu lista de transferibles"
        subtitle={
          ownListed.length === 0
            ? 'No pusiste a nadie en el mercado'
            : `${ownListed.length} ${ownListed.length === 1 ? 'jugador publicado' : 'jugadores publicados'}: los clubes van a ofertar más por ellos`
        }
        padded={false}
      >
        <DataTable>
          <thead>
            <tr>
              <th>Jugador</th>
              <th style={{ width: 52 }}>Pos</th>
              <th style={{ width: 44, textAlign: 'right' }}>Edad</th>
              <th style={{ width: 52, textAlign: 'right' }}>Nivel</th>
              <th style={{ width: 104, textAlign: 'right' }}>Valor</th>
              <th style={{ width: 160 }}>Cuánto lo necesitás</th>
              <th style={{ width: 120 }} />
            </tr>
          </thead>
          <tbody>
            {own.map((row) => (
              <tr key={row.entry.player.id} className={row.listed ? 'is-own' : ''}>
                <td className="truncate">
                  {row.entry.player.name}
                  {row.listed && (
                    <>
                      {' '}
                      <Badge tone="warn">en el mercado</Badge>
                    </>
                  )}
                </td>
                <td className="secondary">{row.entry.player.position}</td>
                <td className="tnum" style={{ textAlign: 'right' }}>
                  {row.entry.player.age}
                </td>
                <td style={{ textAlign: 'right' }}>
                  <RatingBadge value={naturalOverall(row.entry.player)} size="sm" />
                </td>
                <td className="tnum" style={{ textAlign: 'right' }}>
                  {moneyShort(row.entry.value)}
                </td>
                <td>
                  <span className="needbar" title={needHint(row.need)}>
                    <span className="needbar__track">
                      <span className="needbar__fill" style={{ width: `${row.need * 100}%` }} />
                    </span>
                    <span className="needbar__label">{needLabel(row.need)}</span>
                  </span>
                </td>
                <td>
                  <Button
                    size="sm"
                    variant={row.listed ? 'ghost' : 'ghost'}
                    onClick={() => void setTransferListed(row.entry.player.id, !row.listed)}
                  >
                    {row.listed ? 'Sacar del mercado' : 'Poner en el mercado'}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </Panel>

      <Panel title="Cómo funciona la lista">
        <div className="clubnotes">
          <p>
            Lo que publican los otros clubes no está cargado a mano: sale de{' '}
            <strong>cuánto extrañarían a cada jugador</strong>, que es la caída de nivel hasta su
            reemplazo. Un 9 con un suplente de 83 es prescindible; el mismo 9 con un suplente de 68
            es insustituible, aunque en los dos casos sea el mejor de su puesto. Cada club publica
            hasta tres, y prefiere publicar al mejor de los que le sobran: es el que alguien le va a
            comprar.
          </p>
          <p>
            Con tus jugadores pasa lo mismo al revés. Poner a alguien en el mercado hace que los
            clubes ofrezcan más por él —saben que se vende—, y la columna de necesidad te dice
            cuánto te costaría perderlo.
          </p>
        </div>
      </Panel>

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

function needLabel(need: number): string {
  if (need >= 0.85) return 'insustituible';
  if (need >= 0.6) return 'importante';
  if (need >= 0.35) return 'reemplazable';
  return 'prescindible';
}

function needHint(need: number): string {
  return `${Math.round(need * 100)}% — sale de la caída de nivel hasta su reemplazo en el plantel`;
}
