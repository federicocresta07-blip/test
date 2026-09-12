/**
 * MATCH ENGINE (secciones 28, 29, 43, 44, 49, 53).
 *
 * Punto de entrada unico de la simulacion. HUMANO vs HUMANO, HUMANO vs IA e
 * IA vs IA pasan exactamente por aqui: el motor no sabe ni le importa quien
 * controla cada equipo (seccion 49).
 *
 * El partido se resuelve en cinco etapas (seccion 43):
 *
 *   1. Control del partido      -> posesion
 *   2. Creacion de ocasiones    -> cuantos remates
 *   3. Calidad de las ocasiones -> xG de cada remate
 *   4. Conversion               -> gol o no gol
 *   5. Resultado                -> minuto a minuto, con cambios y fatiga
 *
 * Principio rector (seccion 53): el motor no decide quien merece ganar. Arma
 * probabilidades a partir de calidad, tactica, jugadores, estado y contexto,
 * y despues resuelve el partido con esas probabilidades. El mejor equipo gana
 * mas seguido, nunca siempre.
 */

import { resolveConfig, type ConfigOverrides, type EngineConfig } from '../config/engine-config.ts';
import { clamp, round } from '../core/math.ts';
import { Rng } from '../core/rng.ts';
import { buildLineup, type LineupOverride } from '../domain/lineup.ts';
import { POSITION_META } from '../domain/positions.ts';
import type { Team } from '../domain/team.ts';
import { buildTacticalProfile } from '../domain/tactics.ts';
import type { PerformanceContext, RatedPlayer } from '../ratings/effective-rating.ts';
import { rateLineup, type TeamStrength } from '../ratings/team-strength.ts';
import {
  attackQualityIndex,
  boxDefenseIndex,
  createChance,
  planOpenPlayChances,
  type Chance,
  type PlannedChance,
  type Side,
} from './chances.ts';
import { resolveVolume } from './chance-volume.ts';
import { resolveControl } from './control.ts';
import { drawGoalkeeperDay, resolveChance } from './conversion.ts';
import {
  foulWeight,
  injuryWeight,
  planFouls,
  planInjuries,
  type PlannedFoul,
  type PlannedInjury,
} from './discipline.ts';
import {
  accumulateFatigue,
  collectiveFatigue,
  createLiveTeam,
  sendOff,
  type LiveTeam,
  type MutableTeamStats,
} from './live-team.ts';
import { buildNarrative } from './narrative.ts';
import { finalizePlayerStats, pickManOfTheMatch } from './player-ratings.ts';
import { projectTeam, resultProbabilities } from './projection.ts';
import { resolveSetPieces } from './set-pieces.ts';
import {
  applyConditionalInstructions,
  evaluateSubstitutionWindow,
  forcedSubstitution,
  matchIntensity,
} from './substitutions.ts';
import { resolveMatchups, type MatchupOutcome } from './tactical-matchups.ts';
import type {
  MatchEvent,
  MatchResult,
  PlayerMatchStats,
  TeamMatchReport,
  TeamMatchStats,
} from './match-types.ts';

export type MatchInput = {
  readonly home: Team;
  readonly away: Team;
  /** Semilla: con la misma semilla el partido se resuelve igual. */
  readonly seed?: number | string | undefined;
  /** Importancia del partido 0 (amistoso) .. 1 (final). Modula la experiencia. */
  readonly importance?: number | undefined;
  /** Cancha neutral: sin ventaja de localia (seccion 34). */
  readonly neutralVenue?: boolean | undefined;
  readonly homeLineup?: LineupOverride | undefined;
  readonly awayLineup?: LineupOverride | undefined;
  /** Overrides de calibracion (seccion 52). */
  readonly config?: ConfigOverrides | undefined;
};

/** xG desde el que una ocasion se considera clara, para las estadisticas. */
const BIG_CHANCE_XG = 0.3;

