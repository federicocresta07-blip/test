/**
 * Tacticas (secciones 31, 32).
 *
 * El usuario elige opciones legibles ("presion alta", "juego directo") y el
 * motor las traduce a un perfil numerico. Los cruces tacticos se resuelven
 * despues en `engine/tactical-matchups.ts` comparando dos perfiles.
 */

import { clamp } from '../core/math.ts';
import { getFormation, type Formation } from './formations.ts';

export type Mentality = 'muy defensiva' | 'defensiva' | 'equilibrada' | 'ofensiva' | 'muy ofensiva';
export type ThreeLevel = 'baja' | 'media' | 'alta';
export type Tempo = 'lento' | 'equilibrado' | 'rapido';
export type PassingStyle = 'posesion' | 'mixto' | 'directo';
export type AttackFocus = 'centro' | 'mixto' | 'bandas';
export type TeamWidth = 'estrecho' | 'normal' | 'ancho';

export type Tactics = {
  readonly formationId: string;
  readonly mentality: Mentality;
  /** Altura de la presion (seccion 32). */
  readonly pressing: ThreeLevel;
  /** Altura de la linea defensiva. */
  readonly defensiveLine: ThreeLevel;
  readonly tempo: Tempo;
  readonly passingStyle: PassingStyle;
  readonly attackFocus: AttackFocus;
  readonly width: TeamWidth;
  readonly aggression: ThreeLevel;
  /** Busca explicitamente la contra. */
  readonly counterAttack: boolean;
  /** Prioriza el juego aereo y el balon parado. */
  readonly setPieceFocus: boolean;
};

export const DEFAULT_TACTICS: Tactics = {
  formationId: '4-4-2',
  mentality: 'equilibrada',
  pressing: 'media',
  defensiveLine: 'media',
  tempo: 'equilibrado',
  passingStyle: 'mixto',
  attackFocus: 'mixto',
  width: 'normal',
  aggression: 'media',
  counterAttack: false,
  setPieceFocus: false,
};

/**
 * Arma una tactica sobre los valores por defecto.
 *
 * Valida la formacion: un id que no existe tiene que fallar aca, con el
 * listado de las disponibles, y no a mitad del primer partido. Sin esta
 * validacion un `'5-4-1'` en lugar de `'4-5-1'` deja a un club sin jugar el
 * torneo entero y el error aparece muy lejos de donde se escribio.
 */
export function createTactics(overrides: Partial<Tactics> = {}): Tactics {
  const tactics = { ...DEFAULT_TACTICS, ...overrides };
  getFormation(tactics.formationId);
  return tactics;
}

/** Perfil numerico de una tactica, ya combinada con la estructura de la formacion. */
export type TacticalProfile = {
  readonly formation: Formation;
  /** -1 (muy defensiva) .. +1 (muy ofensiva). */
  readonly mentality: number;
  /** 0 (presion baja) .. 1 (presion alta). */
  readonly pressing: number;
  /** 0 (linea baja) .. 1 (linea alta). */
  readonly defensiveLine: number;
  /** 0 (lento) .. 1 (rapido). */
  readonly tempo: number;
  /** 0 (posesion) .. 1 (juego directo). */
  readonly directness: number;
  /** 0 (ataque central) .. 1 (ataque por bandas). */
  readonly wingFocus: number;
  /** 0 (estrecho) .. 1 (ancho). */
  readonly width: number;
  /** 0 (juego limpio) .. 1 (muy agresivo). */
  readonly aggression: number;
  /** Intencion de contraataque, 0..1. */
  readonly counterIntent: number;
  /** Prioridad al balon parado, 0..1. */
  readonly setPieceIntent: number;
  /** Proteccion del area propia (estructura + linea), 0..1. */
  readonly boxProtection: number;
  /** Presencia en el area rival, 0..1. */
  readonly boxPresence: number;
  /** Cuanto se estira el equipo: sube ocasiones de los dos lados. */
  readonly openness: number;
};

const LEVEL: Record<ThreeLevel, number> = { baja: 0.18, media: 0.5, alta: 0.85 };
const MENTALITY: Record<Mentality, number> = {
  'muy defensiva': -1,
  defensiva: -0.5,
  equilibrada: 0,
  ofensiva: 0.5,
  'muy ofensiva': 1,
};
const TEMPO: Record<Tempo, number> = { lento: 0.18, equilibrado: 0.5, rapido: 0.85 };
const PASSING: Record<PassingStyle, number> = { posesion: 0.15, mixto: 0.5, directo: 0.85 };
const FOCUS: Record<AttackFocus, number> = { centro: 0.15, mixto: 0.5, bandas: 0.85 };
const WIDTH: Record<TeamWidth, number> = { estrecho: 0.2, normal: 0.5, ancho: 0.85 };

/** Traduce la tactica elegida a numeros, mezclando los rasgos de la formacion. */
export function buildTacticalProfile(tactics: Tactics): TacticalProfile {
  const formation = getFormation(tactics.formationId);
  const mentality = MENTALITY[tactics.mentality];
  const pressing = clamp(LEVEL[tactics.pressing] * 0.75 + formation.traits.pressingBias * 0.25, 0, 1);
  const defensiveLine = LEVEL[tactics.defensiveLine];
  const directness = PASSING[tactics.passingStyle];
  const counterIntent = clamp(
    (tactics.counterAttack ? 0.6 : 0.15) + formation.traits.counterBias * 0.4,
    0,
    1,
  );
  const width = clamp(WIDTH[tactics.width] * 0.7 + formation.traits.width * 0.3, 0, 1);
  const boxProtection = clamp(
    formation.traits.boxProtection * 0.7 + (1 - defensiveLine) * 0.15 + (0.5 - mentality * 0.5) * 0.3,
    0,
    1,
  );
  const boxPresence = clamp(
    formation.traits.boxPresence * 0.7 + (0.5 + mentality * 0.5) * 0.3,
    0,
    1,
  );
  // Un partido se abre cuando los dos suben la linea, aprietan y juegan rapido.
  const openness = clamp(
    defensiveLine * 0.4 + pressing * 0.3 + TEMPO[tactics.tempo] * 0.3,
    0,
    1,
  );
  return {
    formation,
    mentality,
    pressing,
    defensiveLine,
    tempo: TEMPO[tactics.tempo],
    directness,
    wingFocus: clamp(FOCUS[tactics.attackFocus] * 0.75 + formation.traits.width * 0.25, 0, 1),
    width,
    aggression: LEVEL[tactics.aggression],
    counterIntent,
    setPieceIntent: tactics.setPieceFocus ? 0.85 : 0.3,
    boxProtection,
    boxPresence,
    openness,
  };
}
