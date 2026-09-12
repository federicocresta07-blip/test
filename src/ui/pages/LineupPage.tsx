import { useState, type DragEvent, type ReactNode } from 'react';
import { formationIds } from '../../domain/formations.ts';
import { Button } from '../components/ui/Button.tsx';
import { Panel } from '../components/ui/Panel.tsx';
import { SquadTable } from '../components/squad/SquadTable.tsx';
import { FormationPitch } from '../components/formation/FormationPitch.tsx';
import { BenchStrip } from '../components/formation/BenchStrip.tsx';
import { TeamMetricsPanel } from '../components/formation/TeamMetrics.tsx';
import { TacticsPanel } from '../components/formation/TacticsPanel.tsx';
import { PlayerQuickPanel } from '../components/player/PlayerQuickPanel.tsx';
import { useGameState } from '../state/GameProvider.tsx';
import { useLineupEditor } from '../state/useLineupEditor.ts';
import { tacticsLabel } from '../lib/tactics-labels.ts';

/**
 * ALINEACION (seccion 6) — fase 2 del plan.
 *
 * "Veo todo mi equipo de un vistazo y puedo armar el once inmediatamente":
 * plantel a la izquierda, cancha protagonista a la derecha, suplentes abajo y
 * la barra de acciones siempre visible. Todo en una sola pantalla.
 */
