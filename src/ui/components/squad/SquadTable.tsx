import { useMemo, useState, type ReactNode } from 'react';
import { isAvailable } from '../../../domain/player.ts';
import type { ClubPlayer } from '../../models/index.ts';
import { positionGroup, positionSortIndex } from '../../lib/positions.ts';
import { energyOf, ratingColor } from '../../lib/ratings.ts';
import { naturalOverall } from '../../lib/engine-bridge.ts';
import { contractYear, moneyShort } from '../../lib/format.ts';
import { DataTable, SortableTh, type SortDirection } from '../ui/Table.tsx';
import { RatingBadge } from '../ui/Badge.tsx';
import { Tabs } from '../ui/Tabs.tsx';
import { EmptyState } from '../ui/EmptyState.tsx';
import {
  EnergyCell,
  FormCell,
  PlayerName,
  PositionTag,
  RoleTag,
  StatusCell,
  type SquadRole,
} from '../player/PlayerCells.tsx';
import type { PositionGroup } from '../../models/index.ts';

export type SquadColumn =
  | 'pos'
  | 'name'
  | 'age'
  | 'ovr'
  | 'form'
  | 'energy'
  | 'status'
  | 'role'
  | 'value'
  | 'salary'
  | 'contract';

const FILTERS: readonly { id: PositionGroup | 'TODOS'; label: string }[] = [
  { id: 'TODOS', label: 'Todos' },
  { id: 'POR', label: 'POR' },
  { id: 'DEF', label: 'DEF' },
  { id: 'MED', label: 'MED' },
  { id: 'ATA', label: 'ATA' },
];

/**
 * TABLA DE PLANTEL (seccion 6.2).
 *
 * Lista compacta, escaneable y ordenable por posicion, overall, forma,
 * condicion y edad, con filtros rapidos por grupo de posicion. La usan tanto
 * la pantalla de Plantel como la de Alineacion.
 */
