import { useMemo, type ReactNode } from 'react';
import { Panel } from '../components/ui/Panel.tsx';
import { Button } from '../components/ui/Button.tsx';
import { Badge } from '../components/ui/Badge.tsx';
import { EmptyState } from '../components/ui/EmptyState.tsx';
import { DataTable } from '../components/ui/Table.tsx';
import { ClubBadge } from '../components/ClubBadge.tsx';
import { Link } from '../router/router.tsx';
import { useGameState } from '../state/GameProvider.tsx';
import { clubById } from '../data/clubs.ts';
import { money, moneyShort } from '../lib/format.ts';

/**
 * HISTORIAL DE TRANSFERENCIAS (seccion 11) — fase 5 del plan.
 *
 * Todas las operaciones cerradas del torneo. Hoy son solo las del club del
 * manager, y la pantalla lo dice: los clubes de IA no fichan entre ellos
 * todavia. Es una limitacion real y preferimos declararla antes que llenar la
 * tabla de movimientos inventados.
 */
export function TransferHistoryPage(): ReactNode {
  const state = useGameState();

  const transfers = useMemo(
    () => [...state.market.transfers].sort((a, b) => b.round - a.round || b.amount - a.amount),
    [state.market.transfers],
  );

  const spent = transfers
    .filter((entry) => entry.toClubId === state.club.id)
    .reduce((total, entry) => total + entry.amount, 0);
  const earned = transfers
    .filter((entry) => entry.fromClubId === state.club.id)
    .reduce((total, entry) => total + entry.amount, 0);

  if (transfers.length === 0) {
    return (
      <div className="page page--narrow">
        <Panel title="Historial de transferencias">
          <EmptyState
            title="Todavía no se cerró ninguna operación"
            detail="Acá van a estar todas las compras y ventas del torneo, con el club, el monto y la fecha en la que se cerraron."
            action={
              <Link to="/mercado/buscar">
                <Button variant="primary">Ir al buscador</Button>
              </Link>
            }
          />
        </Panel>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="clubsummary">
        <SummaryCell
          label="Operaciones"
          value={String(transfers.length)}
          hint="Compras y ventas cerradas en el torneo"
        />
        <SummaryCell
          label="Gastado en fichajes"
          value={moneyShort(spent)}
          hint="Salió de la misma caja que las mejoras del club"
        />
        <SummaryCell
          label="Ingresado por ventas"
          value={moneyShort(earned)}
          hint="Volvió a la caja del club"
        />
        <SummaryCell
          label="Balance"
          value={`${earned - spent >= 0 ? '+' : ''}${moneyShort(earned - spent)}`}
          tone={earned - spent >= 0 ? 'ok' : 'warn'}
          hint="Ventas menos compras"
        />
      </div>

      <Panel title="Operaciones cerradas" padded={false}>
        <DataTable>
          <thead>
            <tr>
              <th>Jugador</th>
              <th style={{ width: 150 }}>Desde</th>
              <th style={{ width: 150 }}>Hacia</th>
              <th style={{ width: 110, textAlign: 'right' }}>Monto</th>
              <th style={{ width: 70 }}>Fecha</th>
              <th style={{ width: 90 }} />
            </tr>
          </thead>
          <tbody>
            {transfers.map((entry) => {
              const incoming = entry.toClubId === state.club.id;
              return (
                <tr key={`${entry.playerId}-${entry.round}`}>
                  <td className="truncate">{entry.playerName}</td>
                  <td>
                    <span className="tablerow__club">
                      <ClubBadge club={clubById(entry.fromClubId)} size={18} />
                      <span className="truncate secondary">
                        {clubById(entry.fromClubId).shortName}
                      </span>
                    </span>
                  </td>
                  <td>
                    <span className="tablerow__club">
                      <ClubBadge club={clubById(entry.toClubId)} size={18} />
                      <span className="truncate secondary">
                        {clubById(entry.toClubId).shortName}
                      </span>
                    </span>
                  </td>
                  <td className="tnum" style={{ textAlign: 'right' }} title={money(entry.amount)}>
                    {moneyShort(entry.amount)}
                  </td>
                  <td className="tnum secondary">{entry.round}</td>
                  <td>
                    <Badge tone={incoming ? 'accent' : 'neutral'}>
                      {incoming ? 'compra' : 'venta'}
                    </Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </DataTable>
      </Panel>

      <Panel title="Qué falta en este historial">
        <div className="clubnotes">
          <p>
            Solo están las operaciones de tu club. Los otros diecinueve clubes todavía no fichan
            entre ellos: sus planteles solo cambian cuando vos les compras o les vendés. Preferimos
            decirlo antes que llenar la tabla de movimientos inventados que no afectan a nada.
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