export function LineupPage({ openPanel }: { readonly openPanel?: 'tactica' }): ReactNode {
  const state = useGameState();
  const editor = useLineupEditor();
  const [tacticsOpen, setTacticsOpen] = useState(openPanel === 'tactica');
  const [dragOverSquad, setDragOverSquad] = useState(false);

  const {
    selection,
    slots,
    metrics,
    roleOf,
    selectedId,
    setSelectedId,
    dragging,
    setDragging,
    moveToBench,
    unlist,
    setFormation,
    autoSelect,
    saveLineup,
    saveState,
  } = editor;

  const selectedEntry = editor.entryOf(selectedId) ?? null;
  const selectedSlotIndex = selectedId ? selection.starters.indexOf(selectedId) : -1;
  const assignedPosition =
    selectedSlotIndex >= 0 ? slots[selectedSlotIndex]?.position : undefined;

  /** Soltar sobre el plantel = sacar de la convocatoria (seccion 6.4). */
  const onDropOnSquad = (event: DragEvent): void => {
    event.preventDefault();
    setDragOverSquad(false);
    const playerId = dragging?.playerId ?? event.dataTransfer.getData('text/plain');
    if (playerId) unlist(playerId);
    setDragging(null);
  };

  return (
    <div className="page lineup">
      <div className="lineup__grid">
        {/* --- Plantel (seccion 6.2) --- */}
        <div
          className={`lineup__squad ${dragOverSquad ? 'is-dropzone' : ''}`}
          onDragOver={(event) => {
            if (!dragging || dragging.kind === 'plantel') return;
            event.preventDefault();
            setDragOverSquad(true);
          }}
          onDragLeave={() => setDragOverSquad(false)}
          onDrop={onDropOnSquad}
        >
          <Panel
            title="Plantel"
            subtitle={dragging ? 'Soltá acá para no convocar' : 'Arrastrá a la cancha o al banco'}
            padded={false}
          >
            <SquadTable
              compact
              entries={state.squad}
              columns={['pos', 'name', 'ovr', 'form', 'energy', 'role', 'status']}
              roleOf={roleOf}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onActivate={(playerId) => moveToBench(playerId)}
              draggable
              onDragStartPlayer={(playerId) => setDragging({ kind: 'plantel', playerId })}
              onDragEnd={() => setDragging(null)}
            />
          </Panel>
        </div>

        {/* --- Cancha (seccion 6.3) --- */}
        <div className="lineup__pitchcol">
          <Panel
            title="Cancha"
            subtitle="Solo para configurar la alineación: el partido no tiene representación visual"
            actions={
              <label className="formationpick">
                <span className="label">Formación</span>
                <select
                  className="select"
                  value={selection.formationId}
                  onChange={(event) => setFormation(event.target.value)}
                >
                  {formationIds().map((id) => (
                    <option key={id} value={id}>
                      {id}
                    </option>
                  ))}
                </select>
              </label>
            }
          >
            <FormationPitch editor={editor} />
            <BenchStrip editor={editor} />
          </Panel>
        </div>

        {/* --- Feedback del equipo (seccion 6.8) --- */}
        <div className="lineup__metricscol">
          <Panel title="Fuerza del equipo" subtitle="Se actualiza al cambiar el once">
            <TeamMetricsPanel metrics={metrics} />
          </Panel>

          <Panel title="Táctica" padded>
            <div className="tacticsummary">
              <SummaryRow label="Formación" value={selection.formationId} />
              <SummaryRow label="Mentalidad" value={tacticsLabel.mentality(selection.tactics.mentality)} />
              <SummaryRow label="Estilo" value={tacticsLabel.passingStyle(selection.tactics.passingStyle)} />
              <SummaryRow label="Presión" value={tacticsLabel.level(selection.tactics.pressing)} />
              <SummaryRow label="Ritmo" value={tacticsLabel.tempo(selection.tactics.tempo)} />
              <SummaryRow label="Ataque" value={tacticsLabel.attackFocus(selection.tactics.attackFocus)} />
              <SummaryRow
                label="Capitán"
                value={editor.entryOf(selection.roles.captainId)?.player.name ?? 'sin designar'}
              />
              <SummaryRow
                label="Penales"
                value={editor.entryOf(selection.roles.penaltiesId)?.player.name ?? 'sin designar'}
              />
            </div>
            <Button block onClick={() => setTacticsOpen(true)}>
              Configurar táctica y balón parado
            </Button>
          </Panel>
        </div>
      </div>

      {/* --- Barra de acciones (seccion 6.12) --- */}
      <div className="lineup__actions">
        <div className="row" style={{ gap: 'var(--sp-5)' }}>
          <Button onClick={autoSelect} title="Propone un once según puesto, overall, forma, energía y disponibilidad">
            Autoseleccionar XI
          </Button>
          <span className="lineup__hint muted">
            La autoselección propone; confirmás vos al guardar.
          </span>
        </div>

        <div className="row" style={{ gap: 'var(--sp-5)' }}>
          <SaveIndicator state={saveState} />
          <Button
            variant="primary"
            size="lg"
            onClick={() => void saveLineup()}
            disabled={saveState === 'guardando'}
          >
            {saveState === 'guardando' ? 'Guardando…' : 'Guardar equipo'}
          </Button>
        </div>
      </div>

      <TacticsPanel editor={editor} open={tacticsOpen} onClose={() => setTacticsOpen(false)} />

      {/* La ficha rapida no saca al usuario de la alineacion (seccion 6.9). */}
      <PlayerQuickPanel
        entry={selectedEntry}
        assignedPosition={assignedPosition}
        onClose={() => setSelectedId(null)}
        onSendToBench={(playerId) => {
          moveToBench(playerId);
          setSelectedId(null);
        }}
        onUnlist={(playerId) => {
          unlist(playerId);
          setSelectedId(null);
        }}
      />
    </div>
  );
}

function SummaryRow({ label, value }: { readonly label: string; readonly value: string }): ReactNode {
  return (
    <div className="tacticsummary__row">
      <span className="tacticsummary__label">{label}</span>
      <span className="tacticsummary__value truncate">{value}</span>
    </div>
  );
}

/** Confirmacion discreta de guardado (seccion 6.12). */
function SaveIndicator({ state }: { readonly state: string }): ReactNode {
  if (state === 'guardado') return <span className="saveind is-ok">Equipo guardado</span>;
  if (state === 'sin-guardar') return <span className="saveind is-pending">Cambios sin guardar</span>;
  if (state === 'error') return <span className="saveind is-error">No se pudo guardar</span>;
  return null;
}
