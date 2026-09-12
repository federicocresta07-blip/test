import { useMemo, useState, type ReactNode } from 'react';
import { isAvailable } from '../../domain/player.ts';
import { Panel } from '../components/ui/Panel.tsx';
import { Button } from '../components/ui/Button.tsx';
import { SquadTable } from '../components/squad/SquadTable.tsx';
import { PlayerQuickPanel } from '../components/player/PlayerQuickPanel.tsx';
import { Link } from '../router/router.tsx';
import { useGameState } from '../state/GameProvider.tsx';
import { naturalOverall } from '../lib/engine-bridge.ts';
import { moneyShort } from '../lib/format.ts';
import type { SquadRole } from '../components/player/PlayerCells.tsx';

/**
 * PLANTEL (seccion 6.2) — fase 2 del plan.
 *
 * La vista completa del plantel: la misma tabla que usa la alineacion, con
 * las columnas de gestion (valor, salario, contrato) y la ficha rapida.
 */
export function SquadPage(): ReactNode {
  const state = useGameState();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const roleOf = (playerId: string): SquadRole => {
    if (state.lineup.starters.includes(playerId)) return 'titular';
    if (state.lineup.bench.includes(playerId)) return 'suplente';
    return 'no-convocado';
  };

  const summary = useMemo(() => {
    const available = state.squad.filter((entry) => isAvailable(entry.player));
    const overalls = available.map((entry) => naturalOverall(entry.player)).sort((a, b) => b - a);
    const topEleven = overalls.slice(0, 11);
    return {
      total: state.squad.length,
      available: available.length,
      unavailable: state.squad.length - available.length,
      averageAge:
        state.squad.reduce((total, entry) => total + entry.player.age, 0) / Math.max(1, state.squad.length),
      bestEleven: topEleven.reduce((a, b) => a + b, 0) / Math.max(1, topEleven.length),
      wageBill: state.squad.reduce((total, entry) => total + entry.salary, 0),
      value: state.squad.reduce((total, entry) => total + entry.value, 0),
    };
  }, [state.squad]);

  const selected = state.squad.find((entry) => entry.player.id === selectedId) ?? null;

  return (
    <div className="page">
      <div className="squadsummary">
        <SummaryCell label="Jugadores" value={String(summary.total)} hint={`${summary.available} disponibles`} />
        <SummaryCell label="No disponibles" value={String(summary.unavailable)} hint="Lesionados y sancionados" />
        <SummaryCell label="Edad media" value={summary.averageAge.toFixed(1).replace('.', ',')} hint="Del plantel completo" />
        <SummaryCell
          label="Mejores once"
          value={summary.bestEleven.toFixed(1).replace('.', ',')}
          hint="Promedio de overall de los once mejores disponibles"
        />
        <SummaryCell label="Masa salarial" value={`${moneyShort(summary.wageBill)}/mes`} hint="Suma de salarios" />
        <SummaryCell label="Valor del plantel" value={moneyShort(summary.value)} hint="Suma de valores de mercado" />
      </div>

      <Panel
        title="Plantel profesional"
        subtitle="Doble clic en un jugador para abrir su ficha"
        actions={
          <Link to="/equipo/alineacion">
            <Button size="sm" variant="primary">
              Ir a la alineación
            </Button>
          </Link>
        }
        padded={false}
      >
        <SquadTable
          entries={state.squad}
          columns={['pos', 'name', 'age', 'ovr', 'form', 'energy', 'role', 'value', 'salary', 'contract', 'status']}
          roleOf={roleOf}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onActivate={setSelectedId}
        />
      </Panel>

      <PlayerQuickPanel entry={selected} onClose={() => setSelectedId(null)} />
    </div>
  );
}

function SummaryCell({
  label,
  value,
  hint,
}: {
  readonly label: string;
  readonly value: string;
  readonly hint: string;
}): ReactNode {
  return (
    <div className="squadsummary__cell" title={hint}>
      <span className="label">{label}</span>
      <span className="squadsummary__value tnum">{value}</span>
      <span className="squadsummary__hint truncate">{hint}</span>
    </div>
  );
}