export function simulateMatch(input: MatchInput): MatchResult {
  const config = resolveConfig(input.config);
  const seed = input.seed ?? 1;
  const rng = new Rng(seed);
  const importance = clamp(input.importance ?? 0.4, 0, 1);
  const homeAtHome = !input.neutralVenue;

  // --- Preparacion: alineaciones y rendimiento de cada jugador (seccion 27) ---
  const homeContext: PerformanceContext = {
    isHome: homeAtHome,
    importance,
    chemistry: input.home.chemistry,
  };
  const awayContext: PerformanceContext = {
    isHome: false,
    importance,
    chemistry: input.away.chemistry,
  };

  const homeLineup = buildLineup(input.home, config, homeContext, input.homeLineup);
  const awayLineup = buildLineup(input.away, config, awayContext, input.awayLineup);

  const homeProfile = buildTacticalProfile(input.home.tactics);
  const awayProfile = buildTacticalProfile(input.away.tactics);

  const homeRated = rateLineup(homeLineup, homeProfile, homeContext, config, rng);
  const awayRated = rateLineup(awayLineup, awayProfile, awayContext, config, rng);

  const home = createLiveTeam('local', input.home, homeLineup, homeRated, homeContext, homeAtHome, config);
  const away = createLiveTeam('visitante', input.away, awayLineup, awayRated, awayContext, false, config);

  // La fuerza del once inicial es la que se informa: es la que definio el
  // partido, antes de cambios y expulsiones.
  const initialStrength = { home: home.strength, away: away.strength };

  // --- Cruces tacticos (seccion 32) ---
  let matchups: MatchupOutcome = resolveMatchups(home.strength, away.strength, config);
  const recomputeMatchups = (): void => {
    matchups = resolveMatchups(home.strength, away.strength, config);
  };

  // --- Etapa 1: control del partido ---
  const control = resolveControl(
    home.strength,
    away.strength,
    matchups.home,
    matchups.away,
    homeAtHome,
    config,
  );

  // --- Etapa 2: volumen de ocasiones ---
  const homeVolume = resolveVolume(
    home.strength,
    away.strength,
    control.homePossession,
    control.openness,
    matchups.home,
    homeAtHome,
    config,
    rng,
  );
  const awayVolume = resolveVolume(
    away.strength,
    home.strength,
    control.awayPossession,
    control.openness,
    matchups.away,
    false,
    config,
    rng,
  );

  // --- Etapa 3: calidad de las ocasiones ---
  const homeQualityEdge = attackQualityIndex(home.strength) - boxDefenseIndex(away.strength);
  const awayQualityEdge = attackQualityIndex(away.strength) - boxDefenseIndex(home.strength);

  // Proyeccion previa (seccion 44): goles esperados antes de simular.
  const homeProjection = projectTeam(
    home.strength,
    away.strength,
    homeVolume.expectedShots,
    homeQualityEdge,
    matchups.home,
    homeAtHome,
    config,
  );
  const awayProjection = projectTeam(
    away.strength,
    home.strength,
    awayVolume.expectedShots,
    awayQualityEdge,
    matchups.away,
    false,
    config,
  );

  const totalMinutes =
    config.timeline.regularMinutes +
    rng.poisson(config.timeline.stoppageMeanFirstHalf) +
    rng.poisson(config.timeline.stoppageMeanSecondHalf);

  // Ocasiones planificadas: tipo y minuto. El ejecutor se decide al rematar.
  const planned: PlannedChance[] = [];
  const homeSetPieces = resolveSetPieces(
    'local',
    home.strength,
    away.strength,
    homeQualityEdge,
    homeVolume.shots,
    config,
    rng,
  );
  const awaySetPieces = resolveSetPieces(
    'visitante',
    away.strength,
    home.strength,
    awayQualityEdge,
    awayVolume.shots,
    config,
    rng,
  );

  planned.push(
    ...planOpenPlayChances('local', home.strength, homeVolume.shots, homeQualityEdge, config, rng),
    ...planOpenPlayChances('visitante', away.strength, awayVolume.shots, awayQualityEdge, config, rng),
    ...homeSetPieces.chances,
    ...awaySetPieces.chances,
  );

  home.stats.corners = homeSetPieces.corners;
  away.stats.corners = awaySetPieces.corners;

  for (const chance of planned) chance.minute = drawMinute(totalMinutes, config, rng);

  // Faltas, tarjetas y lesiones (seccion 38).
  const homeFouls = planFouls('local', home.strength, away.strength, homeAtHome, totalMinutes, config, rng);
  const awayFouls = planFouls('visitante', away.strength, home.strength, false, totalMinutes, config, rng);
  home.stats.fouls = homeFouls.fouls;
  away.stats.fouls = awayFouls.fouls;

  const intensity = matchIntensity(home, away);
  const injuries: PlannedInjury[] = [
    ...planInjuries('local', home.strength, intensity, totalMinutes, config, rng),
    ...planInjuries('visitante', away.strength, intensity, totalMinutes, config, rng),
  ];

  // El "dia" de cada arquero (seccion 45).
  const goalkeeperDay = {
    local: drawGoalkeeperDay(config, rng),
    visitante: drawGoalkeeperDay(config, rng),
  };

  // --- Etapa 5: se juega el partido ---
  const events: MatchEvent[] = [];
  const score = { local: 0, visitante: 0 };
  const fouls: PlannedFoul[] = [...homeFouls.planned, ...awayFouls.planned].sort((a, b) => a.minute - b.minute);
  const subWindows = new Set(config.substitutions.windows);
  const scoreStateChecks = new Set([config.scoreState.fromMinute, config.scoreState.fromMinute + 13]);

  let foulIndex = 0;
  let injuryIndex = 0;

  const liveOf = (side: Side): LiveTeam => (side === 'local' ? home : away);
  const opponentOf = (side: Side): LiveTeam => (side === 'local' ? away : home);

  for (let minute = 1; minute <= totalMinutes; minute += 1) {
    accumulateFatigue(home, 1, config);
    accumulateFatigue(away, 1, config);
    for (const live of [home, away]) {
      for (const rated of live.onField) {
        const stats = live.playerStats.get(rated.player.id);
        if (stats) stats.minutesPlayed += 1;
      }
    }

    // Instrucciones condicionales del usuario (seccion 47).
    for (const live of [home, away]) {
      const diff = score[live.side] - score[opponentOf(live.side).side];
      const applied = applyConditionalInstructions(live, minute, diff, config);
      for (const label of applied) {
        events.push({ minute, type: 'instruccion', side: live.side, detail: label });
        recomputeMatchups();
      }
    }

    // Ventanas de cambios de la IA (seccion 47).
    if (subWindows.has(minute)) {
      for (const live of [home, away]) {
        const diff = score[live.side] - score[opponentOf(live.side).side];
        const decisions = evaluateSubstitutionWindow(live, minute, diff, config, rng);
        for (const decision of decisions) {
          events.push({
            minute,
            type: 'cambio',
            side: live.side,
            playerId: decision.incoming.id,
            playerName: decision.incoming.name,
            secondPlayerId: decision.outgoing.player.id,
            secondPlayerName: decision.outgoing.player.name,
            detail: `Entra ${decision.incoming.name} por ${decision.outgoing.player.name} (${decision.reason})`,
          });
        }
        if (decisions.length > 0) recomputeMatchups();
      }
    }

    // El marcador cambia el partido: el que pierde se juega mas (seccion 43).
    if (scoreStateChecks.has(minute) && score.local !== score.visitante) {
      const leader: Side = score.local > score.visitante ? 'local' : 'visitante';
      const trailer: Side = leader === 'local' ? 'visitante' : 'local';
      const deficit = Math.min(
        Math.abs(score.local - score.visitante),
        config.scoreState.maxDeficitConsidered,
      );
      const extraForTrailer = rng.poisson(config.scoreState.trailingExtraChances * deficit);
      const extraForLeader = rng.poisson(config.scoreState.leadingExtraCounters);
      for (let i = 0; i < extraForTrailer; i += 1) {
        planned.push({
          side: trailer,
          kind: rng.chance(0.45) ? 'ocasionBuena' : 'remateLejano',
          minute: rng.intBetween(minute + 1, totalMinutes),
          fromSetPiece: false,
        });
      }
      for (let i = 0; i < extraForLeader; i += 1) {
        planned.push({
          side: leader,
          kind: 'contraataque',
          minute: rng.intBetween(minute + 1, totalMinutes),
          fromSetPiece: false,
        });
      }
    }

    // Faltas y tarjetas.
    while (foulIndex < fouls.length && (fouls[foulIndex] as PlannedFoul).minute <= minute) {
      const foul = fouls[foulIndex] as PlannedFoul;
      foulIndex += 1;
      resolveFoul(foul, liveOf(foul.side), minute, events, config, rng);
    }

    // Lesiones (seccion 38).
    while (injuryIndex < injuries.length && (injuries[injuryIndex] as PlannedInjury).minute <= minute) {
      const injury = injuries[injuryIndex] as PlannedInjury;
      injuryIndex += 1;
      resolveInjury(liveOf(injury.side), minute, events, config, rng);
    }

    // Ocasiones de este minuto (etapa 4).
    for (const plan of planned) {
      if (plan.minute !== minute) continue;
      const attacking = liveOf(plan.side);
      const defending = opponentOf(plan.side);
      if (attacking.onField.length === 0) continue;

      const chance = materializeChance(plan, attacking, matchups, config, rng);
      const scoreDiff = score[plan.side] - score[defending.side];
      const shooterFatigue = attacking.inMatchFatigue.get(chance.shooter.player.id) ?? 0;
      const fatigueDrop =
        (shooterFatigue / 100) * config.performance.fatiguePenalty * config.timeline.inMatchFatigueEffect;

      // Piernas frescas contra piernas cansadas: el que mejor rota llega mejor
      // al tramo final (secciones 37, 47, 48).
      const fatigueEdge =
        ((collectiveFatigue(defending, 'defensa') - collectiveFatigue(attacking, 'ataque')) / 100) *
        config.timeline.lateFatigueQualityEffect;

      const contextFactor =
        scoreStateQualityFactor(plan, scoreDiff, minute, config) * (1 + fatigueEdge);

      const outcome = resolveChance(
        chance,
        defending.strength,
        goalkeeperDay[defending.side],
        fatigueDrop,
        contextFactor,
        config,
        rng,
      );

      registerShot(attacking, defending, chance, outcome, minute, events, score);
    }
  }

  // --- Cierre: estadisticas, notas y relato ---
  // La posesion se redondea una sola vez y la del visitante es el complemento,
  // para que las dos siempre sumen exactamente 100%.
  const homePossession = round(control.homePossession, 3);
  const homeStats = finalizeTeamStats(home.stats, score.local, homePossession);
  const awayStats = finalizeTeamStats(away.stats, score.visitante, round(1 - homePossession, 3));

  const homePlayers = collectPlayerStats(home, score.visitante, config);
  const awayPlayers = collectPlayerStats(away, score.local, config);

  const homeReport = buildReport(home, initialStrength.home, homeStats, homePlayers);
  const awayReport = buildReport(away, initialStrength.away, awayStats, awayPlayers);

  const manOfTheMatch = pickManOfTheMatch([...homePlayers, ...awayPlayers]);

  const projection = {
    expectedGoalsHome: round(homeProjection.expectedGoals, 2),
    expectedGoalsAway: round(awayProjection.expectedGoals, 2),
    expectedShotsHome: round(homeProjection.expectedShots, 1),
    expectedShotsAway: round(awayProjection.expectedShots, 1),
    possessionHome: homePossession,
    probabilities: roundProbabilities(
      resultProbabilities(homeProjection.expectedGoals, awayProjection.expectedGoals),
    ),
  };

  const tacticalNotes = [
    ...matchups.homeNotes.map((n) => n.text),
    ...matchups.awayNotes.map((n) => n.text),
  ];

  const narrative = buildNarrative({
    home: homeReport,
    away: awayReport,
    score: { home: score.local, away: score.visitante },
    events,
    projection,
    manOfTheMatch,
    homeNotes: matchups.homeNotes,
    awayNotes: matchups.awayNotes,
    control,
  });

  return {
    seed,
    home: homeReport,
    away: awayReport,
    score: { home: score.local, away: score.visitante },
    scoreline: `${input.home.name.toUpperCase()} ${score.local} - ${score.visitante} ${input.away.name.toUpperCase()}`,
    events: events.sort((a, b) => a.minute - b.minute),
    projection,
    manOfTheMatch,
    narrative,
    tacticalNotes,
  };
}

