import type { ReactNode } from 'react';
import { formationIds } from '../../../domain/formations.ts';
import type {
  AttackFocus,
  Mentality,
  PassingStyle,
  Tempo,
  TeamWidth,
  ThreeLevel,
} from '../../../domain/tactics.ts';
import { Drawer } from '../ui/Drawer.tsx';
import { Button } from '../ui/Button.tsx';
import type { LineupEditor } from '../../state/useLineupEditor.ts';
import type { ClubPlayer } from '../../models/index.ts';
import { tacticsLabel } from '../../lib/tactics-labels.ts';

/**
 * TACTICA Y BALON PARADO (seccion 6.10).
 *
 * Panel lateral sobre la propia pantalla de alineacion: el foco se mantiene
 * en la formacion. Las opciones son las mismas que entiende el motor, asi que
 * lo que se elige acá es exactamente lo que se simula.
 */
export function TacticsPanel({
  editor,
  open,
  onClose,
}: {
  readonly editor: LineupEditor;
  readonly open: boolean;
  readonly onClose: () => void;
}): ReactNode {
  const { selection, setTactics, setRoles, startersEntries, benchEntries } = editor;
  const tactics = selection.tactics;

  // Los designados salen de los convocados: no tiene sentido ofrecer a alguien
  // que no va a estar en el partido.
  const called: readonly ClubPlayer[] = [
    ...startersEntries.filter((entry): entry is ClubPlayer => !!entry),
    ...benchEntries,
  ];

  return (
    <Drawer
      open={open}
      title="Táctica y balón parado"
      subtitle="Se aplica en la simulación del próximo partido"
      onClose={onClose}
      width={400}
      footer={
        <Button variant="primary" onClick={onClose}>
          Listo
        </Button>
      }
    >
      <div className="tacticsform">
        <Field label="Formación" hint="Redistribuye los puestos de la cancha">
          <select
            className="select"
            value={tactics.formationId}
            onChange={(event) => editor.setFormation(event.target.value)}
          >
            {formationIds().map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Mentalidad" hint="Reparte el esfuerzo entre atacar y defender">
          <Choice<Mentality>
            value={tactics.mentality}
            options={['muy defensiva', 'defensiva', 'equilibrada', 'ofensiva', 'muy ofensiva']}
            labels={['Muy def.', 'Defensiva', 'Equilibrada', 'Ofensiva', 'Muy of.']}
            onChange={(mentality) => setTactics({ ...tactics, mentality })}
          />
        </Field>

        <Field label="Estilo de pase" hint="Posesión aguanta la pelota; directo la juega larga">
          <Choice<PassingStyle>
            value={tactics.passingStyle}
            options={['posesion', 'mixto', 'directo']}
            labels={(['posesion', 'mixto', 'directo'] as const).map(tacticsLabel.passingStyle)}
            onChange={(passingStyle) => setTactics({ ...tactics, passingStyle })}
          />
        </Field>

        <Field label="Ritmo">
          <Choice<Tempo>
            value={tactics.tempo}
            options={['lento', 'equilibrado', 'rapido']}
            labels={(['lento', 'equilibrado', 'rapido'] as const).map(tacticsLabel.tempo)}
            onChange={(tempo) => setTactics({ ...tactics, tempo })}
          />
        </Field>

        <Field label="Presión" hint="Presión alta incomoda la salida rival, pero deja espacios">
          <Choice<ThreeLevel>
            value={tactics.pressing}
            options={['baja', 'media', 'alta']}
            labels={['Baja', 'Media', 'Alta']}
            onChange={(pressing) => setTactics({ ...tactics, pressing })}
          />
        </Field>

        <Field label="Línea defensiva">
          <Choice<ThreeLevel>
            value={tactics.defensiveLine}
            options={['baja', 'media', 'alta']}
            labels={['Baja', 'Media', 'Alta']}
            onChange={(defensiveLine) => setTactics({ ...tactics, defensiveLine })}
          />
        </Field>

        <Field label="Ataque por" hint="Por bandas genera centros; por el medio busca la pared">
          <Choice<AttackFocus>
            value={tactics.attackFocus}
            options={['centro', 'mixto', 'bandas']}
            labels={['Centro', 'Mixto', 'Bandas']}
            onChange={(attackFocus) => setTactics({ ...tactics, attackFocus })}
          />
        </Field>

        <Field label="Amplitud">
          <Choice<TeamWidth>
            value={tactics.width}
            options={['estrecho', 'normal', 'ancho']}
            labels={['Estrecho', 'Normal', 'Ancho']}
            onChange={(width) => setTactics({ ...tactics, width })}
          />
        </Field>

        <Field label="Agresividad" hint="Más agresivo recupera antes, pero cobra faltas y tarjetas">
          <Choice<ThreeLevel>
            value={tactics.aggression}
            options={['baja', 'media', 'alta']}
            labels={['Baja', 'Media', 'Alta']}
            onChange={(aggression) => setTactics({ ...tactics, aggression })}
          />
        </Field>

        <div className="tacticsform__toggles">
          <Toggle
            label="Buscar el contraataque"
            checked={tactics.counterAttack}
            onChange={(counterAttack) => setTactics({ ...tactics, counterAttack })}
          />
          <Toggle
            label="Priorizar el balón parado"
            checked={tactics.setPieceFocus}
            onChange={(setPieceFocus) => setTactics({ ...tactics, setPieceFocus })}
          />
        </div>

        <div className="tacticsform__section">
          <span className="label">Designados</span>
          <PlayerSelect
            label="Capitán"
            value={selection.roles.captainId}
            players={called}
            onChange={(captainId) => setRoles({ captainId })}
          />
          <PlayerSelect
            label="Penales"
            value={selection.roles.penaltiesId}
            players={called}
            onChange={(penaltiesId) => setRoles({ penaltiesId })}
          />
          <PlayerSelect
            label="Tiros libres"
            value={selection.roles.freeKicksId}
            players={called}
            onChange={(freeKicksId) => setRoles({ freeKicksId })}
          />
          <PlayerSelect
            label="Córner izquierdo"
            value={selection.roles.leftCornerId}
            players={called}
            onChange={(leftCornerId) => setRoles({ leftCornerId })}
          />
          <PlayerSelect
            label="Córner derecho"
            value={selection.roles.rightCornerId}
            players={called}
            onChange={(rightCornerId) => setRoles({ rightCornerId })}
          />
        </div>
      </div>
    </Drawer>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  readonly label: string;
  readonly hint?: string;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <div className="field">
      <div className="field__head">
        <span className="label">{label}</span>
        {hint && <span className="field__hint">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Choice<T extends string>({
  value,
  options,
  labels,
  onChange,
}: {
  readonly value: T;
  readonly options: readonly T[];
  readonly labels: readonly string[];
  readonly onChange: (value: T) => void;
}): ReactNode {
  return (
    <div className="choice" role="radiogroup">
      {options.map((option, index) => (
        <button
          key={option}
          role="radio"
          aria-checked={option === value}
          className={`choice__option ${option === value ? 'is-active' : ''}`}
          onClick={() => onChange(option)}
        >
          {labels[index] ?? option}
        </button>
      ))}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
}): ReactNode {
  return (
    <button className={`toggle ${checked ? 'is-on' : ''}`} onClick={() => onChange(!checked)} role="switch" aria-checked={checked}>
      <span className="toggle__track">
        <span className="toggle__knob" />
      </span>
      <span>{label}</span>
    </button>
  );
}

function PlayerSelect({
  label,
  value,
  players,
  onChange,
}: {
  readonly label: string;
  readonly value: string | null;
  readonly players: readonly ClubPlayer[];
  readonly onChange: (playerId: string | null) => void;
}): ReactNode {
  return (
    <label className="playerselect">
      <span className="playerselect__label">{label}</span>
      <select
        className="select"
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value === '' ? null : event.target.value)}
      >
        <option value="">Sin designar</option>
        {players.map((entry) => (
          <option key={entry.player.id} value={entry.player.id}>
            {entry.shirtNumber} · {entry.player.name}
          </option>
        ))}
      </select>
    </label>
  );
}
