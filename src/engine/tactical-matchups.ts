/**
 * MATCHUPS TACTICOS (seccion 32).
 *
 * Las tacticas se miden entre si. La presion alta le gana a la salida en
 * posesion, pero sufre contra el juego directo; un bloque bajo tapa el
 * ataque central, pero se lo comen los extremos y los centros.
 *
 * Todos los efectos son chicos y quedan registrados con una explicacion,
 * que despues usa el relato del partido (seccion 51).
 */

import type { EngineConfig } from '../config/engine-config.ts';
import { clamp } from '../core/math.ts';
import type { TeamStrength } from '../ratings/team-strength.ts';

export type MatchupEffect = {
  /** Puntos de control del partido (etapa 1). */
  control: number;
  /** Fraccion sobre el volumen de remates (etapa 2). */
  shotVolume: number;
  /** Fraccion sobre la calidad de las ocasiones (etapa 3). */
  chanceQuality: number;
  /** Fraccion extra para las ocasiones de contraataque. */
  counterBonus: number;
  /** Fraccion sobre el peligro del balon parado. */
  setPieceBonus: number;
};

export type MatchupNote = {
  readonly id: string;
  readonly text: string;
  readonly magnitude: number;
};

export type MatchupOutcome = {
  readonly home: MatchupEffect;
  readonly away: MatchupEffect;
  readonly homeNotes: readonly MatchupNote[];
  readonly awayNotes: readonly MatchupNote[];
};

function emptyEffect(): MatchupEffect {
  return { control: 0, shotVolume: 0, chanceQuality: 0, counterBonus: 0, setPieceBonus: 0 };
}

type RuleContext = {
  readonly self: TeamStrength;
  readonly opponent: TeamStrength;
  readonly config: EngineConfig;
};

type RuleResult = {
  /** Efecto para el equipo evaluado. */
  readonly self?: Partial<MatchupEffect>;
  /** Efecto para su rival. */
  readonly opponent?: Partial<MatchupEffect>;
  readonly note?: string;
  readonly magnitude: number;
};

type Rule = {
  readonly id: string;
  readonly apply: (ctx: RuleContext) => RuleResult | undefined;
};

/** Intensidad 0..1 de que un valor supere un umbral. */
function above(value: number, threshold: number, span = 1 - threshold): number {
  if (span <= 0) return value >= threshold ? 1 : 0;
  return clamp((value - threshold) / span, 0, 1);
}

/** Intensidad 0..1 de que un valor quede por debajo de un umbral. */
function below(value: number, threshold: number, span = threshold): number {
  if (span <= 0) return value <= threshold ? 1 : 0;
  return clamp((threshold - value) / span, 0, 1);
}

/** Ventaja relativa entre dos capacidades, normalizada a 0..1. */
function edge(a: number, b: number, span = 20): number {
  return clamp((a - b) / span, -1, 1);
}