/** Reparte el minuto de una ocasion segun el peso de cada tramo de 15 minutos. */
function drawMinute(totalMinutes: number, config: EngineConfig, rng: Rng): number {
  const weights = config.timeline.segmentWeights;
  const segment = rng.weightedIndex(weights);
  const size = totalMinutes / weights.length;
  const start = segment * size;
  return clamp(Math.ceil(start + rng.next() * size), 1, totalMinutes);
}

/** Convierte una ocasion planificada en una ocasion concreta con ejecutor y xG. */
function materializeChance(
  plan: PlannedChance,
  attacking: LiveTeam,
  matchups: MatchupOutcome,
  config: EngineConfig,
  rng: Rng,
): Chance {
  const effect = attacking.side === 'local' ? matchups.home : matchups.away;
  // Los ejecutores designados se recalculan con los jugadores en cancha
  // (`refreshStrength`), asi que aca siempre son validos.
  const designated =
    plan.kind === 'penal'
      ? attacking.takers.penalty
      : plan.kind === 'tiroLibre'
        ? attacking.takers.freeKick
        : undefined;

  return createChance(
    plan.side,
    plan.kind,
    attacking.strength,
    effect,
    attacking.isHome,
    config,
    rng,
    designated ? { shooter: designated, fromSetPiece: plan.fromSetPiece } : { fromSetPiece: plan.fromSetPiece },
  );
}

