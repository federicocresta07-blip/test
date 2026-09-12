import type { ReactNode } from 'react';
import {
  DEFENSIVE_ATTRIBUTES,
  GOALKEEPING_ATTRIBUTES,
  MENTAL_ATTRIBUTES,
  PHYSICAL_ATTRIBUTES,
  TECHNICAL_ATTRIBUTES,
  type AttributeKey,
} from '../../../domain/attributes.ts';
import type { Position } from '../../../domain/positions.ts';
import { POSITION_META } from '../../../domain/positions.ts';
import type { ClubPlayer } from '../../models/index.ts';
import { overallInSlot, naturalOverall } from '../../lib/engine-bridge.ts';
import { energyColor, energyOf, formColor, formText, ratingColor } from '../../lib/ratings.ts';
import { contractYear, money, moneyShort } from '../../lib/format.ts';
import { Drawer } from '../ui/Drawer.tsx';
import { Button } from '../ui/Button.tsx';
import { RatingBadge } from '../ui/Badge.tsx';
import { ColorBar } from '../ui/ProgressBar.tsx';
import { playerStatuses, PositionTag } from './PlayerCells.tsx';
import { fitLabel } from '../../lib/positions.ts';
import { StatusBadge } from '../ui/Badge.tsx';

/** Nombres legibles de los atributos del motor. */
const ATTRIBUTE_LABEL: Partial<Record<AttributeKey, string>> = {
  velocidad: 'Velocidad',
  aceleracion: 'Aceleración',
  resistencia: 'Resistencia',
  fuerza: 'Fuerza',
  salto: 'Salto',
  agilidad: 'Agilidad',
  paseCorto: 'Pase corto',
  paseLargo: 'Pase largo',
  centros: 'Centros',
  tecnica: 'Técnica',
  control: 'Control',
  regate: 'Regate',
  definicion: 'Definición',
  remate: 'Remate',
  juegoAereo: 'Juego aéreo',
  tirosLibres: 'Tiros libres',
  penales: 'Penales',
  marcaje: 'Marcaje',
  quite: 'Quite',
  vision: 'Visión',
  decisiones: 'Decisiones',
  posicionamiento: 'Posicionamiento',
  concentracion: 'Concentración',
  agresividad: 'Agresividad',
  trabajoEquipo: 'Trabajo de equipo',
  reflejos: 'Reflejos',
  manos: 'Manos',
  achique: 'Achique',
  saque: 'Saque',
};

/**
 * FICHA RAPIDA DEL JUGADOR (seccion 6.9).
 *
 * Se abre en panel lateral sin abandonar la alineacion. Muestra los atributos
 * principales en escala 1-100, el estado y los datos de contrato.
 */
