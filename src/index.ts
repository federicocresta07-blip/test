/**
 * Motor de simulacion de partidos.
 *
 * API publica del paquete. El punto de entrada de la simulacion es
 * `simulateMatch`, y es el mismo para HUMANO vs HUMANO, HUMANO vs IA e
 * IA vs IA (seccion 49).
 */

// Configuracion (seccion 52)
export {
  DEFAULT_CONFIG,
  resolveConfig,
  type ConfigOverrides,
  type EngineConfig,
} from './config/engine-config.ts';

// Nucleo
export { Rng, hashString } from './core/rng.ts';

// Dominio
export {
  ATTRIBUTE_ABSORBED,
  ATTRIBUTE_CODES,
  ATTRIBUTE_KEYS,
  buildAttributes,
  DEFENSIVE_ATTRIBUTES,
  GOALKEEPING_ATTRIBUTES,
  PHYSICAL_ATTRIBUTES,
  TECHNICAL_ATTRIBUTES,
  type AttributeKey,
  type Attributes,
  type PartialAttributes,
} from './domain/attributes.ts';
export { DIMENSIONS, type Dimension, type DimensionRatings } from './domain/dimensions.ts';
export {
  FORMATIONS,
  formationIds,
  getFormation,
  type Formation,
  type FormationSlot,
  type FormationTraits,
} from './domain/formations.ts';
export {
  buildAutomaticLineup,
  buildLineup,
  InsufficientPlayersError,
  MAX_BENCH,
  type Lineup,
  type LineupOverride,
} from './domain/lineup.ts';
export {
  createPlayer,
  DEFAULT_INJURY_DAYS,
  formLabel,
  formValue,
  isAvailable,
  isInjured,
  isSuspended,
  physicalCondition,
  playerOverall,
  type FormLabel,
  type Player,
  type PlayerCondition,
  type PlayerInput,
} from './domain/player.ts';
export {
  familiarityTier,
  POSITION_META,
  POSITIONS,
  type Position,
  type PositionMeta,
} from './domain/positions.ts';
export {
  buildTacticalProfile,
  createTactics,
  DEFAULT_TACTICS,
  type TacticalProfile,
  type Tactics,
} from './domain/tactics.ts';
export {
  availablePlayers,
  createTeam,
  withTactics,
  type ConditionalInstruction,
  type SetPieceTakers,
  type Team,
  type TeamInput,
} from './domain/team.ts';

// Valoraciones (secciones 25, 26, 27, 30, 33)
export { bestPosition, overallForPosition, POSITION_WEIGHTS } from './ratings/overall.ts';
export { evaluatePositionFit, positionalOverall, type PositionFit } from './ratings/position-fit.ts';
export { evaluateTacticalFit } from './ratings/tactical-fit.ts';
export {
  evaluatePerformance,
  type PerformanceBreakdown,
  type PerformanceContext,
  type RatedPlayer,
} from './ratings/effective-rating.ts';
export {
  computeTeamStrength,
  rateLineup,
  resolveSetPieceTakers,
  type KeyPlayer,
  type TeamStrength,
} from './ratings/team-strength.ts';

// Motor (secciones 43, 44, 49, 50, 51, 53)
export { simulateMatch, type MatchInput } from './engine/match-engine.ts';
export type {
  MatchEvent,
  MatchEventType,
  MatchProjection,
  MatchResult,
  PlayerMatchStats,
  TeamMatchReport,
  TeamMatchStats,
} from './engine/match-types.ts';
export { resolveMatchups, type MatchupOutcome } from './engine/tactical-matchups.ts';
export { projectTeam, resultProbabilities } from './engine/projection.ts';
export {
  advanceDays,
  availableCount,
  updateAfterMatch,
  type InjuryReport,
  type InjurySeverity,
  type ProgressionResult,
} from './progression/after-match.ts';

// Calibracion (seccion 52)
export {
  simulateMany,
  formatCalibrationReport,
  type CalibrationReport,
  type CalibrationOptions,
} from './calibration/simulate-many.ts';

// Datos de ejemplo
export { attributesFor, buildSquad, DEFAULT_SQUAD_SHAPE, type BuildSquadOptions } from './data/squad-builder.ts';
export { racingClub, riverPlate, sampleFixture } from './data/sample-teams.ts';

// Dataset historico: Torneo Clausura 1998 (ver docs/clausura-1998.md)
export {
  allHistoricalTeams,
  buildHistoricalTeam,
  CLAUSURA_1998_CHAMPION,
  CLAUSURA_1998_CLUBS,
  CLAUSURA_1998_ROUNDS,
  CLAUSURA_1998_SQUADS,
  CLAUSURA_1998_TABLE,
  CLAUSURA_1998_TOP_SCORER,
  clausura1998Club,
  clausura1998Squad,
  missingSquads,
  playableTeams,
  squadProgress,
  velezVsLanus,
  type HistoricalClub,
  type HistoricalPlayerEntry,
  type HistoricalSquad,
  type HistoricalStandingRow,
  type HistoricalTeam,
  type SquadConfidence,
} from './data/clausura-1998/index.ts';

// Presentacion (secciones 28, 50)
export {
  formatDimensions,
  formatEvents,
  formatMatchSummary,
  formatPlayerRatings,
  formatScoreboard,
  formatStatsTable,
} from './presentation/format-match.ts';
