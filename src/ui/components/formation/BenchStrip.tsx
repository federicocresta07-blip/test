import { useState, type DragEvent, type ReactNode } from 'react';
import { PlayerChip } from './PlayerChip.tsx';
import type { LineupEditor } from '../../state/useLineupEditor.ts';
import { Icon } from '../Icon.tsx';

/**
 * SUPLENTES (seccion 6.7).
 *
 * El banco esta siempre visible debajo de la cancha y acepta arrastrar hacia
 * dentro y hacia fuera. Los que no estan ni en la cancha ni en el banco
 * quedan como no convocados en el listado del plantel.
 */
export function BenchStrip({ editor }: { readonly editor: LineupEditor }): ReactNode {
  const { benchEntries, dragging, setDragging, moveToBench, unlist, maxBench, selectedId, setSelectedId } =
    editor;
  const [hover, setHover] = useState(false);

  const onDrop = (event: DragEvent): void => {
    event.preventDefault();
    setHover(false);
    const playerId = dragging?.playerId ?? event.dataTransfer.getData('text/plain');
    if (playerId) moveToBench(playerId);
    setDragging(null);
  };

  return (
    <div
      className={`bench ${hover ? 'is-hover' : ''} ${dragging ? 'is-droppable' : ''}`}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        setHover(true);
      }}
      onDragLeave={() => setHover(false)}
      onDrop={onDrop}
    >
      <div className="bench__head">
        <span className="label">Suplentes</span>
        <span className="bench__count tnum muted">
          {benchEntries.length}/{maxBench}
        </span>
      </div>

      <ul className="bench__list">
        {benchEntries.map((entry) => (
          <li key={entry.player.id}>
            <button
              className={`bench__chip ${selectedId === entry.player.id ? 'is-selected' : ''}`}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', entry.player.id);
                setDragging({ kind: 'banco', playerId: entry.player.id });
              }}
              onDragEnd={() => setDragging(null)}
              onClick={() =>
                setSelectedId(selectedId === entry.player.id ? null : entry.player.id)
              }
              title={`${entry.player.name} — suplente`}
            >
              <PlayerChip entry={entry} assigned={entry.player.position} compact />
              <span
                className="bench__remove"
                role="button"
                tabIndex={-1}
                aria-label={`Quitar a ${entry.player.name} del banco`}
                title="Quitar de la convocatoria"
                onClick={(event) => {
                  event.stopPropagation();
                  unlist(entry.player.id);
                }}
              >
                ✕
              </span>
            </button>
          </li>
        ))}

        {benchEntries.length < maxBench && (
          <li className="bench__placeholder">
            <Icon name="chevron" size={13} />
            <span>Arrastrá jugadores acá</span>
          </li>
        )}
      </ul>
    </div>
  );
}