export function PlayerQuickPanel({
  entry,
  assignedPosition,
  onClose,
  onSendToBench,
  onUnlist,
}: {
  readonly entry: ClubPlayer | null;
  /** Puesto en el que esta jugando, si esta en la cancha. */
  readonly assignedPosition?: Position | undefined;
  readonly onClose: () => void;
  readonly onSendToBench?: (playerId: string) => void;
  readonly onUnlist?: (playerId: string) => void;
}): ReactNode {
  if (!entry) return null;

  const player = entry.player;
  const isGoalkeeper = player.position === 'POR';
  const natural = naturalOverall(player);
  const inSlot = assignedPosition ? overallInSlot(player, assignedPosition) : null;
  const statuses = playerStatuses(entry);
  const energy = energyOf(player);

  const groups: readonly { label: string; keys: readonly AttributeKey[] }[] = isGoalkeeper
    ? [
        { label: 'Arquero', keys: GOALKEEPING_ATTRIBUTES },
        { label: 'Mentales', keys: MENTAL_ATTRIBUTES },
        { label: 'Físicos', keys: PHYSICAL_ATTRIBUTES },
      ]
    : [
        { label: 'Técnicos', keys: TECHNICAL_ATTRIBUTES },
        { label: 'Mentales', keys: MENTAL_ATTRIBUTES },
        { label: 'Defensivos', keys: DEFENSIVE_ATTRIBUTES },
        { label: 'Físicos', keys: PHYSICAL_ATTRIBUTES },
      ];

  return (
    <Drawer
      open
      title={player.name}
      subtitle={`${entry.shirtNumber} · ${POSITION_META[player.position].name} · ${player.age} años · ${entry.nationality}`}
      onClose={onClose}
      width={400}
      footer={
        <>
          {onUnlist && (
            <Button variant="ghost" onClick={() => onUnlist(player.id)}>
              No convocar
            </Button>
          )}
          {onSendToBench && (
            <Button onClick={() => onSendToBench(player.id)}>Al banco</Button>
          )}
          <Button variant="secondary" disabled title="El perfil completo es la fase 5 del plan">
            Ver perfil
          </Button>
        </>
      }
    >
      <div className="quickpanel">
        <div className="quickpanel__top">
          <div className="quickpanel__ovr">
            <RatingBadge value={natural} size="lg" />
            <span className="label">Overall</span>
          </div>
          <div className="quickpanel__meta">
            <span className="row" style={{ gap: 'var(--sp-3)' }}>
              <PositionTag entry={entry} />
              {player.secondaryPositions.map((position) => (
                <span key={position} className="postag postag--secondary" title="Posición secundaria">
                  {position}
                </span>
              ))}
            </span>
            {statuses.length > 0 && (
              <span className="row" style={{ gap: 'var(--sp-2)' }}>
                {statuses.map((item) => (
                  <StatusBadge key={item.status} status={item.status} detail={item.detail} />
                ))}
              </span>
            )}
          </div>
        </div>

        {/* Seccion 6.5: el efecto de jugar fuera de posicion, calculado por el motor. */}
        {inSlot && !inSlot.isNatural && (
          <div className="outofpos">
            <span className="outofpos__row">
              <span className="secondary">Overall natural</span>
              <span className="tnum">{inSlot.natural}</span>
            </span>
            <span className="outofpos__row">
              <span className="secondary">Jugando como {assignedPosition}</span>
              <span className="outofpos__label">{fitLabel(inSlot.label)}</span>
            </span>
            <span className="outofpos__row outofpos__row--result">
              <span>Overall efectivo</span>
              <span className="tnum" style={{ color: ratingColor(inSlot.effective) }}>
                {inSlot.effective}
                <span className="outofpos__delta"> ({inSlot.effective - inSlot.natural})</span>
              </span>
            </span>
          </div>
        )}

        <div className="quickpanel__state">
          <StateRow
            label="Forma"
            value={formText(player.condition.form)}
            ratio={player.condition.form / 100}
            color={formColor(player.condition.form)}
          />
          <StateRow
            label="Moral"
            value={String(player.condition.morale)}
            ratio={player.condition.morale / 100}
            color={ratingColor(player.condition.morale)}
          />
          <StateRow
            label="Energía"
            value={`${Math.round(energy)}%`}
            ratio={energy / 100}
            color={energyColor(energy)}
          />
          <StateRow
            label="Experiencia"
            value={String(player.experience)}
            ratio={player.experience / 100}
            color={ratingColor(player.experience)}
          />
        </div>

        <div className="quickpanel__contract">
          <ContractCell label="Valor" value={moneyShort(entry.value)} title={money(entry.value)} />
          <ContractCell label="Salario" value={`${moneyShort(entry.salary)}/mes`} title={money(entry.salary)} />
          <ContractCell label="Contrato" value={`hasta ${contractYear(entry.contractUntil)}`} />
          <ContractCell label="Amarillas" value={String(entry.yellowCards)} />
        </div>

        {groups.map((group) => (
          <div key={group.label} className="attrgroup">
            <span className="label">{group.label}</span>
            <ul className="attrgroup__list">
              {group.keys.map((key) => {
                const value = player.attributes[key];
                return (
                  <li key={key} className="attrrow">
                    <span className="attrrow__label truncate">{ATTRIBUTE_LABEL[key] ?? key}</span>
                    <span className="attrrow__bar">
                      <ColorBar value={value / 100} color={ratingColor(value)} height={3} />
                    </span>
                    <span className="attrrow__value tnum" style={{ color: ratingColor(value) }}>
                      {value}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </Drawer>
  );
}

function StateRow({
  label,
  value,
  ratio,
  color,
}: {
  readonly label: string;
  readonly value: string;
  readonly ratio: number;
  readonly color: string;
}): ReactNode {
  return (
    <div className="staterow">
      <span className="staterow__label">{label}</span>
      <span className="staterow__bar">
        <ColorBar value={ratio} color={color} height={4} />
      </span>
      <span className="staterow__value" style={{ color }}>
        {value}
      </span>
    </div>
  );
}

function ContractCell({
  label,
  value,
  title,
}: {
  readonly label: string;
  readonly value: string;
  readonly title?: string;
}): ReactNode {
  return (
    <div className="contractcell" title={title}>
      <span className="label">{label}</span>
      <span className="contractcell__value tnum">{value}</span>
    </div>
  );
}