/** El apuro del que pierde y la contra del que gana (seccion 43, etapa 5). */
function scoreStateQualityFactor(
  plan: PlannedChance,
  scoreDiff: number,
  minute: number,
  config: EngineConfig,
): number {
  if (minute < config.scoreState.fromMinute || scoreDiff === 0) return 1;
  if (scoreDiff < 0) return 1 + config.scoreState.trailingQualityPenalty;
  return plan.kind === 'contraataque' ? 1 + config.scoreState.leadingCounterQuality : 1;
}

function registerShot(
  attacking: LiveTeam,
  defending: LiveTeam,
  chance: Chance,
  outcome: { goal: boolean; onTarget: boolean; saved: boolean },
  minute: number,
  events: MatchEvent[],
  score: Record<Side, number>,
): void {
  const stats = attacking.stats;
  const shooterStats = attacking.playerStats.get(chance.shooter.player.id);
  const isBigChance = chance.xg >= BIG_CHANCE_XG;

  stats.shots += 1;
  stats.xg += chance.xg;
  if (chance.fromSetPiece) stats.setPieceShots += 1;
  if (chance.kind === 'contraataque') stats.counterAttackShots += 1;
  if (chance.kind === 'penal') stats.penalties += 1;
  if (isBigChance) stats.bigChances += 1;

  if (shooterStats) {
    shooterStats.shots += 1;
    shooterStats.xg += chance.xg;
  }

  if (chance.assist) {
    const assistStats = attacking.playerStats.get(chance.assist.player.id);
    if (assistStats) assistStats.chancesCreated += 1;
  }

  if (outcome.onTarget) {
    stats.shotsOnTarget += 1;
    if (shooterStats) shooterStats.shotsOnTarget += 1;
  }

  if (outcome.goal) {
    stats.goals += 1;
    score[attacking.side] += 1;
    if (shooterStats) shooterStats.goals += 1;

    const keeperStats = defending.playerStats.get(defending.strength.goalkeeper.player.id);
    if (keeperStats) keeperStats.goalsConceded += 1;

    if (chance.assist) {
      const assistStats = attacking.playerStats.get(chance.assist.player.id);
      if (assistStats) assistStats.assists += 1;
    }

    events.push({
      minute,
      type: 'gol',
      side: attacking.side,
      playerId: chance.shooter.player.id,
      playerName: chance.shooter.player.name,
      secondPlayerId: chance.assist?.player.id,
      secondPlayerName: chance.assist?.player.name,
      chanceKind: chance.kind,
      xg: round(chance.xg, 2),
      detail: goalDetail(chance),
    });
    return;
  }

  if (outcome.saved) {
    const keeper = defending.onField.find((r) => r.position === 'POR') ?? defending.strength.goalkeeper;
    defending.stats.saves += 1;
    const keeperStats = defending.playerStats.get(keeper.player.id);
    if (keeperStats) keeperStats.saves += 1;
    if (isBigChance) {
      events.push({
        minute,
        type: 'atajada',
        side: defending.side,
        playerId: keeper.player.id,
        playerName: keeper.player.name,
        chanceKind: chance.kind,
        xg: round(chance.xg, 2),
        detail: `Atajada de ${keeper.player.name} ante ${chance.shooter.player.name}`,
      });
    }
  }

  if (isBigChance) {
    stats.bigChancesMissed += 1;
    if (shooterStats) shooterStats.bigChancesMissed += 1;
    events.push({
      minute,
      type: chance.kind === 'penal' ? 'penal errado' : 'ocasion',
      side: attacking.side,
      playerId: chance.shooter.player.id,
      playerName: chance.shooter.player.name,
      chanceKind: chance.kind,
      xg: round(chance.xg, 2),
      detail:
        chance.kind === 'penal'
          ? `${chance.shooter.player.name} erró el penal`
          : `${chance.shooter.player.name} desperdició una ocasión clara`,
    });
  }
}