export function SquadTable({
  entries,
  columns,
  roleOf,
  selectedId,
  onSelect,
  onActivate,
  draggable = false,
  onDragStartPlayer,
  onDragEnd,
  dimUnavailable = true,
  emptyMessage = 'No hay jugadores que coincidan con el filtro',
  compact = false,
}: {
  readonly entries: readonly ClubPlayer[];
  readonly columns: readonly SquadColumn[];
  readonly roleOf?: (playerId: string) => SquadRole;
  readonly selectedId?: string | null;
  readonly onSelect?: (playerId: string) => void;
  /** Doble clic o Enter: la accion principal de la fila. */
  readonly onActivate?: (playerId: string) => void;
  readonly draggable?: boolean;
  readonly onDragStartPlayer?: (playerId: string) => void;
  readonly onDragEnd?: () => void;
  readonly dimUnavailable?: boolean;
  readonly emptyMessage?: string;
  /** Variante angosta: etiquetas de rol abreviadas para que entre todo. */
  readonly compact?: boolean;
}): ReactNode {
  const [filter, setFilter] = useState<PositionGroup | 'TODOS'>('TODOS');
  const [sortColumn, setSortColumn] = useState<SquadColumn>('pos');
  const [direction, setDirection] = useState<SortDirection>('asc');

  const counts = useMemo(() => {
    const map = new Map<PositionGroup | 'TODOS', number>([['TODOS', entries.length]]);
    for (const entry of entries) {
      const group = positionGroup(entry.player.position);
      map.set(group, (map.get(group) ?? 0) + 1);
    }
    return map;
  }, [entries]);

  const rows = useMemo(() => {
    const filtered =
      filter === 'TODOS'
        ? entries
        : entries.filter((entry) => positionGroup(entry.player.position) === filter);

    const value = (entry: ClubPlayer): number | string => {
      switch (sortColumn) {
        case 'pos':
          return positionSortIndex(entry.player.position);
        case 'name':
          return entry.player.name;
        case 'age':
          return entry.player.age;
        case 'ovr':
          return naturalOverall(entry.player);
        case 'form':
          return entry.player.condition.form;
        case 'energy':
          return energyOf(entry.player);
        case 'value':
          return entry.value;
        case 'salary':
          return entry.salary;
        case 'contract':
          return entry.contractUntil;
        case 'role':
          return roleOf ? ['titular', 'suplente', 'no-convocado'].indexOf(roleOf(entry.player.id)) : 0;
        case 'status':
          return isAvailable(entry.player) ? 1 : 0;
      }
    };

    return [...filtered].sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      const comparison =
        typeof va === 'string' || typeof vb === 'string'
          ? String(va).localeCompare(String(vb))
          : va - vb;
      // El desempate siempre es el orden futbolistico, para que la lista no salte.
      const tie = positionSortIndex(a.player.position) - positionSortIndex(b.player.position);
      return (direction === 'asc' ? comparison : -comparison) || tie;
    });
  }, [entries, filter, sortColumn, direction, roleOf]);

  const onSort = (columnId: string): void => {
    const column = columnId as SquadColumn;
    if (column === sortColumn) {
      setDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortColumn(column);
    // Los ratings se leen mejor de mayor a menor; el resto, ascendente.
    setDirection(['ovr', 'form', 'energy', 'value', 'salary'].includes(column) ? 'desc' : 'asc');
  };

  const has = (column: SquadColumn): boolean => columns.includes(column);

  return (
    <div className="squadtable">
      <div className="squadtable__filters">
        <Tabs
          size="sm"
          items={FILTERS.map((item) => ({
            id: item.id,
            label: item.label,
            count: counts.get(item.id) ?? 0,
          }))}
          active={filter}
          onChange={setFilter}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState title={emptyMessage} />
      ) : (
        <DataTable className="squadtable__table">
          <thead>
            <tr>
              {has('pos') && (
                <SortableTh label="Pos" columnId="pos" activeColumn={sortColumn} direction={direction} onSort={onSort} width={46} />
              )}
              {has('name') && (
                <SortableTh label="Jugador" columnId="name" activeColumn={sortColumn} direction={direction} onSort={onSort} />
              )}
              {has('age') && (
                <SortableTh label="Ed" columnId="age" activeColumn={sortColumn} direction={direction} onSort={onSort} align="right" width={34} title="Edad" />
              )}
              {has('ovr') && (
                <SortableTh label="Ovr" columnId="ovr" activeColumn={sortColumn} direction={direction} onSort={onSort} align="center" width={44} title="Overall en su posición natural" />
              )}
              {has('form') && (
                <SortableTh label="Forma" columnId="form" activeColumn={sortColumn} direction={direction} onSort={onSort} width={compact ? 70 : 92} />
              )}
              {has('energy') && (
                <SortableTh label="Energía" columnId="energy" activeColumn={sortColumn} direction={direction} onSort={onSort} width={62} />
              )}
              {has('role') && (
                <SortableTh label="Rol" columnId="role" activeColumn={sortColumn} direction={direction} onSort={onSort} width={compact ? 44 : 68} />
              )}
              {has('value') && (
                <SortableTh label="Valor" columnId="value" activeColumn={sortColumn} direction={direction} onSort={onSort} align="right" width={72} />
              )}
              {has('salary') && (
                <SortableTh label="Salario" columnId="salary" activeColumn={sortColumn} direction={direction} onSort={onSort} align="right" width={76} />
              )}
              {has('contract') && (
                <SortableTh label="Contr." columnId="contract" activeColumn={sortColumn} direction={direction} onSort={onSort} align="right" width={52} title="Fin de contrato" />
              )}
              {has('status') && (
                <SortableTh label="Estado" columnId="status" activeColumn={sortColumn} direction={direction} onSort={onSort} width={74} />
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((entry) => {
              const unavailable = dimUnavailable && !isAvailable(entry.player);
              const overall = naturalOverall(entry.player);
              return (
                <tr
                  key={entry.player.id}
                  className={[
                    onSelect ? 'is-clickable' : '',
                    selectedId === entry.player.id ? 'is-selected' : '',
                    unavailable ? 'is-unavailable' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => onSelect?.(entry.player.id)}
                  onDoubleClick={() => onActivate?.(entry.player.id)}
                  draggable={draggable && isAvailable(entry.player)}
                  onDragStart={(event) => {
                    if (!draggable) return;
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('text/plain', entry.player.id);
                    onDragStartPlayer?.(entry.player.id);
                  }}
                  onDragEnd={onDragEnd}
                >
                  {has('pos') && (
                    <td>
                      <PositionTag entry={entry} />
                    </td>
                  )}
                  {has('name') && (
                    <td>
                      <PlayerName entry={entry} showSecondary />
                    </td>
                  )}
                  {has('age') && <td className="tnum" style={{ textAlign: 'right' }}>{entry.player.age}</td>}
                  {has('ovr') && (
                    <td style={{ textAlign: 'center' }}>
                      <RatingBadge value={overall} size="sm" title={`Overall ${overall}`} />
                    </td>
                  )}
                  {has('form') && (
                    <td>
                      <FormCell entry={entry} />
                    </td>
                  )}
                  {has('energy') && (
                    <td>
                      <EnergyCell entry={entry} />
                    </td>
                  )}
                  {has('role') && (
                    <td>{roleOf && <RoleTag role={roleOf(entry.player.id)} short={compact} />}</td>
                  )}
                  {has('value') && (
                    <td className="tnum" style={{ textAlign: 'right' }}>
                      {moneyShort(entry.value)}
                    </td>
                  )}
                  {has('salary') && (
                    <td className="tnum muted" style={{ textAlign: 'right' }}>
                      {moneyShort(entry.salary)}
                    </td>
                  )}
                  {has('contract') && (
                    <td className="tnum muted" style={{ textAlign: 'right' }}>
                      {contractYear(entry.contractUntil)}
                    </td>
                  )}
                  {has('status') && (
                    <td>
                      <StatusCell entry={entry} />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </DataTable>
      )}
    </div>
  );
}

export { ratingColor };