const RULES: readonly Rule[] = [
  {
    id: 'presion-alta-vs-posesion',
    apply: ({ self, opponent, config }) => {
      const intensity =
        above(self.profile.pressing, 0.6) *
        below(opponent.profile.directness, 0.4) *
        below(opponent.profile.tempo, 0.55, 0.55);
      if (intensity <= 0.02) return undefined;
      // Presionar sirve si tenes con que: se mide presion propia contra mediocampo rival.
      const capability = 0.5 + edge(self.dimensions.presion, opponent.dimensions.mediocampo) * 0.5;
      const strength = intensity * clamp(capability, 0, 1);
      return {
        self: {
          control: config.matchups.pressVsPossessionControl * strength,
          shotVolume: 0.05 * strength,
        },
        opponent: { chanceQuality: -0.05 * strength },
        note: `${self.team.name} incomodó la salida en posesión de ${opponent.team.name} con presión alta`,
        magnitude: strength,
      };
    },
  },
  {
    id: 'directo-vs-presion-alta',
    apply: ({ self, opponent, config }) => {
      const intensity =
        above(opponent.profile.pressing, 0.6) *
        Math.max(above(self.profile.directness, 0.55, 0.45), above(self.profile.counterIntent, 0.55, 0.45));
      if (intensity <= 0.02) return undefined;
      const capability = 0.5 + edge(self.dimensions.contraataque, opponent.dimensions.defensa) * 0.5;
      const strength = intensity * clamp(capability, 0, 1);
      return {
        self: {
          counterBonus: config.matchups.directVsPressCounter * strength,
          chanceQuality: config.matchups.directVsPressCounter * 0.45 * strength,
        },
        note: `${self.team.name} encontró espacios a la espalda de la presión de ${opponent.team.name}`,
        magnitude: strength,
      };
    },
  },
  {
    id: 'bloque-bajo-vs-ataque-central',
    apply: ({ self, opponent, config }) => {
      const intensity = above(self.profile.boxProtection, 0.55) * below(opponent.profile.wingFocus, 0.45);
      if (intensity <= 0.02) return undefined;
      const capability = 0.5 + edge(self.dimensions.defensa, opponent.dimensions.ataque) * 0.5;
      const strength = intensity * clamp(capability, 0, 1);
      return {
        opponent: { chanceQuality: -config.matchups.lowBlockVsCentral * strength },
        note: `El bloque cerrado de ${self.team.name} tapó los caminos centrales de ${opponent.team.name}`,
        magnitude: strength,
      };
    },
  },
  {
    id: 'bloque-bajo-vs-bandas',
    apply: ({ self, opponent, config }) => {
      const intensity =
        above(self.profile.boxProtection, 0.55) *
        above(opponent.profile.wingFocus, 0.55, 0.45) *
        above(opponent.wingQuality, 72, 18);
      if (intensity <= 0.02) return undefined;
      // Un bloque bajo con poca estatura sufre todavia mas los centros.
      const aerialGap = clamp(0.5 + edge(opponent.aerialQuality, self.aerialQuality) * 0.5, 0, 1);
      const strength = intensity * (0.6 + aerialGap * 0.6);
      return {
        opponent: {
          chanceQuality: config.matchups.lowBlockVsWings * strength,
          setPieceBonus: config.matchups.lowBlockVsWings * 0.5 * strength,
        },
        note: `${opponent.team.name} atacó por las bandas y los centros complicaron al bloque de ${self.team.name}`,
        magnitude: strength,
      };
    },
  },
  {
    id: 'linea-alta-vs-velocidad',
    apply: ({ self, opponent, config }) => {
      const intensity = above(self.profile.defensiveLine, 0.6) * above(opponent.dimensions.contraataque, 74, 18);
      if (intensity <= 0.02) return undefined;
      const strength = intensity * clamp(0.5 + edge(opponent.dimensions.contraataque, self.dimensions.defensa) * 0.5, 0, 1);
      return {
        opponent: { counterBonus: config.matchups.highLineVsPace * strength },
        note: `La línea alta de ${self.team.name} dejó espalda para la velocidad de ${opponent.team.name}`,
        magnitude: strength,
      };
    },
  },
  {
    id: 'posesion-vs-presion-baja',
    apply: ({ self, opponent, config }) => {
      const intensity = below(self.profile.directness, 0.4) * below(opponent.profile.pressing, 0.38);
      if (intensity <= 0.02) return undefined;
      const strength = intensity * clamp(0.5 + edge(self.dimensions.mediocampo, opponent.dimensions.mediocampo) * 0.5, 0.2, 1);
      return {
        self: { control: config.matchups.possessionVsLowPress * strength },
        note: `${opponent.team.name} no presionó y ${self.team.name} manejó la pelota sin resistencia`,
        magnitude: strength,
      };
    },
  },
  {
    id: 'ancho-vs-estrecho',
    apply: ({ self, opponent, config }) => {
      const intensity = above(self.profile.width, 0.6) * below(opponent.profile.width, 0.42);
      if (intensity <= 0.02) return undefined;
      const strength = intensity * clamp(0.4 + above(self.wingQuality, 68, 22) * 0.8, 0, 1.2);
      return {
        self: { chanceQuality: config.matchups.widthVsNarrow * strength, shotVolume: 0.04 * strength },
        note: `${self.team.name} abrió la cancha y encontró ventajas en los costados`,
        magnitude: strength,
      };
    },
  },
  {
    id: 'fisico-vs-juego-lento',
    apply: ({ self, opponent, config }) => {
      const intensity =
        above(self.profile.aggression, 0.6) *
        below(opponent.profile.tempo, 0.4) *
        above(edge(self.dimensions.fisico, opponent.dimensions.fisico) * 0.5 + 0.5, 0.55, 0.45);
      if (intensity <= 0.02) return undefined;
      return {
        self: { control: config.matchups.physicalVsSlow * intensity },
        opponent: { shotVolume: -0.04 * intensity },
        note: `${self.team.name} ganó la pelea física y cortó el ritmo pausado de ${opponent.team.name}`,
        magnitude: intensity,
      };
    },
  },
  {
    id: 'balon-parado-vs-aereo-debil',
    apply: ({ self, opponent, config }) => {
      const intensity =
        above(self.profile.setPieceIntent, 0.6) * above(edge(self.dimensions.balonParado, opponent.aerialQuality) * 0.5 + 0.5, 0.52, 0.48);
      if (intensity <= 0.02) return undefined;
      return {
        self: { setPieceBonus: config.matchups.setPieceVsWeakAerial * intensity },
        note: `${self.team.name} apretó con la pelota quieta ante la debilidad aérea de ${opponent.team.name}`,
        magnitude: intensity,
      };
    },
  },
];