function goalDetail(chance: Chance): string {
  const scorer = chance.shooter.player.name;
  const assist = chance.assist ? `, asistencia de ${chance.assist.player.name}` : '';
  switch (chance.kind) {
    case 'penal':
      return `Gol de ${scorer} de penal`;
    case 'tiroLibre':
      return `Gol de ${scorer} de tiro libre`;
    case 'balonParado':
      return `Gol de ${scorer} tras una jugada de balón parado${assist}`;
    case 'cabezazo':
      return `Gol de ${scorer} de cabeza${assist}`;
    case 'contraataque':
      return `Gol de ${scorer} al contraataque${assist}`;
    case 'remateLejano':
      return `Gol de ${scorer} de larga distancia${assist}`;
    default:
      return `Gol de ${scorer}${assist}`;
  }
}

function resolveFoul(
  foul: PlannedFoul,
  live: LiveTeam,
  minute: number,
  events: MatchEvent[],
  config: EngineConfig,
  rng: Rng,
): void {
  if (live.onField.length === 0) return;
  const weights = live.onField.map((r) => foulWeight(r));
  const offender = live.onField[rng.weightedIndex(weights)] as RatedPlayer;
  const stats = live.playerStats.get(offender.player.id);
  if (stats) stats.fouls += 1;
  if (foul.card === 'ninguna') return;

  const yellows = (live.yellowCards.get(offender.player.id) ?? 0) + (foul.card === 'amarilla' ? 1 : 0);
  const isSecondYellow = foul.card === 'amarilla' && yellows >= 2;

  if (foul.card === 'amarilla') {
    live.yellowCards.set(offender.player.id, yellows);
    live.stats.yellowCards += 1;
    if (stats) stats.yellowCards += 1;
    events.push({
      minute,
      type: 'amarilla',
      side: live.side,
      playerId: offender.player.id,
      playerName: offender.player.name,
      detail: `Amarilla para ${offender.player.name}`,
    });
  }

  if (foul.card === 'roja' || isSecondYellow) {
    live.stats.redCards += 1;
    events.push({
      minute,
      type: 'roja',
      side: live.side,
      playerId: offender.player.id,
      playerName: offender.player.name,
      detail: isSecondYellow
        ? `${offender.player.name} expulsado por doble amarilla`
        : `${offender.player.name} expulsado`,
    });
    sendOff(live, offender, config);
    // Si expulsan al arquero entra el suplente (si queda cambio disponible).
    if (offender.position === 'POR') {
      const replacement = forcedSubstitution(live, offender, minute, config, rng);
      if (replacement) {
        events.push({
          minute,
          type: 'cambio',
          side: live.side,
          playerId: replacement.incoming.id,
          playerName: replacement.incoming.name,
          detail: `Entra ${replacement.incoming.name} al arco`,
        });
      }
    }
  }
}

function resolveInjury(
  live: LiveTeam,
  minute: number,
  events: MatchEvent[],
  config: EngineConfig,
  rng: Rng,
): void {
  if (live.onField.length === 0) return;
  const weights = live.onField.map((r) => injuryWeight(r, live.inMatchFatigue.get(r.player.id) ?? 0, config));
  const victim = live.onField[rng.weightedIndex(weights)] as RatedPlayer;
  const stats = live.playerStats.get(victim.player.id);
  if (stats) stats.injured = true;

  events.push({
    minute,
    type: 'lesion',
    side: live.side,
    playerId: victim.player.id,
    playerName: victim.player.name,
    detail: `${victim.player.name} se lesionó`,
  });

  const decision = forcedSubstitution(live, victim, minute, config, rng);
  if (decision) {
    events.push({
      minute,
      type: 'cambio',
      side: live.side,
      playerId: decision.incoming.id,
      playerName: decision.incoming.name,
      secondPlayerId: victim.player.id,
      secondPlayerName: victim.player.name,
      detail: `Entra ${decision.incoming.name} por ${victim.player.name} (lesión)`,
    });
  } else {
    // Sin cambios disponibles se sigue con uno menos.
    live.onField = live.onField.filter((r) => r.player.id !== victim.player.id);
    live.menDown += 1;
  }
}