/** Resuelve todos los cruces tacticos del partido. */
export function resolveMatchups(
  home: TeamStrength,
  away: TeamStrength,
  config: EngineConfig,
): MatchupOutcome {
  const homeEffect = emptyEffect();
  const awayEffect = emptyEffect();
  const homeNotes: MatchupNote[] = [];
  const awayNotes: MatchupNote[] = [];
  const scale = config.matchups.globalScale;

  const run = (
    self: TeamStrength,
    opponent: TeamStrength,
    selfEffect: MatchupEffect,
    opponentEffect: MatchupEffect,
    selfNotes: MatchupNote[],
    opponentNotes: MatchupNote[],
  ): void => {
    for (const rule of RULES) {
      const result = rule.apply({ self, opponent, config });
      if (!result) continue;
      accumulate(selfEffect, result.self, scale);
      accumulate(opponentEffect, result.opponent, scale);
      if (result.note && result.magnitude > 0.12) {
        const note: MatchupNote = { id: rule.id, text: result.note, magnitude: result.magnitude };
        // La nota se guarda del lado que saca ventaja del cruce.
        const benefitsOpponent =
          (result.opponent?.chanceQuality ?? 0) > 0 || (result.opponent?.counterBonus ?? 0) > 0;
        (benefitsOpponent ? opponentNotes : selfNotes).push(note);
      }
    }
  };

  run(home, away, homeEffect, awayEffect, homeNotes, awayNotes);
  run(away, home, awayEffect, homeEffect, awayNotes, homeNotes);

  return { home: homeEffect, away: awayEffect, homeNotes, awayNotes };
}

function accumulate(target: MatchupEffect, patch: Partial<MatchupEffect> | undefined, scale: number): void {
  if (!patch) return;
  target.control += (patch.control ?? 0) * scale;
  target.shotVolume += (patch.shotVolume ?? 0) * scale;
  target.chanceQuality += (patch.chanceQuality ?? 0) * scale;
  target.counterBonus += (patch.counterBonus ?? 0) * scale;
  target.setPieceBonus += (patch.setPieceBonus ?? 0) * scale;
}