function finalizeTeamStats(
  stats: MutableTeamStats,
  goals: number,
  possession: number,
): TeamMatchStats {
  return {
    goals,
    possession,
    shots: stats.shots,
    shotsOnTarget: stats.shotsOnTarget,
    xg: round(stats.xg, 2),
    corners: stats.corners,
    fouls: stats.fouls,
    yellowCards: stats.yellowCards,
    redCards: stats.redCards,
    bigChances: stats.bigChances,
    bigChancesMissed: stats.bigChancesMissed,
    saves: stats.saves,
    penalties: stats.penalties,
    setPieceShots: stats.setPieceShots,
    counterAttackShots: stats.counterAttackShots,
  };
}

function collectPlayerStats(
  live: LiveTeam,
  goalsConceded: number,
  config: EngineConfig,
): PlayerMatchStats[] {
  const out: PlayerMatchStats[] = [];
  for (const stats of live.playerStats.values()) {
    if (stats.minutesPlayed <= 0 && !stats.wasStarter) continue;
    out.push(finalizePlayerStats(stats, goalsConceded, config));
  }
  return out.sort((a, b) => {
    if (a.wasStarter !== b.wasStarter) return a.wasStarter ? -1 : 1;
    return POSITION_META[a.position].depth - POSITION_META[b.position].depth;
  });
}

function buildReport(
  live: LiveTeam,
  initial: TeamStrength,
  stats: TeamMatchStats,
  players: readonly PlayerMatchStats[],
): TeamMatchReport {
  return {
    teamId: live.team.id,
    teamName: live.team.name,
    shortName: live.team.shortName,
    tactics: live.tactics,
    initialTactics: live.team.tactics,
    dimensions: initial.dimensions,
    goalkeeperRating: Math.round(initial.goalkeeperRating),
    chemistry: live.team.chemistry,
    averageOverall: initial.averageOverall,
    keyPlayers: initial.keyPlayers,
    stats,
    players,
    startingXI: live.lineup.starters.map((s) => s.player.id),
  };
}

function roundProbabilities(p: {
  homeWin: number;
  draw: number;
  awayWin: number;
}): { homeWin: number; draw: number; awayWin: number } {
  return {
    homeWin: round(p.homeWin, 4),
    draw: round(p.draw, 4),
    awayWin: round(p.awayWin, 4),
  };
}
